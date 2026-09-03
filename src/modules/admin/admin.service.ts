import { Prisma, UserStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { adminErrors } from "./admin.errors";
import {
  AdminPaymentsQuery,
  AuditLogsQuery,
  ListUsersQuery,
  PaginatedResult,
  UpdateUserStatusBody,
} from "./admin.types";

const toPositiveInt = (value: unknown, fallback: number, max: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(Math.floor(parsed), max);
};

const getPagination = (pageValue?: number, limitValue?: number) => {
  const page = toPositiveInt(pageValue, 1, 100000);
  const limit = toPositiveInt(limitValue, 20, 100);
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

const getTotalPages = (total: number, limit: number): number => {
  if (total === 0) return 0;
  return Math.ceil(total / limit);
};

const decimalToNumber = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") {
    return value.toNumber();
  }
  return Number(value);
};

const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export const AdminService = {
  async listUsers(query: ListUsersQuery): Promise<PaginatedResult<unknown>> {
    const { page, limit, skip } = getPagination(query.page, query.limit);
    const sortBy = query.sortBy ?? "createdAt";
    const sortOrder = query.sortOrder ?? "desc";

    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" } },
              { email: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        select: safeUserSelect,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: getTotalPages(total, limit),
      },
    };
  },

  async updateUserStatus(actorId: string, targetUserId: string, payload: UpdateUserStatusBody) {
    if (actorId === targetUserId) {
      throw adminErrors.cannotUpdateSelf();
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: safeUserSelect,
    });

    if (!targetUser) {
      throw adminErrors.userNotFound();
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: targetUserId },
        data: { status: payload.status },
        select: safeUserSelect,
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: "ADMIN_USER_STATUS_UPDATED",
          entityType: "User",
          entityId: targetUserId,
          metadata: {
            previousStatus: targetUser.status,
            nextStatus: payload.status,
          },
        },
      });

      return updatedUser;
    });

    return result;
  },

  async getDashboardStats() {
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
      prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      prisma.user.count({ where: { status: UserStatus.SUSPENDED } }),
      prisma.user.count({ where: { role: "ADMIN" as any } }),
      prisma.user.count({ where: { role: "RECRUITER" as any } }),
      prisma.user.count({ where: { role: "CANDIDATE" as any } }),
      prisma.company.count(),
      prisma.problem.count(),
      prisma.assessment.count(),
      prisma.assessment.count({ where: { status: "DRAFT" as any } }),
      prisma.assessment.count({ where: { status: "PUBLISHED" as any } }),
      prisma.assessment.count({ where: { status: "CLOSED" as any } }),
      prisma.assessment.count({ where: { status: "ARCHIVED" as any } }),
      prisma.invitation.count(),
      prisma.invitation.count({ where: { status: "PENDING" as any } }),
      prisma.invitation.count({ where: { status: "ACCEPTED" as any } }),
      prisma.invitation.count({ where: { status: "REVOKED" as any } }),
      prisma.attempt.count(),
      prisma.attempt.count({ where: { status: "IN_PROGRESS" as any } }),
      prisma.attempt.count({ where: { status: "SUBMITTED" as any } }),
      prisma.attempt.count({ where: { status: "EVALUATED" as any } }),
      prisma.attempt.count({ where: { status: "EXPIRED" as any } }),
      prisma.payment.count(),
      prisma.payment.count({ where: { status: "SUCCEEDED" as any } }),
      prisma.payment.count({ where: { status: "FAILED" as any } }),
      prisma.payment.count({ where: { status: "PENDING" as any } }),
      prisma.payment.aggregate({
        where: { status: "SUCCEEDED" as any },
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
  },

  async listAuditLogs(query: AuditLogsQuery): Promise<PaginatedResult<unknown>> {
    const { page, limit, skip } = getPagination(query.page, query.limit);
    const sortOrder = query.sortOrder ?? "desc";

    const where: Prisma.AuditLogWhereInput = {
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.action ? { action: { contains: query.action, mode: "insensitive" } } : {}),
      ...(query.entityType ? { entityType: { contains: query.entityType, mode: "insensitive" } } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...((query.from || query.to)
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        include: {
          actor: {
            select: safeUserSelect,
          },
        },
        orderBy: { createdAt: sortOrder },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: getTotalPages(total, limit),
      },
    };
  },

  async listPayments(query: AdminPaymentsQuery): Promise<PaginatedResult<unknown>> {
    const { page, limit, skip } = getPagination(query.page, query.limit);
    const sortOrder = query.sortOrder ?? "desc";

    const where: Prisma.PaymentWhereInput = {
      ...(query.status ? { status: query.status as any } : {}),
      ...(query.companyId ? { companyId: query.companyId } : {}),
    };

    const [items, total] = await prisma.$transaction([
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
        orderBy: { createdAt: sortOrder },
        skip,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ]);

    const normalizedItems = items.map((payment) => ({
      ...payment,
      amount: decimalToNumber(payment.amount),
    }));

    return {
      items: normalizedItems,
      meta: {
        page,
        limit,
        total,
        totalPages: getTotalPages(total, limit),
      },
    };
  },
};
