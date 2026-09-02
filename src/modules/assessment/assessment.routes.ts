import { Router } from "express";
import { UserRole } from "@prisma/client";

import { AssessmentController } from "./assessment.controller";

import {
  createAssessmentSchema,
  updateAssessmentSchema,
  assessmentIdSchema,
} from "./assessment.validation";

import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../auth/authorize.middleware";
import { validateRequest } from "../../app/common/middleware/validate-request.middleware";
import { asyncHandler } from "../../app/common/utils/async-handler";


const router = Router();

router.use(authenticate);

router.use(authorize(UserRole.RECRUITER));

router.post(
  "/",
  validateRequest(createAssessmentSchema),
  asyncHandler(AssessmentController.create)
);

router.get(
  "/",
  asyncHandler(AssessmentController.findAll)
);

router.get(
  "/:id",
  validateRequest(assessmentIdSchema),
  asyncHandler(AssessmentController.findById)
);

router.patch(
  "/:id",
  validateRequest(updateAssessmentSchema),
  asyncHandler(AssessmentController.update)
);

router.post(
  "/:id/publish",
  validateRequest(assessmentIdSchema),
  asyncHandler(AssessmentController.publish)
);

router.delete(
  "/:id",
  validateRequest(assessmentIdSchema),
  asyncHandler(AssessmentController.archive)
);

export default router;