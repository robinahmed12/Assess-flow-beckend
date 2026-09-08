import { Request, Response } from "express";

import { AuthService } from "./auth.service";
import { sendResponse } from "../../app/common/responses/api-response";

export class AuthController {
  static async register(req: Request, res: Response) {
    const result = await AuthService.register(req.body);

    return sendResponse(
      res,
      200,
      "Verification OTP sent to your email",
      result,
    );
  }

  static async verifyRegistrationOtp(req: Request, res: Response) {
    const result = await AuthService.verifyRegistrationOtp(req.body);

    return sendResponse(res, 201, "User registered successfully", result);
  }

  static async login(req: Request, res: Response) {
    const result = await AuthService.login(req.body);

    return sendResponse(res, 200, "Login successful", result);
  }

  static async googleLogin(req: Request, res: Response) {
    const result = await AuthService.googleLogin(req.body);

    return sendResponse(res, 200, "Google login successful", result);
  }

  static async getCurrentUser(req: Request, res: Response) {
    const user = await AuthService.getCurrentUser(req.user!.id);

    return sendResponse(res, 200, "Current user fetched successfully", user);
  }
}
