import { NextFunction, Request, Response, Router } from "express";
import { UserRole } from "@prisma/client";
import { AdminController } from "./admin.controller";
import {
  adminPaymentsSchema,
  auditLogsSchema,
  listUsersSchema,
  updateUserStatusSchema,
} from "./admin.validation";
import { AdminRouterDeps, ValidationSchema } from "./admin.types";

const asyncHandler =
  (handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };

const fallbackValidateRequest = (schema: ValidationSchema) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schema.params) {
        req.params = schema.params.parse(req.params) as typeof req.params;
      }
      if (schema.query) {
        req.query = schema.query.parse(req.query) as typeof req.query;
      }
      if (schema.body) {
        req.body = schema.body.parse(req.body);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};

export const createAdminRouter = (deps: AdminRouterDeps): Router => {
  const router = Router();
  const validateRequest = deps.validateRequest ?? fallbackValidateRequest;
  const adminOnly = [deps.authenticate, deps.authorize(UserRole.ADMIN)];

  router.get(
    "/users",
    ...adminOnly,
    validateRequest(listUsersSchema),
    asyncHandler(AdminController.listUsers)
  );

  router.patch(
    "/users/:id/status",
    ...adminOnly,
    validateRequest(updateUserStatusSchema),
    asyncHandler(AdminController.updateUserStatus)
  );

  router.get(
    "/dashboard-stats",
    ...adminOnly,
    asyncHandler(AdminController.getDashboardStats)
  );

  router.get(
    "/audit-logs",
    ...adminOnly,
    validateRequest(auditLogsSchema),
    asyncHandler(AdminController.listAuditLogs)
  );

  router.get(
    "/payments",
    ...adminOnly,
    validateRequest(adminPaymentsSchema),
    asyncHandler(AdminController.listPayments)
  );

  return router;
};
