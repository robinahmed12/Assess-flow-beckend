import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { EvaluationError } from "../../app/common/errors/evaluation.errors";
import { evaluationService } from "./evaluation.service";
import {
  attemptAnswerParamSchema,
  evaluateAnswerBodySchema,
  idParamSchema,
  submissionsQuerySchema,
} from "./evaluation.validation";
import { EvaluationRequest } from "./evaluation.types";

const getUser = (req: Request) => {
  const user = (req as EvaluationRequest).user;

  if (!user) {
    throw new EvaluationError(401, "Authentication required", "UNAUTHORIZED");
  }

  return user;
};

const sendSuccess = (res: Response, message: string, data: unknown, statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

const handleControllerError = (error: unknown, next: NextFunction) => {
  if (error instanceof ZodError) {
    next(
      new EvaluationError(
        400,
        error.issues.map((issue) => issue.message).join(", "),
        "VALIDATION_ERROR"
      )
    );
    return;
  }

  next(error);
};

export const evaluationController = {
  async getAssessmentSubmissions(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = idParamSchema.parse(req.params);
      const query = submissionsQuerySchema.parse(req.query);
      const data = await evaluationService.getAssessmentSubmissions(id, getUser(req), query);
      sendSuccess(res, "Assessment submissions retrieved successfully", data);
    } catch (error) {
      handleControllerError(error, next);
    }
  },

  async getAttemptEvaluation(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = idParamSchema.parse(req.params);
      const data = await evaluationService.getAttemptEvaluation(id, getUser(req));
      sendSuccess(res, "Attempt evaluation retrieved successfully", data);
    } catch (error) {
      handleControllerError(error, next);
    }
  },

  async evaluateAnswer(req: Request, res: Response, next: NextFunction) {
    try {
      const { id, answerId } = attemptAnswerParamSchema.parse(req.params);
      const body = evaluateAnswerBodySchema.parse(req.body);
      const data = await evaluationService.evaluateAnswer(id, answerId, getUser(req), body);
      sendSuccess(res, "Answer evaluated successfully", data);
    } catch (error) {
      handleControllerError(error, next);
    }
  },

  async finalizeEvaluation(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = idParamSchema.parse(req.params);
      const data = await evaluationService.finalizeEvaluation(id, getUser(req));
      sendSuccess(res, "Evaluation finalized successfully", data);
    } catch (error) {
      handleControllerError(error, next);
    }
  },

  async getAttemptResult(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = idParamSchema.parse(req.params);
      const data = await evaluationService.getAttemptResult(id, getUser(req));
      sendSuccess(res, "Attempt result retrieved successfully", data);
    } catch (error) {
      handleControllerError(error, next);
    }
  },

  async getAssessmentReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = idParamSchema.parse(req.params);
      const data = await evaluationService.getAssessmentReport(id, getUser(req));
      sendSuccess(res, "Assessment report retrieved successfully", data);
    } catch (error) {
      handleControllerError(error, next);
    }
  },
};
