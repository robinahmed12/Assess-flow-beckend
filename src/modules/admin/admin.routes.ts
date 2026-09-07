import { Router } from "express";
import { UserRole } from "@prisma/client";

import { AdminController } from "./admin.controller";
import {
  adminPaymentsSchema,
  auditLogsSchema,
  listUsersSchema,
  updateUserStatusSchema,
} from "./admin.validation";

import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../auth/authorize.middleware";
import { validateRequest } from "../../app/common/middleware/validate-request.middleware";
import { asyncHandler } from "../../app/common/utils/async-handler";

const router = Router();

router.use(authenticate);
router.use(authorize(UserRole.ADMIN));

router.get(
  "/users",
  validateRequest(listUsersSchema),
  asyncHandler(AdminController.listUsers),
);

router.patch(
  "/users/:id/status",
  validateRequest(updateUserStatusSchema),
  asyncHandler(AdminController.updateUserStatus),
);

router.get("/dashboard-stats", asyncHandler(AdminController.getDashboardStats));

router.get(
  "/audit-logs",
  validateRequest(auditLogsSchema),
  asyncHandler(AdminController.listAuditLogs),
);

router.get(
  "/payments",
  validateRequest(adminPaymentsSchema),
  asyncHandler(AdminController.listPayments),
);

export default router;
