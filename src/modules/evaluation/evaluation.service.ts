import {
  Prisma,
  ProblemType,
  ResultVisibility,
  UserRole,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { badRequest, conflict, forbidden, notFound } from "../../app/common/errors/evaluation.errors";
import { AuthUser } from "./evaluation.types";

type PrismaTx = Prisma.TransactionClient;

type AttemptWithEvaluationData = Prisma.AttemptGetPayload<{
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

const isAdmin = (user: AuthUser) => user.role === UserRole.ADMIN;
const isRecruiter = (user: AuthUser) => user.role === UserRole.RECRUITER;
const isCandidate = (user: AuthUser) => user.role === UserRole.CANDIDATE;

const getProblemMaxScore = (problem: { points: number }) => problem.points;

const toPercentage = (totalScore: number, maxScore: number) => {
  if (maxScore <= 0) return 0;
  return Number(((totalScore / maxScore) * 100).toFixed(2));
};

const getMcqAutoScore = (answer: {
  selectedOptionId: string | null;
  problem: { points: number; options: { id: string; isCorrect: boolean }[] };
}) => {
  if (!answer.selectedOptionId) return 0;

  const selectedOption = answer.problem.options.find(
    (option) => option.id === answer.selectedOptionId,
  );

  return selectedOption?.isCorrect ? getProblemMaxScore(answer.problem) : 0;
};

const removeCorrectOptionFlags = <T extends Record<string, any>>(
  data: T,
): T => {
  if (Array.isArray(data)) {
    return data.map((item) => removeCorrectOptionFlags(item)) as unknown as T;
  }

  if (data && typeof data === "object") {
    return Object.fromEntries(
      Object.entries(data)
        .filter(([key]) => key !== "isCorrect")
        .map(([key, value]) => [key, removeCorrectOptionFlags(value)]),
    ) as T;
  }

  return data;
};

const createAuditLog = async (
  tx: PrismaTx,
  input: {
    actorId?: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Prisma.InputJsonValue;
  },
) => {
  await tx.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata ?? undefined,
    },
  });
};

const assertRecruiterOwnsAssessment = async (
  assessmentId: string,
  user: AuthUser,
) => {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      company: true,
    },
  });

  if (!assessment) {
    throw notFound("Assessment not found");
  }

  if (isAdmin(user)) {
    return assessment;
  }

  if (!isRecruiter(user) || assessment.company.ownerId !== user.id) {
    throw forbidden("You do not own this assessment");
  }

  return assessment;
};

const getAttemptForRecruiter = async (attemptId: string, user: AuthUser) => {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      assessment: {
        include: {
          company: true,
          problems: {
            include: {
              problem: {
                include: {
                  options: true,
                },
              },
            },
            orderBy: {
              order: "asc",
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
    throw notFound("Attempt not found");
  }

  if (isAdmin(user)) {
    return attempt;
  }

  if (!isRecruiter(user) || attempt.assessment.company.ownerId !== user.id) {
    throw forbidden("You are not allowed to evaluate this attempt");
  }

  return attempt;
};

const serializeSubmissionAttempt = (
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
) => ({
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
});

const serializeEvaluationAttempt = (attempt: AttemptWithEvaluationData) => ({
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
      maxScore: getProblemMaxScore(assessmentProblem.problem),
      requiresManualEvaluation:
        assessmentProblem.problem.type !== ProblemType.MCQ,
    };
  }),
});

export const evaluationService = {
  async getAssessmentSubmissions(
    assessmentId: string,
    user: AuthUser,
    query: { page: number; limit: number; status?: string; q?: string },
  ) {
    await assertRecruiterOwnsAssessment(assessmentId, user);

    const where: Prisma.AttemptWhereInput = {
      assessmentId,
      ...(query.status ? { status: query.status as any } : {}),
      ...(query.q
        ? {
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
          }
        : {}),
    };

    const skip = (query.page - 1) * query.limit;

    const [total, attempts] = await prisma.$transaction([
      prisma.attempt.count({ where }),
      prisma.attempt.findMany({
        where,
        skip,
        take: query.limit,
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
      items: attempts.map(serializeSubmissionAttempt),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  },

  async getAttemptEvaluation(attemptId: string, user: AuthUser) {
    const attempt = await getAttemptForRecruiter(attemptId, user);
    return serializeEvaluationAttempt(attempt);
  },

  async evaluateAnswer(
    attemptId: string,
    answerId: string,
    user: AuthUser,
    input: { score: number; feedback?: string },
  ) {
    const attempt = await getAttemptForRecruiter(attemptId, user);

    if (attempt.status === "IN_PROGRESS") {
      throw conflict("Attempt must be submitted before manual evaluation");
    }

    if (attempt.status === "EXPIRED") {
      throw conflict(
        "Expired attempts cannot be evaluated until submitted/finalized by your attempt policy",
      );
    }

    if (attempt.status === "EVALUATED") {
      throw conflict(
        "Finalized evaluated attempts cannot be changed through normal evaluation",
      );
    }

    const answer = attempt.answers.find((item) => item.id === answerId);

    if (!answer || answer.attemptId !== attemptId) {
      throw notFound("Answer not found for this attempt");
    }

    if (answer.problem.type === ProblemType.MCQ) {
      throw badRequest(
        "MCQ scores are automatic and cannot be manually overwritten",
      );
    }

    const maxScore = getProblemMaxScore(answer.problem);

    if (input.score > maxScore) {
      throw badRequest(
        `Manual score cannot exceed the problem maximum of ${maxScore}`,
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedAnswer = await tx.answer.update({
        where: { id: answerId },
        data: {
          score: input.score,
          evaluatedAt: new Date(),
        },
        include: {
          problem: true,
        },
      });

      await createAuditLog(tx, {
        actorId: user.id,
        action: "ANSWER_MANUAL_EVALUATED",
        entityType: "Answer",
        entityId: answerId,
        metadata: {
          attemptId,
          problemId: updatedAnswer.problemId,
          problemType: updatedAnswer.problem.type,
          score: input.score,
          maxScore,
          feedback: input.feedback ?? null,
          note: "Current schema has no feedback column; feedback is stored in audit metadata only.",
        },
      });

      return updatedAnswer;
    });

    return {
      id: updated.id,
      attemptId: updated.attemptId,
      problemId: updated.problemId,
      score: updated.score,
      evaluatedAt: updated.evaluatedAt,
      feedback: input.feedback ?? null,
      feedbackPersistenceNote:
        "Current schema has no Answer.feedback column; feedback was stored in AuditLog.metadata only.",
    };
  },

  async finalizeEvaluation(attemptId: string, user: AuthUser) {
    await getAttemptForRecruiter(attemptId, user);

    return prisma.$transaction(async (tx) => {
      const attempt = await tx.attempt.findUnique({
        where: { id: attemptId },
        include: {
          assessment: {
            include: {
              problems: {
                include: {
                  problem: {
                    include: {
                      options: true,
                    },
                  },
                },
                orderBy: {
                  order: "asc",
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
        throw notFound("Attempt not found");
      }

      if (attempt.status === "IN_PROGRESS") {
        throw conflict("Attempt must be submitted before finalization");
      }

      if (attempt.status === "EXPIRED") {
        throw conflict(
          "Expired attempts cannot be finalized unless your submission policy converts them to SUBMITTED",
        );
      }

      if (attempt.status === "EVALUATED") {
        throw conflict("Attempt is already finalized");
      }

      let totalScore = 0;
      let maxScore = 0;
      const updatedAnswers: {
        answerId: string;
        problemId: string;
        score: number;
      }[] = [];
      const missingManualEvaluations: string[] = [];

      for (const assessmentProblem of attempt.assessment.problems) {
        const problem = assessmentProblem.problem;
        const problemMaxScore = getProblemMaxScore(problem);
        maxScore += problemMaxScore;

        const existingAnswer = attempt.answers.find(
          (answer) => answer.problemId === problem.id,
        );

        if (problem.type === ProblemType.MCQ) {
          let autoScore = 0;

          if (existingAnswer) {
            autoScore = getMcqAutoScore(existingAnswer);

            await tx.answer.update({
              where: { id: existingAnswer.id },
              data: {
                score: autoScore,
                evaluatedAt: new Date(),
              },
            });

            updatedAnswers.push({
              answerId: existingAnswer.id,
              problemId: problem.id,
              score: autoScore,
            });
          } else {
            const createdAnswer = await tx.answer.create({
              data: {
                attemptId,
                problemId: problem.id,
                score: 0,
                evaluatedAt: new Date(),
              },
            });

            updatedAnswers.push({
              answerId: createdAnswer.id,
              problemId: problem.id,
              score: 0,
            });
          }

          totalScore += autoScore;
          continue;
        }

        if (
          !existingAnswer ||
          existingAnswer.score === null ||
          existingAnswer.score === undefined
        ) {
          missingManualEvaluations.push(problem.id);
          continue;
        }

        if (
          existingAnswer.score < 0 ||
          existingAnswer.score > problemMaxScore
        ) {
          throw badRequest(
            `Answer ${existingAnswer.id} score must be between 0 and ${problemMaxScore}`,
          );
        }

        totalScore += existingAnswer.score;
        updatedAnswers.push({
          answerId: existingAnswer.id,
          problemId: problem.id,
          score: existingAnswer.score,
        });
      }

      if (missingManualEvaluations.length > 0) {
        throw conflict(
          `Cannot finalize: ${missingManualEvaluations.length} written/coding answer(s) still need manual scores`,
        );
      }

      const percentage = toPercentage(totalScore, maxScore);
      const passed =
        attempt.assessment.passingScore === null ||
        attempt.assessment.passingScore === undefined
          ? null
          : percentage >= attempt.assessment.passingScore;

      const updatedAttempt = await tx.attempt.update({
        where: { id: attemptId },
        data: {
          score: totalScore,
          percentage,
          passed,
          status: "EVALUATED",
        },
      });

      await createAuditLog(tx, {
        actorId: user.id,
        action: "ATTEMPT_EVALUATION_FINALIZED",
        entityType: "Attempt",
        entityId: attemptId,
        metadata: {
          assessmentId: attempt.assessmentId,
          totalScore,
          maxScore,
          percentage,
          passed,
          updatedAnswers,
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
  },

  async getAttemptResult(attemptId: string, user: AuthUser) {
    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        assessment: {
          include: {
            company: true,
            problems: {
              include: {
                problem: {
                  include: {
                    options: true,
                  },
                },
              },
              orderBy: {
                order: "asc",
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
      throw notFound("Attempt not found");
    }

    const isOwnerRecruiter =
      isRecruiter(user) && attempt.assessment.company.ownerId === user.id;
    const isAttemptCandidate =
      isCandidate(user) && attempt.invitation.candidateId === user.id;

    if (!isAdmin(user) && !isOwnerRecruiter && !isAttemptCandidate) {
      throw forbidden("You cannot view this result");
    }

    if (isAttemptCandidate) {
      if (attempt.assessment.resultVisibility === ResultVisibility.HIDDEN) {
        throw forbidden("Result is hidden for this assessment");
      }

      if (
        attempt.assessment.resultVisibility === ResultVisibility.AFTER_REVIEW &&
        attempt.status !== "EVALUATED"
      ) {
        throw forbidden("Result will be available after recruiter review");
      }

      if (
        attempt.assessment.resultVisibility === ResultVisibility.IMMEDIATE &&
        attempt.status === "IN_PROGRESS"
      ) {
        throw forbidden("Result is not available before submission");
      }
    }

    const maxScore = attempt.assessment.problems.reduce(
      (sum, assessmentProblem) =>
        sum + getProblemMaxScore(assessmentProblem.problem),
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
      isFinal: attempt.status === "EVALUATED",
      answers: attempt.answers.map((answer) => ({
        id: answer.id,
        problemId: answer.problemId,
        problemType: answer.problem.type,
        score: answer.score,
        evaluatedAt: answer.evaluatedAt,
      })),
    };

    return isAttemptCandidate ? removeCorrectOptionFlags(result) : result;
  },

  async getAssessmentReport(assessmentId: string, user: AuthUser) {
    const assessment = await assertRecruiterOwnsAssessment(assessmentId, user);

    const [invited, started, submitted, evaluated, evaluatedAttempts] =
      await prisma.$transaction([
        prisma.invitation.count({
          where: { assessmentId },
        }),
        prisma.attempt.count({
          where: { assessmentId },
        }),
        prisma.attempt.count({
          where: {
            assessmentId,
            status: {
              in: ["SUBMITTED", "EVALUATED"],
            },
          },
        }),
        prisma.attempt.count({
          where: {
            assessmentId,
            status: "EVALUATED",
          },
        }),
        prisma.attempt.findMany({
          where: {
            assessmentId,
            status: "EVALUATED",
          },
          select: {
            id: true,
            score: true,
            percentage: true,
            passed: true,
          },
        }),
      ]);

    const percentageValues = evaluatedAttempts
      .map((attempt) => attempt.percentage)
      .filter((value): value is number => typeof value === "number");

    const averageScore =
      percentageValues.length === 0
        ? 0
        : Number(
            (
              percentageValues.reduce((sum, value) => sum + value, 0) /
              percentageValues.length
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
        passRate,
      },
    };
  },
};
