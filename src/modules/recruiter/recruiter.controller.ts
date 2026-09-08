import { Request, Response } from "express";

import { RecruiterService } from "./recruiter.service";
import { sendResponse } from "../../app/common/responses/api-response";

export class RecruiterController {
  static async register(req: Request, res: Response) {
    const result = await RecruiterService.register(
      req.body,
      req.files as {
        companyLicensePaper?: Express.Multer.File[];
        selfDocument?: Express.Multer.File[];
      }
    );

    return sendResponse(
      res,
      200,
      "Verification OTP sent to recruiter email",
      result
    );
  }

  static async verifyOtp(req: Request, res: Response) {
    const result = await RecruiterService.verifyOtp(req.body);

    return sendResponse(
      res,
      201,
      "Recruiter registered successfully",
      result
    );
  }
}