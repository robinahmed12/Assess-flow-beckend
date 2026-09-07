import {
  AssessmentStatus,
  AttemptStatus,
  InvitationStatus,
  PaymentStatus,
  Prisma,
  UserRole,
  UserStatus,
} from "@prisma/client";

import { prisma } from "../../lib/prisma";
import { adminErrors } from "./admin.errors";
import {
  AdminPaymentsQuery,
  AuditLogsQuery,
  ListUsersQuery,
  PaginatedResult,
  UpdateUserStatusBody,
} from "./admin.types";
import { AuditService } from "../audit";

const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

const getPagination = (page = 1, limit = 20) => {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const skip = (safePage - 1) * safeLimit;

  return {
    page: safePage,
    limit: safeLimit,
    skip,
  };
};

const getTotalPages = (total: number, limit: number) => {
  if (total === 0) {
    return 0;
  }

  return Math.ceil(total / limit);
};

const decimalToNumber = (value: unknown): number => {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  if (
    typeof value === "object" &&
    "toNumber" in value &&
    typeof value.toNumber === "function"
  ) {
    return value.toNumber();
  }

  return Number(value);
};

export class AdminService {
  static async listUsers(
    query: ListUsersQuery,
  ): Promise<PaginatedResult<unknown>> {
    const { page, limit, skip } = getPagination(query.page, query.limit);

    const sortBy = query.sortBy ?? "createdAt";
    const sortOrder = query.sortOrder ?? "desc";

    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),

      ...(query.status ? { status: query.status } : {}),

      ...(query.q
        ? {
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
          }
        : {}),
    };

    const [data, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        select: safeUserSelect,
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip,
        take: limit,
      }),

      prisma.user.count({
        where,
      }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: getTotalPages(total, limit),
      },
    };
  }

  static async updateUserStatus(
    actorId: string,
    targetUserId: string,
    payload: UpdateUserStatusBody,
  ) {
    if (actorId === targetUserId) {
      throw adminErrors.cannotUpdateSelf();
    }

    const targetUser = await prisma.user.findUnique({
      where: {
        id: targetUserId,
      },
      select: safeUserSelect,
    });

    if (!targetUser) {
      throw adminErrors.userNotFound();
    }

    return prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: {
          id: targetUserId,
        },
        data: {
          status: payload.status,
        },
        select: safeUserSelect,
      });

      await AuditService.create(tx, {
        actorId,
        action: "ADMIN_USER_STATUS_UPDATED",
        entityType: "User",
        entityId: targetUserId,
        metadata: {
          previousStatus: targetUser.status,
          nextStatus: payload.status,
        },
      });

      return updatedUser;
    });
  }

  static async getDashboardStats() {
    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      admins,
      recruiters,
      candidates,

      totalCompanies,

      totalProblems,

      totalAssessments,
      draftAssessments,
      publishedAssessments,
      closedAssessments,
      archivedAssessments,

      totalInvitations,
      pendingInvitations,
      acceptedInvitations,
      revokedInvitations,

      totalAttempts,
      inProgressAttempts,
      submittedAttempts,
      evaluatedAttempts,
      expiredAttempts,

      totalPayments,
      succeededPayments,
      failedPayments,
      pendingPayments,

      paymentsAggregate,
    ] = await prisma.$transaction([
      prisma.user.count(),
      prisma.user.count({
        where: {
          status: UserStatus.ACTIVE,
        },
      }),
      prisma.user.count({
        where: {
          status: UserStatus.SUSPENDED,
        },
      }),
      prisma.user.count({
        where: {
          role: UserRole.ADMIN,
        },
      }),
      prisma.user.count({
        where: {
          role: UserRole.RECRUITER,
        },
      }),
      prisma.user.count({
        where: {
          role: UserRole.CANDIDATE,
        },
      }),

      prisma.company.count(),

      prisma.problem.count(),

      prisma.assessment.count(),
      prisma.assessment.count({
        where: {
          status: AssessmentStatus.DRAFT,
        },
      }),
      prisma.assessment.count({
        where: {
          status: AssessmentStatus.PUBLISHED,
        },
      }),
      prisma.assessment.count({
        where: {
          status: AssessmentStatus.CLOSED,
        },
      }),
      prisma.assessment.count({
        where: {
          status: AssessmentStatus.ARCHIVED,
        },
      }),

      prisma.invitation.count(),
      prisma.invitation.count({
        where: {
          status: InvitationStatus.PENDING,
        },
      }),
      prisma.invitation.count({
        where: {
          status: InvitationStatus.ACCEPTED,
        },
      }),
      prisma.invitation.count({
        where: {
          status: InvitationStatus.REVOKED,
        },
      }),

      prisma.attempt.count(),
      prisma.attempt.count({
        where: {
          status: AttemptStatus.IN_PROGRESS,
        },
      }),
      prisma.attempt.count({
        where: {
          status: AttemptStatus.SUBMITTED,
        },
      }),
      prisma.attempt.count({
        where: {
          status: AttemptStatus.EVALUATED,
        },
      }),
      prisma.attempt.count({
        where: {
          status: AttemptStatus.EXPIRED,
        },
      }),

      prisma.payment.count(),
      prisma.payment.count({
        where: {
          status: PaymentStatus.SUCCEEDED,
        },
      }),
      prisma.payment.count({
        where: {
          status: PaymentStatus.FAILED,
        },
      }),
      prisma.payment.count({
        where: {
          status: PaymentStatus.PENDING,
        },
      }),

      prisma.payment.aggregate({
        where: {
          status: PaymentStatus.SUCCEEDED,
        },
        _sum: {
          amount: true,
          creditsPurchased: true,
        },
      }),
    ]);

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        suspended: suspendedUsers,
        byRole: {
          admin: admins,
          recruiter: recruiters,
          candidate: candidates,
        },
      },

      companies: {
        total: totalCompanies,
      },

      problems: {
        total: totalProblems,
      },

      assessments: {
        total: totalAssessments,
        draft: draftAssessments,
        published: publishedAssessments,
        closed: closedAssessments,
        archived: archivedAssessments,
      },

      invitations: {
        total: totalInvitations,
        pending: pendingInvitations,
        accepted: acceptedInvitations,
        revoked: revokedInvitations,
      },

      attempts: {
        total: totalAttempts,
        inProgress: inProgressAttempts,
        submitted: submittedAttempts,
        evaluated: evaluatedAttempts,
        expired: expiredAttempts,
      },

      payments: {
        total: totalPayments,
        pending: pendingPayments,
        succeeded: succeededPayments,
        failed: failedPayments,
        successfulAmount: decimalToNumber(paymentsAggregate._sum.amount),
        creditsPurchased: paymentsAggregate._sum.creditsPurchased ?? 0,
      },
    };
  }

  static async listAuditLogs(
    query: AuditLogsQuery,
  ): Promise<PaginatedResult<unknown>> {
    const { page, limit, skip } = getPagination(query.page, query.limit);

    const sortOrder = query.sortOrder ?? "desc";

    const where: Prisma.AuditLogWhereInput = {
      ...(query.actorId
        ? {
            actorId: query.actorId,
          }
        : {}),

      ...(query.action
        ? {
            action: {
              contains: query.action,
              mode: "insensitive",
            },
          }
        : {}),

      ...(query.entityType
        ? {
            entityType: {
              contains: query.entityType,
              mode: "insensitive",
            },
          }
        : {}),

      ...(query.entityId
        ? {
            entityId: query.entityId,
          }
        : {}),

      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from
                ? {
                    gte: new Date(query.from),
                  }
                : {}),

              ...(query.to
                ? {
                    lte: new Date(query.to),
                  }
                : {}),
            },
          }
        : {}),
    };

    const [data, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        include: {
          actor: {
            select: safeUserSelect,
          },
        },
        orderBy: {
          createdAt: sortOrder,
        },
        skip,
        take: limit,
      }),

      prisma.auditLog.count({
        where,
      }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: getTotalPages(total, limit),
      },
    };
  }

  static async listPayments(
    query: AdminPaymentsQuery,
  ): Promise<PaginatedResult<unknown>> {
    const { page, limit, skip } = getPagination(query.page, query.limit);

    const sortOrder = query.sortOrder ?? "desc";

    const where: Prisma.PaymentWhereInput = {
      ...(query.status
        ? {
            status: query.status as PaymentStatus,
          }
        : {}),

      ...(query.companyId
        ? {
            companyId: query.companyId,
          }
        : {}),
    };

    const [payments, total] = await prisma.$transaction([
      prisma.payment.findMany({
        where,
        include: {
          company: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
        orderBy: {
          createdAt: sortOrder,
        },
        skip,
        take: limit,
      }),

      prisma.payment.count({
        where,
      }),
    ]);

    const data = payments.map((payment) => ({
      ...payment,
      amount: decimalToNumber(payment.amount),
    }));

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: getTotalPages(total, limit),
      },
    };
  }
}
