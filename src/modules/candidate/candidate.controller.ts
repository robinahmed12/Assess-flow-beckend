import { Request, Response } from "express";

import { CandidateService } from "./candidate.service";
import { sendResponse } from "../../app/common/responses/api-response";


export class CandidateController {
  static async findMyAssessments(
    req: Request,
    res: Response
  ) {
    const assessments =
      await CandidateService.findMyAssessments(
        req.user!.id
      );

    return sendResponse(
      res,
      200,
      "Candidate assessments fetched successfully",
      assessments
    );
  }

  static async startAssessment(
    req: Request,
    res: Response
  ) {
    const attempt =
      await CandidateService.startAssessment(
        req.user!.id,
        req.params.id as string
      );

    return sendResponse(
      res,
      200,
      "Assessment started successfully",
      attempt
    );
  }
}