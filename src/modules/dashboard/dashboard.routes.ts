import { Router } from "express";
import { UserRole } from "@prisma/client";

import { DashboardController } from "./dashboard.controller";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../auth/authorize.middleware";
import { asyncHandler } from "../../app/common/utils/async-handler";

const router = Router();

router.use(authenticate);

router.get(
  "/candidate",
  authorize(UserRole.CANDIDATE),
  asyncHandler(DashboardController.getCandidateDashboard),
);

router.get(
  "/recruiter",
  authorize(UserRole.RECRUITER),
  asyncHandler(DashboardController.getRecruiterDashboard),
);

router.get(
  "/admin",
  authorize(UserRole.ADMIN),
  asyncHandler(DashboardController.getAdminDashboard),
);

export default router;
