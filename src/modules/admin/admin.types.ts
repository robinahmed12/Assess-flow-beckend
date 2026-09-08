import { UserRole, UserStatus } from "@prisma/client";

export type SortOrder = "asc" | "desc";

export type UserSortBy =
  | "createdAt"
  | "updatedAt"
  | "email"
  | "name"
  | "role"
  | "status";

export interface ListUsersQuery {
  page?: number;
  limit?: number;
  q?: string;
  role?: UserRole;
  status?: UserStatus;
  sortBy?: UserSortBy;
  sortOrder?: SortOrder;
}

export interface UpdateUserStatusBody {
  status: UserStatus;
}

export interface AuditLogsQuery {
  page?: number;
  limit?: number;
  actorId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  from?: string;
  to?: string;
  sortOrder?: SortOrder;
}

export interface AdminPaymentsQuery {
  page?: number;
  limit?: number;
  status?: string;
  companyId?: string;
  sortOrder?: SortOrder;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}