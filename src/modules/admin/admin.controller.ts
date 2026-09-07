import { Request, Response } from "express";

import { AdminService } from "./admin.service";
import {
  AdminPaymentsQuery,
  AuditLogsQuery,
  ListUsersQuery,
  UpdateUserStatusBody,
} from "./admin.types";
import { sendResponse } from "../../app/common/responses/api-response";

export class AdminController {
  static async listUsers(req: Request, res: Response) {
    const result = await AdminService.listUsers(
      req.query as unknown as ListUsersQuery
    );

    return sendResponse(
      res,
      200,
      "Users fetched successfully",
      result
    );
  }

  static async updateUserStatus(req: Request, res: Response) {
    const result = await AdminService.updateUserStatus(
      req.user!.id,
      req.params.id as string,
      req.body as UpdateUserStatusBody
    );

    return sendResponse(
      res,
      200,
      "User status updated successfully",
      result
    );
  }

  static async getDashboardStats(_req: Request, res: Response) {
    const result = await AdminService.getDashboardStats();

    return sendResponse(
      res,
      200,
      "Admin dashboard stats fetched successfully",
      result
    );
  }

  static async listAuditLogs(req: Request, res: Response) {
    const result = await AdminService.listAuditLogs(
      req.query as unknown as AuditLogsQuery
    );

    return sendResponse(
      res,
      200,
      "Audit logs fetched successfully",
      result
    );
  }

  static async listPayments(req: Request, res: Response) {
    const result = await AdminService.listPayments(
      req.query as unknown as AdminPaymentsQuery
    );

    return sendResponse(
      res,
      200,
      "Platform payments fetched successfully",
      result
    );
  }
}