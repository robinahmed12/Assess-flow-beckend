import { z } from "zod";
import { UserRole, UserStatus } from "@prisma/client";

const positiveIntFromQuery = (defaultValue: number, maxValue: number) =>
  z
    .preprocess((value) => {
      if (value === undefined || value === null || value === "") return defaultValue;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : value;
    }, z.number().int().positive().max(maxValue))
    .default(defaultValue);

export const adminUserIdParamSchema = {
  params: z.object({
    id: z.string().min(1, "User id is required"),
  }),
};

export const listUsersSchema = {
  query: z.object({
    page: positiveIntFromQuery(1, 100000).optional(),
    limit: positiveIntFromQuery(20, 100).optional(),
    q: z.string().trim().min(1).optional(),
    role: z.nativeEnum(UserRole).optional(),
    status: z.nativeEnum(UserStatus).optional(),
    sortBy: z.enum(["createdAt", "updatedAt", "email", "name", "role", "status"]).default("createdAt").optional(),
    sortOrder: z.enum(["asc", "desc"]).default("desc").optional(),
  }),
};

export const updateUserStatusSchema = {
  params: adminUserIdParamSchema.params,
  body: z.object({
    status: z.nativeEnum(UserStatus),
  }),
};

export const auditLogsSchema = {
  query: z.object({
    page: positiveIntFromQuery(1, 100000).optional(),
    limit: positiveIntFromQuery(20, 100).optional(),
    actorId: z.string().min(1).optional(),
    action: z.string().trim().min(1).optional(),
    entityType: z.string().trim().min(1).optional(),
    entityId: z.string().trim().min(1).optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    sortOrder: z.enum(["asc", "desc"]).default("desc").optional(),
  }),
};

export const adminPaymentsSchema = {
  query: z.object({
    page: positiveIntFromQuery(1, 100000).optional(),
    limit: positiveIntFromQuery(20, 100).optional(),
    status: z.string().trim().min(1).optional(),
    companyId: z.string().min(1).optional(),
    sortOrder: z.enum(["asc", "desc"]).default("desc").optional(),
  }),
};
