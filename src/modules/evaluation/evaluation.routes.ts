import { Router } from "express";

import { evaluationController } from "./evaluation.controller";
import { authenticateEvaluationRequest } from "../../app/common/middleware/evaluation.auth";

const router = Router();

router.use(authenticateEvaluationRequest);

router.get("/assessments/:id/submissions", evaluationController.getAssessmentSubmissions);
router.get("/attempts/:id/evaluation", evaluationController.getAttemptEvaluation);
router.patch("/attempts/:id/answers/:answerId/evaluate", evaluationController.evaluateAnswer);
router.post("/attempts/:id/finalize-evaluation", evaluationController.finalizeEvaluation);
router.get("/attempts/:id/result", evaluationController.getAttemptResult);
router.get("/assessments/:id/report", evaluationController.getAssessmentReport);

export default router;
