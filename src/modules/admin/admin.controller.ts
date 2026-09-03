import { Request, Response } from "express";

import { AdminService } from "./admin.service";
import { adminErrors } from "./admin.errors";
import { AdminPaymentsQuery, AuditLogsQuery, ListUsersQuery, UpdateUserStatusBody } from "./admin.types";
import { sendResponse } from "../../app/common/responses/api-response";

const getActorId = (req: Request): string => {
  const actorId = req.user?.id;
  if (!actorId) {
    throw adminErrors.unauthorized();
  }
  return actorId;
};

export const AdminController = {
  async listUsers(req: Request, res: Response) {
    const result = await AdminService.listUsers(req.query as unknown as ListUsersQuery);
    return sendResponse(res, 200, "Users retrieved successfully", result);
  },

  async updateUserStatus(req: Request, res: Response) {
    const actorId = getActorId(req);
    const result = await AdminService.updateUserStatus(
      actorId,
      req.params.id as string,
      req.body as UpdateUserStatusBody
    );

    return sendResponse(res, 200, "User status updated successfully", result);
  },

  async getDashboardStats(_req: Request, res: Response) {
    const result = await AdminService.getDashboardStats();
    return sendResponse(res, 200, "Admin dashboard stats retrieved successfully", result);
  },

  async listAuditLogs(req: Request, res: Response) {
    const result = await AdminService.listAuditLogs(req.query as unknown as AuditLogsQuery);
    return sendResponse(res, 200, "Audit logs retrieved successfully", result);
  },

  async listPayments(req: Request, res: Response) {
    const result = await AdminService.listPayments(req.query as unknown as AdminPaymentsQuery);
    return sendResponse(res, 200, "Platform payments retrieved successfully", result);
  },
};
