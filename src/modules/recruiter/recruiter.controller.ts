import { Request, Response } from "express";

import { RecruiterService } from "./recruiter.service";
import { sendResponse } from "../../app/common/responses/api-response";

export class RecruiterController {
  static async register(req: Request, res: Response) {
    const result = await RecruiterService.register(req.body);

    return sendResponse(
      res,
      201,
      "Recruiter registered successfully",
      result
    );
  }
}