import {
  AssessmentStatus,
  AttemptStatus,
  Prisma,
  ProblemType,
  ResultVisibility,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../app/common/errors/app-error";
import { EvaluateAnswerInput, SubmissionsQuery } from "./evaluation.types";

type PrismaTx = Prisma.TransactionClient;

type AttemptForEvaluation = Prisma.AttemptGetPayload<{
  include: {
    assessment: {
      include: {
        company: true;
        problems: {
          include: {
            problem: {
              include: {
                options: true;
              };
            };
          };
        };
      };
    };
    invitation: {
      include: {
        candidate: {
          select: {
            id: true;
            name: true;
            email: true;
          };
        };
      };
    };
    answers: {
      include: {
        problem: {
          include: {
            options: true;
          };
        };
      };
    };
  };
}>;

export class EvaluationService {
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

  private static getProblemMaxScore(problem: { points: number }) {
    return problem.points;
  }

  private static getPercentage(totalScore: number, maxScore: number) {
    if (maxScore <= 0) {
      return 0;
    }

    return Number(((totalScore / maxScore) * 100).toFixed(2));
  }

  private static getMcqAutoScore(answer: {
    selectedOptionId: string | null;
    problem: {
      points: number;
      options: {
        id: string;
        isCorrect: boolean;
      }[];
    };
  }) {
    if (!answer.selectedOptionId) {
      return 0;
    }

    const selectedOption = answer.problem.options.find(
      (option) => option.id === answer.selectedOptionId,
    );

    return selectedOption?.isCorrect
      ? this.getProblemMaxScore(answer.problem)
      : 0;
  }

  private static removeCorrectOptionFlags<T>(data: T): T {
    if (Array.isArray(data)) {
      return data.map((item) => this.removeCorrectOptionFlags(item)) as T;
    }

    if (data && typeof data === "object") {
      return Object.fromEntries(
        Object.entries(data as Record<string, unknown>)
          .filter(([key]) => key !== "isCorrect")
          .map(([key, value]) => [key, this.removeCorrectOptionFlags(value)]),
      ) as T;
    }

    return data;
  }

  private static async createAuditLog(
    tx: PrismaTx,
    data: {
      actorId: string;
      action: string;
      entityType: string;
      entityId: string;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    await tx.auditLog.create({
      data: {
        actorId: data.actorId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        metadata: data.metadata ?? undefined,
      },
    });
  }

  private static async assertRecruiterOwnsAssessment(
    userId: string,
    assessmentId: string,
  ) {
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
        company: true,
      },
    });

    if (!assessment) {
      throw new AppError("Assessment not found", 404);
    }

    return assessment;
  }

  private static async getAttemptForRecruiter(
    userId: string,
    attemptId: string,
  ) {
    const company = await this.getRecruiterCompany(userId);

    const attempt = await prisma.attempt.findFirst({
      where: {
        id: attemptId,
        assessment: {
          companyId: company.id,
          status: {
            not: AssessmentStatus.ARCHIVED,
          },
        },
      },
      include: {
        assessment: {
          include: {
            company: true,
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
        invitation: {
          include: {
            candidate: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        answers: {
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

    if (!attempt) {
      throw new AppError("Attempt not found", 404);
    }

    return attempt;
  }

  private static serializeSubmissionAttempt(
    attempt: Prisma.AttemptGetPayload<{
      include: {
        invitation: {
          include: {
            candidate: {
              select: {
                id: true;
                name: true;
                email: true;
              };
            };
          };
        };
        answers: {
          select: {
            id: true;
            problemId: true;
            score: true;
            evaluatedAt: true;
          };
        };
      };
    }>,
  ) {
    return {
      id: attempt.id,
      status: attempt.status,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      submittedAt: attempt.submittedAt,
      totalScore: attempt.score,
      percentage: attempt.percentage,
      passed: attempt.passed,
      candidate: attempt.invitation.candidate,
      candidateEmail: attempt.invitation.candidateEmail,
      answerCount: attempt.answers.length,
      evaluatedAnswerCount: attempt.answers.filter(
        (answer) => answer.score !== null,
      ).length,
      createdAt: attempt.createdAt,
      updatedAt: attempt.updatedAt,
    };
  }

  private static serializeEvaluationAttempt(attempt: AttemptForEvaluation) {
    return {
      id: attempt.id,
      status: attempt.status,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      submittedAt: attempt.submittedAt,
      totalScore: attempt.score,
      percentage: attempt.percentage,
      passed: attempt.passed,
      candidate: attempt.invitation.candidate,
      candidateEmail: attempt.invitation.candidateEmail,
      assessment: {
        id: attempt.assessment.id,
        title: attempt.assessment.title,
        duration: attempt.assessment.duration,
        passingScore: attempt.assessment.passingScore,
        resultVisibility: attempt.assessment.resultVisibility,
      },
      questions: attempt.assessment.problems.map((assessmentProblem) => {
        const answer = attempt.answers.find(
          (item) => item.problemId === assessmentProblem.problemId,
        );

        return {
          assessmentProblemId: assessmentProblem.id,
          order: assessmentProblem.order,
          problem: assessmentProblem.problem,
          answer: answer
            ? {
                id: answer.id,
                answerText: answer.answerText,
                selectedOptionId: answer.selectedOptionId,
                score: answer.score,
                evaluatedAt: answer.evaluatedAt,
              }
            : null,
          maxScore: this.getProblemMaxScore(assessmentProblem.problem),
          requiresManualEvaluation:
            assessmentProblem.problem.type !== ProblemType.MCQ,
        };
      }),
    };
  }

  static async getAssessmentSubmissions(
    userId: string,
    assessmentId: string,
    query: SubmissionsQuery,
  ) {
    await this.assertRecruiterOwnsAssessment(userId, assessmentId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.AttemptWhereInput = {
      assessmentId,
      ...(query.status && {
        status: query.status,
      }),
      ...(query.q && {
        invitation: {
          OR: [
            {
              candidateEmail: {
                contains: query.q,
                mode: "insensitive",
              },
            },
            {
              candidate: {
                OR: [
                  {
                    name: {
                      contains: query.q,
                      mode: "insensitive",
                    },
                  },
                  {
                    email: {
                      contains: query.q,
                      mode: "insensitive",
                    },
                  },
                ],
              },
            },
          ],
        },
      }),
    };

    const [total, attempts] = await prisma.$transaction([
      prisma.attempt.count({ where }),
      prisma.attempt.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          invitation: {
            include: {
              candidate: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          answers: {
            select: {
              id: true,
              problemId: true,
              score: true,
              evaluatedAt: true,
            },
          },
        },
      }),
    ]);

    return {
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      data: attempts.map((attempt) => this.serializeSubmissionAttempt(attempt)),
    };
  }

  static async getAttemptEvaluation(userId: string, attemptId: string) {
    const attempt = await this.getAttemptForRecruiter(userId, attemptId);
    return this.serializeEvaluationAttempt(attempt);
  }

  static async evaluateAnswer(
    userId: string,
    attemptId: string,
    answerId: string,
    data: EvaluateAnswerInput,
  ) {
    const attempt = await this.getAttemptForRecruiter(userId, attemptId);

    if (attempt.status === AttemptStatus.IN_PROGRESS) {
      throw new AppError("Attempt must be submitted before evaluation", 400);
    }

    if (attempt.status === AttemptStatus.EXPIRED) {
      throw new AppError("Expired attempts cannot be evaluated", 400);
    }

    if (attempt.status === AttemptStatus.EVALUATED) {
      throw new AppError("Finalized evaluation cannot be changed", 409);
    }

    const answer = attempt.answers.find((item) => item.id === answerId);

    if (!answer) {
      throw new AppError("Answer not found for this attempt", 404);
    }

    if (answer.problem.type === ProblemType.MCQ) {
      throw new AppError(
        "MCQ scores are automatic and cannot be manually overwritten",
        400,
      );
    }

    const maxScore = this.getProblemMaxScore(answer.problem);

    if (data.score > maxScore) {
      throw new AppError(
        `Manual score cannot be greater than problem maximum score ${maxScore}`,
        400,
      );
    }

    return prisma.$transaction(async (tx) => {
      const updatedAnswer = await tx.answer.update({
        where: {
          id: answer.id,
        },
        data: {
          score: data.score,
          evaluatedAt: new Date(),
        },
        include: {
          problem: true,
        },
      });

      await this.createAuditLog(tx, {
        actorId: userId,
        action: "ANSWER_MANUAL_EVALUATED",
        entityType: "Answer",
        entityId: updatedAnswer.id,
        metadata: {
          attemptId,
          problemId: updatedAnswer.problemId,
          problemType: updatedAnswer.problem.type,
          score: data.score,
          maxScore,
          feedback: data.feedback ?? null,
          note: "Current schema has no Answer.feedback column; feedback is stored in AuditLog.metadata only.",
        },
      });

      return {
        id: updatedAnswer.id,
        attemptId: updatedAnswer.attemptId,
        problemId: updatedAnswer.problemId,
        score: updatedAnswer.score,
        evaluatedAt: updatedAnswer.evaluatedAt,
        feedback: data.feedback ?? null,
      };
    });
  }

  static async finalizeEvaluation(userId: string, attemptId: string) {
    await this.getAttemptForRecruiter(userId, attemptId);

    return prisma.$transaction(async (tx) => {
      const attempt = await tx.attempt.findUnique({
        where: {
          id: attemptId,
        },
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
          answers: {
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

      if (!attempt) {
        throw new AppError("Attempt not found", 404);
      }

      if (attempt.status === AttemptStatus.IN_PROGRESS) {
        throw new AppError(
          "Attempt must be submitted before finalization",
          400,
        );
      }

      if (attempt.status === AttemptStatus.EXPIRED) {
        throw new AppError("Expired attempts cannot be finalized", 400);
      }

      if (attempt.status === AttemptStatus.EVALUATED) {
        throw new AppError("Attempt is already finalized", 409);
      }

      let totalScore = 0;
      let maxScore = 0;
      const missingManualProblemIds: string[] = [];
      const finalizedAnswers: {
        answerId: string;
        problemId: string;
        score: number;
      }[] = [];

      for (const assessmentProblem of attempt.assessment.problems) {
        const problem = assessmentProblem.problem;
        const problemMaxScore = this.getProblemMaxScore(problem);
        maxScore += problemMaxScore;

        const existingAnswer = attempt.answers.find(
          (answer) => answer.problemId === problem.id,
        );

        if (problem.type === ProblemType.MCQ) {
          const autoScore = existingAnswer
            ? this.getMcqAutoScore(existingAnswer)
            : 0;

          if (existingAnswer) {
            await tx.answer.update({
              where: {
                id: existingAnswer.id,
              },
              data: {
                score: autoScore,
                evaluatedAt: new Date(),
              },
            });

            finalizedAnswers.push({
              answerId: existingAnswer.id,
              problemId: problem.id,
              score: autoScore,
            });
          }

          totalScore += autoScore;
          continue;
        }

        if (!existingAnswer || existingAnswer.score === null) {
          missingManualProblemIds.push(problem.id);
          continue;
        }

        if (
          existingAnswer.score < 0 ||
          existingAnswer.score > problemMaxScore
        ) {
          throw new AppError(
            `Answer ${existingAnswer.id} score must be between 0 and ${problemMaxScore}`,
            400,
          );
        }

        totalScore += existingAnswer.score;
        finalizedAnswers.push({
          answerId: existingAnswer.id,
          problemId: problem.id,
          score: existingAnswer.score,
        });
      }

      if (missingManualProblemIds.length > 0) {
        throw new AppError(
          `Cannot finalize: ${missingManualProblemIds.length} written/coding answer(s) still need manual scores`,
          409,
        );
      }

      const percentage = this.getPercentage(totalScore, maxScore);
      const passed = totalScore >= attempt.assessment.passingScore!;

      const updatedAttempt = await tx.attempt.update({
        where: {
          id: attempt.id,
        },
        data: {
          score: totalScore,
          percentage,
          passed,
          status: AttemptStatus.EVALUATED,
        },
      });

      await this.createAuditLog(tx, {
        actorId: userId,
        action: "ATTEMPT_EVALUATION_FINALIZED",
        entityType: "Attempt",
        entityId: attempt.id,
        metadata: {
          assessmentId: attempt.assessmentId,
          totalScore,
          maxScore,
          percentage,
          passed,
          finalizedAnswers,
        },
      });

      return {
        attemptId: updatedAttempt.id,
        status: updatedAttempt.status,
        totalScore: updatedAttempt.score,
        maxScore,
        percentage: updatedAttempt.percentage,
        passed: updatedAttempt.passed,
      };
    });
  }

  static async getAttemptResult(userId: string, attemptId: string) {
    const attempt = await prisma.attempt.findUnique({
      where: {
        id: attemptId,
      },
      include: {
        assessment: {
          include: {
            company: true,
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
        invitation: {
          include: {
            candidate: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        answers: {
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

    if (!attempt) {
      throw new AppError("Attempt not found", 404);
    }

    const isCandidateOwner = attempt.invitation.candidateId === userId;
    const isRecruiterOwner = attempt.assessment.company.ownerId === userId;

    if (!isCandidateOwner && !isRecruiterOwner) {
      throw new AppError("You are not allowed to view this result", 403);
    }

    if (isCandidateOwner) {
      if (attempt.assessment.resultVisibility === ResultVisibility.HIDDEN) {
        throw new AppError("Result is hidden for this assessment", 403);
      }

      if (
        attempt.assessment.resultVisibility === ResultVisibility.AFTER_REVIEW &&
        attempt.status !== AttemptStatus.EVALUATED
      ) {
        throw new AppError(
          "Result will be available after recruiter review",
          403,
        );
      }

      if (
        attempt.assessment.resultVisibility === ResultVisibility.IMMEDIATE &&
        attempt.status === AttemptStatus.IN_PROGRESS
      ) {
        throw new AppError("Result is not available before submission", 403);
      }
    }

    const maxScore = attempt.assessment.problems.reduce(
      (total, item) => total + this.getProblemMaxScore(item.problem),
      0,
    );

    const result = {
      attemptId: attempt.id,
      assessment: {
        id: attempt.assessment.id,
        title: attempt.assessment.title,
        resultVisibility: attempt.assessment.resultVisibility,
      },
      candidate: attempt.invitation.candidate,
      candidateEmail: attempt.invitation.candidateEmail,
      status: attempt.status,
      submittedAt: attempt.submittedAt,
      totalScore: attempt.score,
      maxScore,
      percentage: attempt.percentage,
      passed: attempt.passed,
      isFinal: attempt.status === AttemptStatus.EVALUATED,
      answers: attempt.answers.map((answer) => ({
        id: answer.id,
        problemId: answer.problemId,
        problemType: answer.problem.type,
        score: answer.score,
        evaluatedAt: answer.evaluatedAt,
      })),
    };

    return isCandidateOwner ? this.removeCorrectOptionFlags(result) : result;
  }

  static async getAssessmentReport(userId: string, assessmentId: string) {
    const assessment = await this.assertRecruiterOwnsAssessment(
      userId,
      assessmentId,
    );

    const [invited, started, submitted, evaluated, evaluatedAttempts] =
      await prisma.$transaction([
        prisma.invitation.count({
          where: {
            assessmentId,
          },
        }),
        prisma.attempt.count({
          where: {
            assessmentId,
          },
        }),
        prisma.attempt.count({
          where: {
            assessmentId,
            status: {
              in: [AttemptStatus.SUBMITTED, AttemptStatus.EVALUATED],
            },
          },
        }),
        prisma.attempt.count({
          where: {
            assessmentId,
            status: AttemptStatus.EVALUATED,
          },
        }),
        prisma.attempt.findMany({
          where: {
            assessmentId,
            status: AttemptStatus.EVALUATED,
          },
          select: {
            score: true,
            percentage: true,
            passed: true,
          },
        }),
      ]);

    const scoreValues = evaluatedAttempts
      .map((attempt) => attempt.score)
      .filter((score): score is number => typeof score === "number");

    const averageScore =
      scoreValues.length === 0
        ? 0
        : Number(
            (
              scoreValues.reduce((total, score) => total + score, 0) /
              scoreValues.length
            ).toFixed(2),
          );

    const percentageValues = evaluatedAttempts
      .map((attempt) => attempt.percentage)
      .filter(
        (percentage): percentage is number => typeof percentage === "number",
      );

    const averagePercentage =
      percentageValues.length === 0
        ? 0
        : Number(
            (
              percentageValues.reduce(
                (total, percentage) => total + percentage,
                0,
              ) / percentageValues.length
            ).toFixed(2),
          );

    const passedCount = evaluatedAttempts.filter(
      (attempt) => attempt.passed === true,
    ).length;

    const passRate =
      evaluatedAttempts.length === 0
        ? 0
        : Number(((passedCount / evaluatedAttempts.length) * 100).toFixed(2));

    return {
      assessment: {
        id: assessment.id,
        title: assessment.title,
        status: assessment.status,
        passingScore: assessment.passingScore,
        resultVisibility: assessment.resultVisibility,
      },
      metrics: {
        invited,
        started,
        submitted,
        evaluated,
        averageScore,
        averagePercentage,
        passRate,
      },
    };
  }
}
