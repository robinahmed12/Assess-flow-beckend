import { AppError } from "../../app/common/errors/app-error";
import { prisma } from "../../lib/prisma";
import { AttemptStatus, InvitationStatus } from "@prisma/client";

export class CandidateService {
  static async findMyAssessments(candidateId: string) {
    const now = new Date();

    // Mark expired pending invitations
    await prisma.invitation.updateMany({
      where: {
        candidateId,
        status: InvitationStatus.PENDING,
        expiresAt: {
          lte: now,
        },
      },
      data: {
        status: InvitationStatus.EXPIRED,
      },
    });

    return prisma.invitation.findMany({
      where: {
        candidateId,
        status: {
          not: InvitationStatus.REVOKED,
        },
      },

      include: {
        assessment: {
          select: {
            id: true,
            title: true,
            description: true,
            duration: true,
            passingScore: true,
            status: true,
          },
        },

        attempt: {
          select: {
            id: true,
            status: true,
            startedAt: true,
            expiresAt: true,
            submittedAt: true,
            score: true,
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });
  }

  private static formatAttemptForCandidate(attempt: any) {
    return {
      id: attempt.id,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      status: attempt.status,

      assessment: {
        id: attempt.invitation.assessment.id,
        title: attempt.invitation.assessment.title,
        description: attempt.invitation.assessment.description,
        duration: attempt.invitation.assessment.duration,

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
            // Never expose option.isCorrect
          })),
        })),
      },
    };
  }

  static async startAssessment(candidateId: string, assessmentId: string) {
    const invitation = await prisma.invitation.findFirst({
      where: {
        candidateId,
        assessmentId,
      },

      include: {
        assessment: true,
        attempt: true,
      },
    });

    if (!invitation) {
      throw new AppError("Assessment invitation not found", 404);
    }

    if (invitation.status === InvitationStatus.REVOKED) {
      throw new AppError("This assessment invitation was revoked", 400);
    }

    if (invitation.attempt?.status === AttemptStatus.SUBMITTED) {
      throw new AppError("This assessment has already been completed", 400);
    }

    const now = new Date();

    if (invitation.expiresAt && invitation.expiresAt <= now) {
      await prisma.invitation.update({
        where: {
          id: invitation.id,
        },

        data: {
          status: InvitationStatus.EXPIRED,
        },
      });

      throw new AppError("This assessment invitation has expired", 400);
    }

    /*
     * If the candidate already started the assessment,
     * return the existing attempt.
     */
    if (invitation.attempt) {
      if (invitation.attempt.status === AttemptStatus.IN_PROGRESS) {
        return this.getAttemptForCandidate(invitation.attempt.id);
      }

      throw new AppError("Assessment attempt cannot be started again", 400);
    }

    const durationMilliseconds = invitation.assessment.duration * 60 * 1000;

    const calculatedExpiresAt = new Date(now.getTime() + durationMilliseconds);

    const attemptExpiresAt =
      invitation.expiresAt && invitation.expiresAt < calculatedExpiresAt
        ? invitation.expiresAt
        : calculatedExpiresAt;

    const attempt = await prisma.$transaction(async (tx) => {
      const createdAttempt = await tx.attempt.create({
        data: {
          invitationId: invitation.id,
          assessmentId: invitation.assessmentId,
          startedAt: new Date(),
          expiresAt: attemptExpiresAt,
          status: AttemptStatus.IN_PROGRESS,
        },
      });

      await tx.invitation.update({
        where: {
          id: invitation.id,
        },
        data: {
          status: InvitationStatus.ACCEPTED,
        },
      });

      return createdAttempt;
    });

    return this.getAttemptForCandidate(attempt.id);
  }
  private static async getAttemptForCandidate(attemptId: string) {
    const attempt = await prisma.attempt.findUnique({
      where: {
        id: attemptId,
      },

      include: {
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
      throw new AppError("Assessment attempt not found", 404);
    }

    return CandidateService.formatAttemptForCandidate(attempt);
  }
}
