import { Request, Response } from "express";
import { EvaluationService } from "./evaluation.service";
import { sendResponse } from "../../app/common/responses/api-response";
import { EvaluateAnswerInput, SubmissionsQuery } from "./evaluation.types";

export class EvaluationController {
  static async getAssessmentSubmissions(req: Request, res: Response) {
    const result = await EvaluationService.getAssessmentSubmissions(
      req.user!.id,
      req.params.id as string,
      req.query as unknown as SubmissionsQuery,
    );

    return sendResponse(
      res,
      200,
      "Assessment submissions fetched successfully",
      result,
    );
  }

  static async getAttemptEvaluation(req: Request, res: Response) {
    const result = await EvaluationService.getAttemptEvaluation(
      req.user!.id,
      req.params.id as string,
    );

    return sendResponse(
      res,
      200,
      "Attempt evaluation fetched successfully",
      result,
    );
  }

  static async evaluateAnswer(req: Request, res: Response) {
    const result = await EvaluationService.evaluateAnswer(
      req.user!.id,
      req.params.id as string,
      req.params.answerId as string,
      req.body as EvaluateAnswerInput,
    );

    return sendResponse(res, 200, "Answer evaluated successfully", result);
  }

  static async finalizeEvaluation(req: Request, res: Response) {
    const result = await EvaluationService.finalizeEvaluation(
      req.user!.id,
      req.params.id as string,
    );

    return sendResponse(res, 200, "Evaluation finalized successfully", result);
  }

  static async getAttemptResult(req: Request, res: Response) {
    const result = await EvaluationService.getAttemptResult(
      req.user!.id,
      req.params.id as string,
    );

    return sendResponse(res, 200, "Attempt result fetched successfully", result);
  }

  static async getAssessmentReport(req: Request, res: Response) {
    const result = await EvaluationService.getAssessmentReport(
      req.user!.id,
      req.params.id as string,
    );

    return sendResponse(res, 200, "Assessment report fetched successfully", result);
  }
}
