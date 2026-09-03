import { Request, Response } from "express";
import { AttemptService } from "./attempt.service";
import { sendResponse } from "../../app/common/responses/api-response";

export class AttemptController {
  static async findMine(req: Request, res: Response) {
    const attempts = await AttemptService.findMine(req.user!.id);

    return sendResponse(res, 200, "Attempts fetched successfully", attempts);
  }

  static async findById(req: Request, res: Response) {
    const attempt = await AttemptService.findById(
      req.user!.id,
      req.params.id as string,
    );

    return sendResponse(res, 200, "Attempt fetched successfully", attempt);
  }

  static async saveAnswer(req: Request, res: Response) {
    const answer = await AttemptService.saveAnswer(
      req.user!.id,
      req.params.id as string,
      req.params.problemId as string,
      req.body,
    );

    return sendResponse(res, 200, "Answer saved successfully", answer);
  }

  static async submit(req: Request, res: Response) {
    const result = await AttemptService.submit(
      req.user!.id,
      req.params.id as string,
    );

    return sendResponse(res, 200, "Assessment submitted successfully", result);
  }
}
