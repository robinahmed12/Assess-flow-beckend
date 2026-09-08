import {
  AssessmentStatus,
  AttemptStatus,
  InvitationStatus,
  PaymentStatus,
  Prisma,
  ResultVisibility,
  UserRole,
  UserStatus,
} from "@prisma/client";

import { AppError } from "../../app/common/errors/app-error";
import { prisma } from "../../lib/prisma";

export class DashboardService {
  private static getGroupCount<T extends string | boolean | null>(
    groups: Array<{
      status?: T;
      role?: T;
      passed?: T;
      _count: { _all: number };
    }>,
    field: "status" | "role" | "passed",
    value: T,
  ) {
    return (
      groups.find((item) => item[field] === value)?._count._all ?? 0
    );
  }

  private static calculatePercentage(value: number, total: number) {
    if (total <= 0) {
      return 0;
    }

    return Number(((value / total) * 100).toFixed(2));
  }

  private static toNumber(value: unknown) {
    if (value === null || value === undefined) {
      return 0;
    }

    return Number(value);
  }

  private static canCandidateSeeResult(attempt: {
    status: AttemptStatus;
    score: unknown | null;
    percentage: unknown | null;
    passed: boolean | null;
    assessment: {
      resultVisibility: ResultVisibility;
    };
  }) {
    if (
      attempt.assessment.resultVisibility === ResultVisibility.HIDDEN
    ) {
      return false;
    }

    if (
      attempt.assessment.resultVisibility ===
        ResultVisibility.AFTER_REVIEW &&
      attempt.status !== AttemptStatus.EVALUATED
    ) {
      return false;
    }

    if (
      attempt.assessment.resultVisibility ===
        ResultVisibility.IMMEDIATE &&
      attempt.status === AttemptStatus.IN_PROGRESS
    ) {
      return false;
    }

    return (
      attempt.score !== null &&
      attempt.percentage !== null &&
      attempt.passed !== null
    );
  }

  static async getCandidateDashboard(candidateId: string) {
    const now = new Date();

    // Keep candidate invitation status consistent with the candidate module.
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

    // Only use results that the candidate is actually allowed to see.
    const visibleResultWhere: Prisma.AttemptWhereInput = {
      invitation: {
        candidateId,
      },
      score: {
        not: null,
      },
      percentage: {
        not: null,
      },
      passed: {
        not: null,
      },
      OR: [
        {
          assessment: {
            resultVisibility: ResultVisibility.IMMEDIATE,
          },
          status: {
            in: [AttemptStatus.SUBMITTED, AttemptStatus.EVALUATED],
          },
        },
        {
          assessment: {
            resultVisibility: ResultVisibility.AFTER_REVIEW,
          },
          status: AttemptStatus.EVALUATED,
        },
      ],
    };

    const [
      invitationStatusGroups,
      attemptStatusGroups,
      resultAggregate,
      resultOutcomeGroups,
      recentAttempts,
      upcomingInvitations,
      performanceAttempts,
    ] = await prisma.$transaction([
      prisma.invitation.groupBy({
        by: ["status"],
        where: {
          candidateId,
        },
        _count: {
          _all: true,
        },
      }),

      prisma.attempt.groupBy({
        by: ["status"],
        where: {
          invitation: {
            candidateId,
          },
        },
        _count: {
          _all: true,
        },
      }),

      prisma.attempt.aggregate({
        where: visibleResultWhere,
        _count: {
          _all: true,
        },
        _avg: {
          score: true,
          percentage: true,
        },
      }),

      prisma.attempt.groupBy({
        by: ["passed"],
        where: visibleResultWhere,
        _count: {
          _all: true,
        },
      }),

      prisma.attempt.findMany({
        where: {
          invitation: {
            candidateId,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 5,
        select: {
          id: true,
          status: true,
          startedAt: true,
          expiresAt: true,
          submittedAt: true,
          score: true,
          percentage: true,
          passed: true,
          assessment: {
            select: {
              id: true,
              title: true,
              duration: true,
              resultVisibility: true,
            },
          },
        },
      }),

      prisma.invitation.findMany({
        where: {
          candidateId,
          status: InvitationStatus.PENDING,
          expiresAt: {
            gt: now,
          },
          assessment: {
            status: AssessmentStatus.PUBLISHED,
          },
        },
        orderBy: {
          expiresAt: "asc",
        },
        take: 5,
        select: {
          id: true,
          expiresAt: true,
          createdAt: true,
          assessment: {
            select: {
              id: true,
              title: true,
              description: true,
              duration: true,
            },
          },
        },
      }),

      prisma.attempt.findMany({
        where: visibleResultWhere,
        orderBy: {
          submittedAt: "desc",
        },
        take: 6,
        select: {
          id: true,
          score: true,
          percentage: true,
          passed: true,
          submittedAt: true,
          assessment: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      }),
    ]);

    const pendingInvitations = this.getGroupCount(
      invitationStatusGroups,
      "status",
      InvitationStatus.PENDING,
    );
    const acceptedInvitations = this.getGroupCount(
      invitationStatusGroups,
      "status",
      InvitationStatus.ACCEPTED,
    );
    const expiredInvitations = this.getGroupCount(
      invitationStatusGroups,
      "status",
      InvitationStatus.EXPIRED,
    );
    const revokedInvitations = this.getGroupCount(
      invitationStatusGroups,
      "status",
      InvitationStatus.REVOKED,
    );

    const totalInvitations = invitationStatusGroups.reduce(
      (total, item) => total + item._count._all,
      0,
    );
    const totalAssignments = totalInvitations - revokedInvitations;

    const inProgressAttempts = this.getGroupCount(
      attemptStatusGroups,
      "status",
      AttemptStatus.IN_PROGRESS,
    );
    const submittedAttempts = this.getGroupCount(
      attemptStatusGroups,
      "status",
      AttemptStatus.SUBMITTED,
    );
    const evaluatedAttempts = this.getGroupCount(
      attemptStatusGroups,
      "status",
      AttemptStatus.EVALUATED,
    );
    const expiredAttempts = this.getGroupCount(
      attemptStatusGroups,
      "status",
      AttemptStatus.EXPIRED,
    );

    const totalAttempts = attemptStatusGroups.reduce(
      (total, item) => total + item._count._all,
      0,
    );
    const completedAttempts = submittedAttempts + evaluatedAttempts;

    const passedAttempts = this.getGroupCount(
      resultOutcomeGroups,
      "passed",
      true,
    );
    const failedAttempts = this.getGroupCount(
      resultOutcomeGroups,
      "passed",
      false,
    );

    const averageScore = Number(
      this.toNumber(resultAggregate._avg.score).toFixed(2),
    );
    const averagePercentage = Number(
      this.toNumber(resultAggregate._avg.percentage).toFixed(2),
    );

    const formattedRecentAttempts = recentAttempts.map((attempt) => {
      const resultAvailable = this.canCandidateSeeResult(attempt);

      return {
        id: attempt.id,
        status: attempt.status,
        startedAt: attempt.startedAt,
        expiresAt: attempt.expiresAt,
        submittedAt: attempt.submittedAt,
        assessment: {
          id: attempt.assessment.id,
          title: attempt.assessment.title,
          duration: attempt.assessment.duration,
        },
        resultAvailable,
        score: resultAvailable ? attempt.score : null,
        percentage: resultAvailable ? attempt.percentage : null,
        passed: resultAvailable ? attempt.passed : null,
      };
    });

    return {
      overview: {
        totalAssignments,
        pendingInvitations,
        acceptedInvitations,
        expiredInvitations,
        totalAttempts,
        inProgressAttempts,
        submittedAttempts,
        evaluatedAttempts,
        expiredAttempts,
        completedAttempts,
        visibleResults: resultAggregate._count._all,
        passedAttempts,
        failedAttempts,
        averageScore,
        averagePercentage,
        startRate: this.calculatePercentage(totalAttempts, totalAssignments),
        completionRate: this.calculatePercentage(
          completedAttempts,
          totalAssignments,
        ),
        passRate: this.calculatePercentage(
          passedAttempts,
          passedAttempts + failedAttempts,
        ),
      },

      invitationBreakdown: {
        pending: pendingInvitations,
        accepted: acceptedInvitations,
        expired: expiredInvitations,
        revoked: revokedInvitations,
      },

      attemptBreakdown: {
        inProgress: inProgressAttempts,
        submitted: submittedAttempts,
        evaluated: evaluatedAttempts,
        expired: expiredAttempts,
      },

      upcomingAssessments: upcomingInvitations.map((invitation) => ({
        invitationId: invitation.id,
        invitedAt: invitation.createdAt,
        expiresAt: invitation.expiresAt,
        assessment: invitation.assessment,
      })),

      recentAttempts: formattedRecentAttempts,

      performanceTrend: performanceAttempts.reverse().map((attempt) => ({
        attemptId: attempt.id,
        assessment: attempt.assessment,
        score: attempt.score,
        percentage: attempt.percentage,
        passed: attempt.passed,
        submittedAt: attempt.submittedAt,
      })),
    };
  }

  static async getRecruiterDashboard(recruiterId: string) {
    const company = await prisma.company.findUnique({
      where: {
        ownerId: recruiterId,
      },
      select: {
        id: true,
        name: true,
        credits: true,
      },
    });

    if (!company) {
      throw new AppError("Company not found for this recruiter", 404);
    }

    const evaluatedAttemptWhere: Prisma.AttemptWhereInput = {
      assessment: {
        companyId: company.id,
      },
      status: AttemptStatus.EVALUATED,
      score: {
        not: null,
      },
      percentage: {
        not: null,
      },
      passed: {
        not: null,
      },
    };

    const [
      assessmentStatusGroups,
      invitationStatusGroups,
      attemptStatusGroups,
      evaluatedAggregate,
      outcomeGroups,
      recentSubmissions,
      paymentAggregate,
      assessmentPerformanceGroups,
    ] = await prisma.$transaction([
      prisma.assessment.groupBy({
        by: ["status"],
        where: {
          companyId: company.id,
        },
        _count: {
          _all: true,
        },
      }),

      prisma.invitation.groupBy({
        by: ["status"],
        where: {
          assessment: {
            companyId: company.id,
          },
        },
        _count: {
          _all: true,
        },
      }),

      prisma.attempt.groupBy({
        by: ["status"],
        where: {
          assessment: {
            companyId: company.id,
          },
        },
        _count: {
          _all: true,
        },
      }),

      prisma.attempt.aggregate({
        where: evaluatedAttemptWhere,
        _count: {
          _all: true,
        },
        _avg: {
          score: true,
          percentage: true,
        },
      }),

      prisma.attempt.groupBy({
        by: ["passed"],
        where: evaluatedAttemptWhere,
        _count: {
          _all: true,
        },
      }),

      prisma.attempt.findMany({
        where: {
          assessment: {
            companyId: company.id,
          },
          status: {
            in: [AttemptStatus.SUBMITTED, AttemptStatus.EVALUATED],
          },
        },
        orderBy: {
          submittedAt: "desc",
        },
        take: 8,
        select: {
          id: true,
          status: true,
          submittedAt: true,
          score: true,
          percentage: true,
          passed: true,
          assessment: {
            select: {
              id: true,
              title: true,
            },
          },
          invitation: {
            select: {
              candidateEmail: true,
              candidate: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      }),

      prisma.payment.aggregate({
        where: {
          companyId: company.id,
          status: PaymentStatus.SUCCEEDED,
        },
        _count: {
          _all: true,
        },
        _sum: {
          amount: true,
          creditsGranted: true,
        },
      }),

      prisma.attempt.groupBy({
        by: ["assessmentId"],
        where: evaluatedAttemptWhere,
        _count: {
          _all: true,
        },
        _avg: {
          score: true,
          percentage: true,
        },
        orderBy: {
          _avg: {
            percentage: "desc",
          },
        },
        take: 5,
      }),
    ]);

    const topAssessmentIds = assessmentPerformanceGroups.map(
      (item) => item.assessmentId,
    );

    const topAssessments = topAssessmentIds.length
      ? await prisma.assessment.findMany({
          where: {
            id: {
              in: topAssessmentIds,
            },
            companyId: company.id,
          },
          select: {
            id: true,
            title: true,
            status: true,
            passingScore: true,
          },
        })
      : [];

    const assessmentTitleMap = new Map(
      topAssessments.map((assessment) => [assessment.id, assessment]),
    );

    const draftAssessments = this.getGroupCount(
      assessmentStatusGroups,
      "status",
      AssessmentStatus.DRAFT,
    );
    const publishedAssessments = this.getGroupCount(
      assessmentStatusGroups,
      "status",
      AssessmentStatus.PUBLISHED,
    );
    const closedAssessments = this.getGroupCount(
      assessmentStatusGroups,
      "status",
      AssessmentStatus.CLOSED,
    );
    const archivedAssessments = this.getGroupCount(
      assessmentStatusGroups,
      "status",
      AssessmentStatus.ARCHIVED,
    );

    const totalAssessments = assessmentStatusGroups.reduce(
      (total, item) => total + item._count._all,
      0,
    );

    const pendingInvitations = this.getGroupCount(
      invitationStatusGroups,
      "status",
      InvitationStatus.PENDING,
    );
    const acceptedInvitations = this.getGroupCount(
      invitationStatusGroups,
      "status",
      InvitationStatus.ACCEPTED,
    );
    const expiredInvitations = this.getGroupCount(
      invitationStatusGroups,
      "status",
      InvitationStatus.EXPIRED,
    );
    const revokedInvitations = this.getGroupCount(
      invitationStatusGroups,
      "status",
      InvitationStatus.REVOKED,
    );

    const totalInvitations = invitationStatusGroups.reduce(
      (total, item) => total + item._count._all,
      0,
    );
    const actionableInvitations = totalInvitations - revokedInvitations;

    const inProgressAttempts = this.getGroupCount(
      attemptStatusGroups,
      "status",
      AttemptStatus.IN_PROGRESS,
    );
    const submittedAttempts = this.getGroupCount(
      attemptStatusGroups,
      "status",
      AttemptStatus.SUBMITTED,
    );
    const evaluatedAttempts = this.getGroupCount(
      attemptStatusGroups,
      "status",
      AttemptStatus.EVALUATED,
    );
    const expiredAttempts = this.getGroupCount(
      attemptStatusGroups,
      "status",
      AttemptStatus.EXPIRED,
    );

    const totalAttempts = attemptStatusGroups.reduce(
      (total, item) => total + item._count._all,
      0,
    );
    const completedAttempts = submittedAttempts + evaluatedAttempts;

    const passedAttempts = this.getGroupCount(
      outcomeGroups,
      "passed",
      true,
    );
    const failedAttempts = this.getGroupCount(
      outcomeGroups,
      "passed",
      false,
    );

    return {
      company: {
        id: company.id,
        name: company.name,
        creditsAvailable: company.credits,
      },

      overview: {
        totalAssessments,
        publishedAssessments,
        totalInvitations,
        totalAttempts,
        inProgressAttempts,
        pendingEvaluations: submittedAttempts,
        evaluatedAttempts,
        averageScore: Number(
          this.toNumber(evaluatedAggregate._avg.score).toFixed(2),
        ),
        averagePercentage: Number(
          this.toNumber(evaluatedAggregate._avg.percentage).toFixed(2),
        ),
        passedAttempts,
        failedAttempts,
        passRate: this.calculatePercentage(
          passedAttempts,
          passedAttempts + failedAttempts,
        ),
        candidateStartRate: this.calculatePercentage(
          totalAttempts,
          actionableInvitations,
        ),
        submissionRate: this.calculatePercentage(
          completedAttempts,
          totalAttempts,
        ),
        evaluationRate: this.calculatePercentage(
          evaluatedAttempts,
          completedAttempts,
        ),
      },

      assessmentBreakdown: {
        draft: draftAssessments,
        published: publishedAssessments,
        closed: closedAssessments,
        archived: archivedAssessments,
      },

      invitationBreakdown: {
        pending: pendingInvitations,
        accepted: acceptedInvitations,
        expired: expiredInvitations,
        revoked: revokedInvitations,
      },

      attemptBreakdown: {
        inProgress: inProgressAttempts,
        submitted: submittedAttempts,
        evaluated: evaluatedAttempts,
        expired: expiredAttempts,
      },

      paymentSummary: {
        successfulPayments: paymentAggregate._count._all,
        totalSpent: Number(
          this.toNumber(paymentAggregate._sum.amount).toFixed(2),
        ),
        creditsPurchased: this.toNumber(
          paymentAggregate._sum.creditsGranted,
        ),
      },

      recentSubmissions: recentSubmissions.map((attempt) => ({
        attemptId: attempt.id,
        status: attempt.status,
        submittedAt: attempt.submittedAt,
        score: attempt.score,
        percentage: attempt.percentage,
        passed: attempt.passed,
        assessment: attempt.assessment,
        candidate: attempt.invitation.candidate,
        candidateEmail: attempt.invitation.candidateEmail,
      })),

      assessmentPerformance: assessmentPerformanceGroups.map((item) => ({
        assessment: assessmentTitleMap.get(item.assessmentId) ?? {
          id: item.assessmentId,
          title: "Unknown assessment",
        },
        evaluatedAttempts: item._count._all,
        averageScore: Number(
          this.toNumber(item._avg.score).toFixed(2),
        ),
        averagePercentage: Number(
          this.toNumber(item._avg.percentage).toFixed(2),
        ),
      })),
    };
  }

  static async getAdminDashboard() {
    const [
      userRoleGroups,
      userStatusGroups,
      companyAggregate,
      assessmentStatusGroups,
      attemptStatusGroups,
      evaluatedAggregate,
      outcomeGroups,
      paymentStatusGroups,
      successfulPaymentAggregate,
      auditLogCount,
      recentUsers,
      recentPayments,
    ] = await prisma.$transaction([
      prisma.user.groupBy({
        by: ["role"],
        _count: {
          _all: true,
        },
      }),

      prisma.user.groupBy({
        by: ["status"],
        _count: {
          _all: true,
        },
      }),

      prisma.company.aggregate({
        _count: {
          _all: true,
        },
        _sum: {
          credits: true,
        },
      }),

      prisma.assessment.groupBy({
        by: ["status"],
        _count: {
          _all: true,
        },
      }),

      prisma.attempt.groupBy({
        by: ["status"],
        _count: {
          _all: true,
        },
      }),

      prisma.attempt.aggregate({
        where: {
          status: AttemptStatus.EVALUATED,
          score: {
            not: null,
          },
          percentage: {
            not: null,
          },
        },
        _count: {
          _all: true,
        },
        _avg: {
          score: true,
          percentage: true,
        },
      }),

      prisma.attempt.groupBy({
        by: ["passed"],
        where: {
          status: AttemptStatus.EVALUATED,
          passed: {
            not: null,
          },
        },
        _count: {
          _all: true,
        },
      }),

      prisma.payment.groupBy({
        by: ["status"],
        _count: {
          _all: true,
        },
        _sum: {
          amount: true,
        },
      }),

      prisma.payment.aggregate({
        where: {
          status: PaymentStatus.SUCCEEDED,
        },
        _count: {
          _all: true,
        },
        _sum: {
          amount: true,
          creditsGranted: true,
        },
      }),

      prisma.auditLog.count(),

      prisma.user.findMany({
        orderBy: {
          createdAt: "desc",
        },
        take: 8,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
        },
      }),

      prisma.payment.findMany({
        orderBy: {
          createdAt: "desc",
        },
        take: 8,
        select: {
          id: true,
          companyId: true,
          recruiterId: true,
          providerReference: true,
          status: true,
          amount: true,
          creditsGranted: true,
          createdAt: true,
          completedAt: true,
        },
      }),
    ]);

    const adminUsers = this.getGroupCount(
      userRoleGroups,
      "role",
      UserRole.ADMIN,
    );
    const recruiterUsers = this.getGroupCount(
      userRoleGroups,
      "role",
      UserRole.RECRUITER,
    );
    const candidateUsers = this.getGroupCount(
      userRoleGroups,
      "role",
      UserRole.CANDIDATE,
    );

    const totalUsers = userRoleGroups.reduce(
      (total, item) => total + item._count._all,
      0,
    );
    const activeUsers = this.getGroupCount(
      userStatusGroups,
      "status",
      UserStatus.ACTIVE,
    );

    const draftAssessments = this.getGroupCount(
      assessmentStatusGroups,
      "status",
      AssessmentStatus.DRAFT,
    );
    const publishedAssessments = this.getGroupCount(
      assessmentStatusGroups,
      "status",
      AssessmentStatus.PUBLISHED,
    );
    const closedAssessments = this.getGroupCount(
      assessmentStatusGroups,
      "status",
      AssessmentStatus.CLOSED,
    );
    const archivedAssessments = this.getGroupCount(
      assessmentStatusGroups,
      "status",
      AssessmentStatus.ARCHIVED,
    );

    const totalAssessments = assessmentStatusGroups.reduce(
      (total, item) => total + item._count._all,
      0,
    );

    const inProgressAttempts = this.getGroupCount(
      attemptStatusGroups,
      "status",
      AttemptStatus.IN_PROGRESS,
    );
    const submittedAttempts = this.getGroupCount(
      attemptStatusGroups,
      "status",
      AttemptStatus.SUBMITTED,
    );
    const evaluatedAttempts = this.getGroupCount(
      attemptStatusGroups,
      "status",
      AttemptStatus.EVALUATED,
    );
    const expiredAttempts = this.getGroupCount(
      attemptStatusGroups,
      "status",
      AttemptStatus.EXPIRED,
    );

    const totalAttempts = attemptStatusGroups.reduce(
      (total, item) => total + item._count._all,
      0,
    );

    const passedAttempts = this.getGroupCount(
      outcomeGroups,
      "passed",
      true,
    );
    const failedAttempts = this.getGroupCount(
      outcomeGroups,
      "passed",
      false,
    );

    return {
      overview: {
        totalUsers,
        activeUsers,
        inactiveUsers: Math.max(totalUsers - activeUsers, 0),
        totalCompanies: companyAggregate._count._all,
        totalPlatformCredits: this.toNumber(companyAggregate._sum.credits),
        totalAssessments,
        totalAttempts,
        pendingEvaluations: submittedAttempts,
        evaluatedAttempts,
        totalAuditLogs: auditLogCount,
        successfulPayments: successfulPaymentAggregate._count._all,
        totalRevenue: Number(
          this.toNumber(successfulPaymentAggregate._sum.amount).toFixed(2),
        ),
        totalCreditsSold: this.toNumber(
          successfulPaymentAggregate._sum.creditsGranted,
        ),
      },

      userBreakdown: {
        byRole: {
          admin: adminUsers,
          recruiter: recruiterUsers,
          candidate: candidateUsers,
        },
        byStatus: Object.fromEntries(
          userStatusGroups.map((item) => [item.status, item._count._all]),
        ),
      },

      assessmentBreakdown: {
        draft: draftAssessments,
        published: publishedAssessments,
        closed: closedAssessments,
        archived: archivedAssessments,
      },

      attemptBreakdown: {
        inProgress: inProgressAttempts,
        submitted: submittedAttempts,
        evaluated: evaluatedAttempts,
        expired: expiredAttempts,
        averageScore: Number(
          this.toNumber(evaluatedAggregate._avg!.score).toFixed(2),
        ),
        averagePercentage: Number(
          this.toNumber(evaluatedAggregate._avg!.percentage).toFixed(2),
        ),
        passed: passedAttempts,
        failed: failedAttempts,
        passRate: this.calculatePercentage(
          passedAttempts,
          passedAttempts + failedAttempts,
        ),
      },

      paymentBreakdown: paymentStatusGroups.map((item) => ({
        status: item.status,
        count: item._count._all,
        amount: Number(this.toNumber(item._sum.amount).toFixed(2)),
      })),

      recentUsers,

      recentPayments: recentPayments.map((payment) => ({
        ...payment,
        amount: this.toNumber(payment.amount),
      })),
    };
  }
}
