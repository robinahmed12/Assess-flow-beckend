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

const DASHBOARD_STATS_TRANSACTION_OPTIONS = {
  timeout: 30_000,
  maxWait: 10_000,
} as const;

/**
 * Flattens a Prisma `groupBy` result into a plain `{ value: count }` map so each
 * breakdown can be read by enum key instead of scanning the raw row array.
 */
interface GroupedCountRow {
  _count?: { _all?: number };
  [key: string]: unknown;
}

const toCountMap = <TKey extends string>(
  rows: ReadonlyArray<GroupedCountRow>,
  key: TKey,
): Record<string, number> => {
  const counts: Record<string, number> = {};

  for (const row of rows) {
    const value = row[key];

    if (typeof value !== "string") continue;

    const count = row._count?._all ?? 0;

    counts[value] = typeof count === "number" ? count : 0;
  }

  return counts;
};

const sumCounts = (counts: Record<string, number>): number =>
  Object.values(counts).reduce((total, count) => total + count, 0);

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
      usersByStatus,
      usersByRole,
      totalCompanies,
      totalProblems,
      assessmentsByStatus,
      invitationsByStatus,
      attemptsByStatus,
      paymentsByStatus,
      succeededPayments,
    ] = await prisma.$transaction(
      [
        prisma.user.groupBy({ by: ["status"], _count: { _all: true } }),
        prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
        prisma.company.count(),
        prisma.problem.count(),
        prisma.assessment.groupBy({ by: ["status"], _count: { _all: true } }),
        prisma.invitation.groupBy({ by: ["status"], _count: { _all: true } }),
        prisma.attempt.groupBy({ by: ["status"], _count: { _all: true } }),
        prisma.payment.groupBy({ by: ["status"], _count: { _all: true } }),
        prisma.payment.aggregate({
          where: { status: PaymentStatus.SUCCEEDED },
          _sum: { amount: true, creditsPurchased: true },
        }),
      ],
      DASHBOARD_STATS_TRANSACTION_OPTIONS,
    );

    const userStatusCounts = toCountMap(usersByStatus, "status");
    const userRoleCounts = toCountMap(usersByRole, "role");
    const assessmentCounts = toCountMap(assessmentsByStatus, "status");
    const invitationCounts = toCountMap(invitationsByStatus, "status");
    const attemptCounts = toCountMap(attemptsByStatus, "status");
    const paymentCounts = toCountMap(paymentsByStatus, "status");

    return {
      users: {
        total: sumCounts(userStatusCounts),
        active: userStatusCounts[UserStatus.ACTIVE] ?? 0,
        suspended: userStatusCounts[UserStatus.SUSPENDED] ?? 0,
        byRole: {
          admin: userRoleCounts[UserRole.ADMIN] ?? 0,
          recruiter: userRoleCounts[UserRole.RECRUITER] ?? 0,
          candidate: userRoleCounts[UserRole.CANDIDATE] ?? 0,
        },
      },

      companies: {
        total: totalCompanies,
      },

      problems: {
        total: totalProblems,
      },

      assessments: {
        total: sumCounts(assessmentCounts),
        draft: assessmentCounts[AssessmentStatus.DRAFT] ?? 0,
        published: assessmentCounts[AssessmentStatus.PUBLISHED] ?? 0,
        closed: assessmentCounts[AssessmentStatus.CLOSED] ?? 0,
        archived: assessmentCounts[AssessmentStatus.ARCHIVED] ?? 0,
      },

      invitations: {
        total: sumCounts(invitationCounts),
        pending: invitationCounts[InvitationStatus.PENDING] ?? 0,
        accepted: invitationCounts[InvitationStatus.ACCEPTED] ?? 0,
        revoked: invitationCounts[InvitationStatus.REVOKED] ?? 0,
      },

      attempts: {
        total: sumCounts(attemptCounts),
        inProgress: attemptCounts[AttemptStatus.IN_PROGRESS] ?? 0,
        submitted: attemptCounts[AttemptStatus.SUBMITTED] ?? 0,
        evaluated: attemptCounts[AttemptStatus.EVALUATED] ?? 0,
        expired: attemptCounts[AttemptStatus.EXPIRED] ?? 0,
      },

      payments: {
        total: sumCounts(paymentCounts),
        pending: paymentCounts[PaymentStatus.PENDING] ?? 0,
        succeeded: paymentCounts[PaymentStatus.SUCCEEDED] ?? 0,
        failed: paymentCounts[PaymentStatus.FAILED] ?? 0,
        successfulAmount: decimalToNumber(succeededPayments._sum.amount),
        creditsPurchased: succeededPayments._sum.creditsPurchased ?? 0,
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
