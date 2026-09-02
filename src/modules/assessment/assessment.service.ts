import { AssessmentStatus, ProblemStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../app/common/errors/app-error";

interface CreateAssessmentInput {
  title: string;
  description?: string;
  durationMinutes: number;
  passingScore: number;
  problemIds: string[];
}

interface UpdateAssessmentInput {
  title?: string;
  description?: string | null;
  durationMinutes?: number;
  passingScore?: number;
  problemIds?: string[];
}

export class AssessmentService {
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

  private static async validateProblems(
    companyId: string,
    problemIds: string[],
  ) {
    const problems = await prisma.problem.findMany({
      where: {
        id: {
          in: problemIds,
        },

        companyId,

        status: ProblemStatus.ACTIVE,
      },

      select: {
        id: true,
        points: true,
      },
    });

    if (problems.length !== problemIds.length) {
      throw new AppError(
        "One or more problems are invalid or do not belong to your company",
        400,
      );
    }

    return problems;
  }

  static async create(userId: string, data: CreateAssessmentInput) {
    const company = await this.getRecruiterCompany(userId);

    const problems = await this.validateProblems(company.id, data.problemIds);

    const totalPoints = problems.reduce(
      (total, problem) => total + problem.points,
      0,
    );

    if (data.passingScore > totalPoints) {
      throw new AppError(
        "Passing score cannot be greater than total problem points",
        400,
      );
    }

    return prisma.assessment.create({
      data: {
        title: data.title,

        description: data.description,

        duration: data.durationMinutes,

        passingScore: data.passingScore,

        companyId: company.id,

        problems: {
          create: data.problemIds.map((problemId, index) => ({
            problemId,
            order: index + 1,
          })),
        },
      },

      include: {
        problems: {
          orderBy: {
            order: "asc",
          },

          include: {
            problem: {
              include: {
                options: true,
              },
            },
          },
        },
      },
    });
  }
  static async findAll(userId: string) {
    const company = await this.getRecruiterCompany(userId);

    return prisma.assessment.findMany({
      where: {
        companyId: company.id,
        status: {
          not: AssessmentStatus.ARCHIVED,
        },
      },

      include: {
        _count: {
          select: {
            problems: true,
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });
  }
  static async findById(userId: string, assessmentId: string) {
    const company = await this.getRecruiterCompany(userId);

    const assessment = await prisma.assessment.findFirst({
      where: {
        id: assessmentId,
        companyId: company.id,
        status: {
          not: AssessmentStatus.ARCHIVED,
        },
      },

      include: {
        problems: {
          orderBy: {
            order: "asc",
          },

          include: {
            problem: {
              include: {
                options: true,
              },
            },
          },
        },
      },
    });

    if (!assessment) {
      throw new AppError("Assessment not found", 404);
    }

    return assessment;
  }

  static async update(
    userId: string,
    assessmentId: string,
    data: UpdateAssessmentInput,
  ) {
    const company = await this.getRecruiterCompany(userId);

    const assessment = await prisma.assessment.findFirst({
      where: {
        id: assessmentId,
        companyId: company.id,
      },

      include: {
        problems: {
          include: {
            problem: true,
          },
        },
      },
    });

    if (!assessment) {
      throw new AppError("Assessment not found", 404);
    }

    if (assessment.status !== AssessmentStatus.DRAFT) {
      throw new AppError("Only draft assessments can be updated", 400);
    }

    const finalProblemIds =
      data.problemIds ?? assessment.problems.map((item) => item.problemId);

    const problems = await this.validateProblems(company.id, finalProblemIds);

    const totalPoints = problems.reduce(
      (total, problem) => total + problem.points,
      0,
    );

    const finalPassingScore = data.passingScore ?? assessment.passingScore;

    if (finalPassingScore! > totalPoints) {
      throw new AppError(
        "Passing score cannot be greater than total problem points",
        400,
      );
    }

    return prisma.$transaction(async (tx) => {
      if (data.problemIds !== undefined) {
        await tx.assessmentProblem.deleteMany({
          where: {
            assessmentId: assessment.id,
          },
        });

        await tx.assessmentProblem.createMany({
          data: finalProblemIds.map((problemId, index) => ({
            assessmentId: assessment.id,
            problemId,
            order: index + 1,
          })),
        });
      }

      return tx.assessment.update({
        where: {
          id: assessment.id,
        },

        data: {
          ...(data.title !== undefined && {
            title: data.title,
          }),

          ...(data.description !== undefined && {
            description: data.description,
          }),

          ...(data.durationMinutes !== undefined && {
            durationMinutes: data.durationMinutes,
          }),

          ...(data.passingScore !== undefined && {
            passingScore: data.passingScore,
          }),
        },

        include: {
          problems: {
            orderBy: {
              order: "asc",
            },

            include: {
              problem: true,
            },
          },
        },
      });
    });
  }

  static async publish(userId: string, assessmentId: string) {
    const company = await this.getRecruiterCompany(userId);

    const assessment = await prisma.assessment.findFirst({
      where: {
        id: assessmentId,
        companyId: company.id,
      },

      include: {
        problems: true,
      },
    });

    if (!assessment) {
      throw new AppError("Assessment not found", 404);
    }

    if (assessment.status !== AssessmentStatus.DRAFT) {
      throw new AppError("Only draft assessments can be published", 400);
    }

    if (assessment.problems.length === 0) {
      throw new AppError("Assessment must contain at least one problem", 400);
    }

    return prisma.assessment.update({
      where: {
        id: assessment.id,
      },

      data: {
        status: AssessmentStatus.PUBLISHED,
      },
    });
  }

  static async archive(userId: string, assessmentId: string) {
    const company = await this.getRecruiterCompany(userId);

    const assessment = await prisma.assessment.findFirst({
      where: {
        id: assessmentId,
        companyId: company.id,
        status: {
          not: AssessmentStatus.ARCHIVED,
        },
      },
    });

    if (!assessment) {
      throw new AppError("Assessment not found", 404);
    }

    return prisma.assessment.update({
      where: {
        id: assessment.id,
      },

      data: {
        status: AssessmentStatus.ARCHIVED,
      },
    });
  }
}
