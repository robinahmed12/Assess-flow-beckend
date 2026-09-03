import { AttemptStatus, ProblemType } from "@prisma/client";
import { AppError } from "../../app/common/errors/app-error";
import { prisma } from "../../lib/prisma";

interface SaveAnswerInput {
  selectedOptionId?: string;
  answerText?: string;
}

export class AttemptService {
  private static async assertCandidateAttempt(candidateId: string, attemptId: string) {
    const attempt = await prisma.attempt.findFirst({
      where: {
        id: attemptId,
        invitation: {
          candidateId,
        },
      },
      include: {
        answers: true,
        invitation: {
          include: {
            assessment: {
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
            },
          },
        },
      },
    });

    if (!attempt) {
      throw new AppError("Attempt not found", 404);
    }

    return attempt;
  }

  private static async assertAttemptCanBeEdited(candidateId: string, attemptId: string) {
    const attempt = await this.assertCandidateAttempt(candidateId, attemptId);

    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new AppError("This attempt is not active", 400);
    }

    const now = new Date();

    if (attempt.expiresAt <= now) {
      await prisma.attempt.update({
        where: {
          id: attempt.id,
        },
        data: {
          status: AttemptStatus.EXPIRED,
        },
      });

      throw new AppError("This attempt has expired", 400);
    }

    return attempt;
  }

  private static formatCandidateAttempt(attempt: any) {
    return {
      id: attempt.id,
      status: attempt.status,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      submittedAt: attempt.submittedAt,
      score: attempt.score,
      percentage: attempt.percentage,
      passed: attempt.passed,
      assessment: {
        id: attempt.invitation.assessment.id,
        title: attempt.invitation.assessment.title,
        description: attempt.invitation.assessment.description,
        duration: attempt.invitation.assessment.duration,
        passingScore: attempt.invitation.assessment.passingScore,
        problems: attempt.invitation.assessment.problems.map((item: any) => ({
          id: item.problem.id,
          order: item.order,
          title: item.problem.title,
          description: item.problem.description,
          type: item.problem.type,
          points: item.problem.points,
          difficulty: item.problem.difficulty,
          tags: item.problem.tags,
          options: item.problem.options.map((option: any) => ({
            id: option.id,
            text: option.text,
          })),
        })),
      },
      answers: attempt.answers.map((answer: any) => ({
        id: answer.id,
        problemId: answer.problemId,
        selectedOptionId: answer.selectedOptionId,
        answerText: answer.answerText,
        score: attempt.status === AttemptStatus.IN_PROGRESS ? undefined : answer.score,
        createdAt: answer.createdAt,
        updatedAt: answer.updatedAt,
      })),
    };
  }

  static async findMine(candidateId: string) {
    const attempts = await prisma.attempt.findMany({
      where: {
        invitation: {
          candidateId,
        },
      },
      include: {
        invitation: {
          include: {
            assessment: {
              select: {
                id: true,
                title: true,
                description: true,
                duration: true,
                passingScore: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return attempts.map((attempt) => ({
      id: attempt.id,
      status: attempt.status,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      submittedAt: attempt.submittedAt,
      score: attempt.score,
      percentage: attempt.percentage,
      passed: attempt.passed,
      assessment: attempt.invitation.assessment,
    }));
  }

  static async findById(candidateId: string, attemptId: string) {
    const attempt = await this.assertCandidateAttempt(candidateId, attemptId);

    return this.formatCandidateAttempt(attempt);
  }

  static async saveAnswer(
    candidateId: string,
    attemptId: string,
    problemId: string,
    data: SaveAnswerInput,
  ) {
    const attempt = await this.assertAttemptCanBeEdited(candidateId, attemptId);

    const assessmentProblem = attempt.invitation.assessment.problems.find(
      (item: any) => item.problemId === problemId,
    );

    if (!assessmentProblem) {
      throw new AppError("This problem does not belong to the assessment", 400);
    }

    const problem = assessmentProblem.problem;

    if (problem.type === ProblemType.MCQ) {
      if (!data.selectedOptionId) {
        throw new AppError("selectedOptionId is required for MCQ answers", 400);
      }

      const optionBelongsToProblem = problem.options.some(
        (option: any) => option.id === data.selectedOptionId,
      );

      if (!optionBelongsToProblem) {
        throw new AppError("Selected option does not belong to this problem", 400);
      }
    }

    if (problem.type !== ProblemType.MCQ && !data.answerText) {
      throw new AppError("answerText is required for written or coding answers", 400);
    }

    return prisma.answer.upsert({
      where: {
        attemptId_problemId: {
          attemptId: attempt.id,
          problemId,
        },
      },
      create: {
        attemptId: attempt.id,
        problemId,
        selectedOptionId: problem.type === ProblemType.MCQ ? data.selectedOptionId : null,
        answerText: problem.type === ProblemType.MCQ ? null : data.answerText,
        score: null,
      },
      update: {
        selectedOptionId: problem.type === ProblemType.MCQ ? data.selectedOptionId : null,
        answerText: problem.type === ProblemType.MCQ ? null : data.answerText,
        score: null,
      },
      select: {
        id: true,
        attemptId: true,
        problemId: true,
        selectedOptionId: true,
        answerText: true,
        score: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  static async submit(candidateId: string, attemptId: string) {
    const attempt = await this.assertAttemptCanBeEdited(candidateId, attemptId);

    const assessmentProblems = attempt.invitation.assessment.problems;
    const maxScore = assessmentProblems.reduce(
      (total: number, item: any) => total + item.problem.points,
      0,
    );

    const hasManualProblems = assessmentProblems.some(
      (item: any) => item.problem.type !== ProblemType.MCQ,
    );

    const existingAnswers = new Map(
      attempt.answers.map((answer: any) => [answer.problemId, answer]),
    );

    const result = await prisma.$transaction(async (tx) => {
      let mcqScore = 0;

      for (const assessmentProblem of assessmentProblems) {
        const problem = assessmentProblem.problem;

        if (problem.type !== ProblemType.MCQ) {
          continue;
        }

        const existingAnswer = existingAnswers.get(problem.id) as any | undefined;
        const correctOption = problem.options.find((option: any) => option.isCorrect);
        const score =
          existingAnswer?.selectedOptionId &&
          correctOption &&
          existingAnswer.selectedOptionId === correctOption.id
            ? problem.points
            : 0;

        mcqScore += score;

        await tx.answer.upsert({
          where: {
            attemptId_problemId: {
              attemptId: attempt.id,
              problemId: problem.id,
            },
          },
          create: {
            attemptId: attempt.id,
            problemId: problem.id,
            selectedOptionId: existingAnswer?.selectedOptionId ?? null,
            answerText: null,
            score,
            evaluatedAt: new Date(),
          },
          update: {
            score,
            evaluatedAt: new Date(),
          },
        });
      }

      const percentage = hasManualProblems || maxScore === 0 ? null : (mcqScore / maxScore) * 100;
      const passed =
        hasManualProblems || attempt.invitation.assessment.passingScore === null
          ? null
          : mcqScore >= attempt.invitation.assessment.passingScore;

      return tx.attempt.update({
        where: {
          id: attempt.id,
        },
        data: {
          status: AttemptStatus.SUBMITTED,
          submittedAt: new Date(),
          score: mcqScore,
          percentage,
          passed,
        },
        include: {
          answers: true,
          invitation: {
            include: {
              assessment: {
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
              },
            },
          },
        },
      });
    });

    return this.formatCandidateAttempt(result);
  }
}
