import { RequestHandler } from "express";
import { UserRole, UserStatus } from "@prisma/client";
import { z } from "zod";

export type SortOrder = "asc" | "desc";

export type ValidationSchema = {
  body?: z.ZodTypeAny;
  params?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
};

export type ValidateRequest = (schema: ValidationSchema) => RequestHandler;

export type AdminRouterDeps = {
  authenticate: RequestHandler;
  authorize: (...roles: any[]) => RequestHandler;
  validateRequest?: ValidateRequest;
};

export type ListUsersQuery = {
  page?: number;
  limit?: number;
  q?: string;
  role?: UserRole;
  status?: UserStatus;
  sortBy?: "createdAt" | "updatedAt" | "email" | "name" | "role" | "status";
  sortOrder?: SortOrder;
};

export type UpdateUserStatusBody = {
  status: UserStatus;
};

export type AuditLogsQuery = {
  page?: number;
  limit?: number;
  actorId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  from?: string;
  to?: string;
  sortOrder?: SortOrder;
};

export type AdminPaymentsQuery = {
  page?: number;
  limit?: number;
  status?: string;
  companyId?: string;
  sortOrder?: SortOrder;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PaginatedResult<T> = {
  items: T[];
  meta: PaginationMeta;
};
