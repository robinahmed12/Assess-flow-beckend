import { z } from "zod";
import { UserRole, UserStatus } from "@prisma/client";

const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

export const listUsersSchema = z.object({
  body: z.object({}),

  params: z.object({}),

  query: z.object({
    ...paginationQuery,

    q: z.string().trim().min(1).optional(),

    role: z.nativeEnum(UserRole).optional(),

    status: z.nativeEnum(UserStatus).optional(),

    sortBy: z
      .enum(["createdAt", "updatedAt", "email", "name", "role", "status"])
      .default("createdAt"),

    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  }),
});

export const updateUserStatusSchema = z.object({
  body: z.object({
    status: z.nativeEnum(UserStatus),
  }),

  params: z.object({
    id: z.string().uuid("Invalid user id"),
  }),

  query: z.object({}),
});

export const auditLogsSchema = z.object({
  body: z.object({}),

  params: z.object({}),

  query: z.object({
    ...paginationQuery,

    actorId: z.string().uuid("Invalid actor id").optional(),

    action: z.string().trim().min(1).optional(),

    entityType: z.string().trim().min(1).optional(),

    entityId: z.string().trim().min(1).optional(),

    from: z.string().datetime("Invalid from date").optional(),

    to: z.string().datetime("Invalid to date").optional(),

    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  }),
});

export const adminPaymentsSchema = z.object({
  body: z.object({}),

  params: z.object({}),

  query: z.object({
    ...paginationQuery,

    status: z
      .enum(["PENDING", "SUCCEEDED", "FAILED", "REFUNDED"])
      .optional(),

    companyId: z.string().uuid("Invalid company id").optional(),

    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  }),
});