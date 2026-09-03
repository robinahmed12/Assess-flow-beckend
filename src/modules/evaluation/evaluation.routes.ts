import { Router } from "express";
import { UserRole } from "@prisma/client";
import { EvaluationController } from "./evaluation.controller";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../auth/authorize.middleware";
import { validateRequest } from "../../app/common/middleware/validate-request.middleware";
import { asyncHandler } from "../../app/common/utils/async-handler";
import {
  assessmentIdSchema,
  attemptIdSchema,
  evaluateAnswerSchema,
  submissionsQuerySchema,
} from "./evaluation.validation";

const router = Router();

router.use(authenticate);

router.get(
  "/assessments/:id/submissions",
  authorize(UserRole.RECRUITER, UserRole.ADMIN),
  validateRequest(submissionsQuerySchema),
  asyncHandler(EvaluationController.getAssessmentSubmissions),
);

router.get(
  "/attempts/:id/evaluation",
  authorize(UserRole.RECRUITER, UserRole.ADMIN),
  validateRequest(attemptIdSchema),
  asyncHandler(EvaluationController.getAttemptEvaluation),
);

router.patch(
  "/attempts/:id/answers/:answerId/evaluate",
  authorize(UserRole.RECRUITER, UserRole.ADMIN),
  validateRequest(evaluateAnswerSchema),
  asyncHandler(EvaluationController.evaluateAnswer),
);

router.post(
  "/attempts/:id/finalize-evaluation",
  authorize(UserRole.RECRUITER, UserRole.ADMIN),
  validateRequest(attemptIdSchema),
  asyncHandler(EvaluationController.finalizeEvaluation),
);

router.get(
  "/attempts/:id/result",
  authorize(UserRole.RECRUITER, UserRole.CANDIDATE, UserRole.ADMIN),
  validateRequest(attemptIdSchema),
  asyncHandler(EvaluationController.getAttemptResult),
);

router.get(
  "/assessments/:id/report",
  authorize(UserRole.RECRUITER, UserRole.ADMIN),
  validateRequest(assessmentIdSchema),
  asyncHandler(EvaluationController.getAssessmentReport),
);

export default router;
