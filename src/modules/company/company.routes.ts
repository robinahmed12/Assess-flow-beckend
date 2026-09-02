import { Router } from "express";
import { UserRole } from "@prisma/client";

import { CompanyController } from "./company.controller";
import { updateCompanySchema } from "./company.validation";

import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../auth/authorize.middleware";
import { asyncHandler } from "../../app/common/utils/async-handler";
import { validateRequest } from "../../app/common/middleware/validate-request.middleware";


const router = Router();

router.get(
  "/me",
  authenticate,
  authorize(UserRole.RECRUITER),
  asyncHandler(CompanyController.getMyCompany)
);

router.patch(
  "/me",
  authenticate,
  authorize(UserRole.RECRUITER),
  validateRequest(updateCompanySchema),
  asyncHandler(CompanyController.updateMyCompany)
);

export default router;