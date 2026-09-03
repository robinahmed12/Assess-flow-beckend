import { Router } from "express";
import { UserRole } from "@prisma/client";

import { AttemptController } from "./attempt.controller";
import { attemptIdSchema, saveAnswerSchema } from "./attempt.validation";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../auth/authorize.middleware";
import { validateRequest } from "../../app/common/middleware/validate-request.middleware";
import { asyncHandler } from "../../app/common/utils/async-handler";

const router = Router();

router.use(authenticate);
router.use(authorize(UserRole.CANDIDATE));

router.get("/me", asyncHandler(AttemptController.findMine));

router.get(
  "/:id",
  validateRequest(attemptIdSchema),
  asyncHandler(AttemptController.findById),
);

router.put(
  "/:id/answers/:problemId",
  validateRequest(saveAnswerSchema),
  asyncHandler(AttemptController.saveAnswer),
);

router.post(
  "/:id/submit",
  validateRequest(attemptIdSchema),
  asyncHandler(AttemptController.submit),
);

export default router;
