import { ProblemStatus, ProblemType } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../app/common/errors/app-error";

interface ProblemOptionInput {
  text: string;
  isCorrect: boolean;
}

interface CreateProblemInput {
  title: string;
  description: string;
  type: ProblemType;
  points: number;
  difficulty?: string;
  tags?: string[];
  options?: ProblemOptionInput[];
}

interface UpdateProblemInput {
  title?: string;
  description?: string;
  type?: ProblemType;
  points?: number;
  difficulty?: string;
  tags?: string[];
  options?: ProblemOptionInput[];
}

export class ProblemService {
  private static async getRecruiterCompany(userId: string) {
    const company = await prisma.company.findUnique({
      where: {
        ownerId: userId,
      },
      select: {
        id: true,
      },
    });

    if (!company) {
      throw new AppError("Company not found for this recruiter", 404);
    }

    return company;
  }

  static async create(userId: string, data: CreateProblemInput) {
    const company = await this.getRecruiterCompany(userId);

    if (data.type === ProblemType.MCQ) {
      const options = data.options ?? [];

      if (options.length < 2) {
        throw new AppError("MCQ must have at least 2 options", 400);
      }

      const correctCount = options.filter((option) => option.isCorrect).length;

      if (correctCount !== 1) {
        throw new AppError("MCQ must have exactly one correct option", 400);
      }
    }

    if (
      data.type !== ProblemType.MCQ &&
      data.options &&
      data.options.length > 0
    ) {
      throw new AppError("Only MCQ problems can have options", 400);
    }

    return prisma.problem.create({
      data: {
        title: data.title,
        description: data.description,
        type: data.type,
        points: data.points,
        difficulty: data.difficulty,
        tags: data.tags ?? [],
        companyId: company.id,

        ...(data.type === ProblemType.MCQ && {
          options: {
            create: data.options,
          },
        }),
      },

      include: {
        options: true,
      },
    });
  }

  static async findAll(userId: string) {
    const company = await this.getRecruiterCompany(userId);

    return prisma.problem.findMany({
      where: {
        companyId: company.id,
        status: ProblemStatus.ACTIVE,
      },

      include: {
        options: true,
      },

      orderBy: {
        createdAt: "desc",
      },
    });
  }

  static async findById(userId: string, problemId: string) {
    const company = await this.getRecruiterCompany(userId);

    const problem = await prisma.problem.findFirst({
      where: {
        id: problemId,
        companyId: company.id,
      },

      include: {
        options: true,
      },
    });

    if (!problem) {
      throw new AppError("Problem not found", 404);
    }

    return problem;
  }
  static async update(
    userId: string,
    problemId: string,
    data: UpdateProblemInput,
  ) {
    const company = await this.getRecruiterCompany(userId);

    const existingProblem = await prisma.problem.findFirst({
      where: {
        id: problemId,
        companyId: company.id,
      },

      include: {
        options: true,
      },
    });

    if (!existingProblem) {
      throw new AppError("Problem not found", 404);
    }

    const finalType = data.type ?? existingProblem.type;

    const finalOptions =
      data.options ??
      existingProblem.options.map((option) => ({
        text: option.text,
        isCorrect: option.isCorrect,
      }));

    if (finalType === ProblemType.MCQ) {
      if (finalOptions.length < 2) {
        throw new AppError("MCQ must have at least 2 options", 400);
      }

      const correctCount = finalOptions.filter(
        (option) => option.isCorrect,
      ).length;

      if (correctCount !== 1) {
        throw new AppError("MCQ must have exactly one correct option", 400);
      }
    }

    if (finalType !== ProblemType.MCQ && finalOptions.length > 0) {
      throw new AppError("Only MCQ problems can have options", 400);
    }

    return prisma.$transaction(async (tx) => {
      if (data.options !== undefined) {
        await tx.problemOption.deleteMany({
          where: {
            problemId: existingProblem.id,
          },
        });

        if (finalType === ProblemType.MCQ) {
          await tx.problemOption.createMany({
            data: finalOptions.map((option) => ({
              text: option.text,
              isCorrect: option.isCorrect,
              problemId: existingProblem.id,
            })),
          });
        }
      }

      /*
      If the problem type changes from MCQ
      to WRITTEN/CODING and options were not sent,
      we still need to remove old MCQ options.
    */

      if (
        data.type !== undefined &&
        data.type !== ProblemType.MCQ &&
        existingProblem.options.length > 0 &&
        data.options === undefined
      ) {
        await tx.problemOption.deleteMany({
          where: {
            problemId: existingProblem.id,
          },
        });
      }

      return tx.problem.update({
        where: {
          id: existingProblem.id,
        },

        data: {
          ...(data.title !== undefined && {
            title: data.title,
          }),

          ...(data.description !== undefined && {
            description: data.description,
          }),

          ...(data.type !== undefined && {
            type: data.type,
          }),

          ...(data.points !== undefined && {
            points: data.points,
          }),

          ...(data.difficulty !== undefined && {
            difficulty: data.difficulty,
          }),

          ...(data.tags !== undefined && {
            tags: data.tags,
          }),
        },

        include: {
          options: true,
        },
      });
    });
  }

  static async archive(
  userId: string,
  problemId: string
) {
  const company = await this.getRecruiterCompany(userId);

  const problem = await prisma.problem.findFirst({
    where: {
      id: problemId,
      companyId: company.id,
      status: ProblemStatus.ACTIVE,
    },
  });

  if (!problem) {
    throw new AppError("Problem not found", 404);
  }

  return prisma.problem.update({
    where: {
      id: problem.id,
    },

    data: {
      status: ProblemStatus.ARCHIVED,
    },
  });
}
}
