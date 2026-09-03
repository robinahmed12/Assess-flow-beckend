import { Router } from "express";
import { UserRole } from "@prisma/client";

import { CandidateController } from "./candidate.controller";
import { assessmentIdSchema } from "./candidate.validation";

import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../auth/authorize.middleware";
import { asyncHandler } from "../../app/common/utils/async-handler";
import { validateRequest } from "../../app/common/middleware/validate-request.middleware";

const router = Router();

router.use(authenticate);

router.use(authorize(UserRole.CANDIDATE));

router.get("/assessments", asyncHandler(CandidateController.findMyAssessments));

router.post(
  "/assessments/:id/start",
  validateRequest(assessmentIdSchema),
  asyncHandler(CandidateController.startAssessment),
);

export default router;
