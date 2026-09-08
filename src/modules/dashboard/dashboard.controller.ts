import { Request, Response } from "express";

import { DashboardService } from "./dashboard.service";
import { sendResponse } from "../../app/common/responses/api-response";

export class DashboardController {
  static async getCandidateDashboard(req: Request, res: Response) {
    const dashboard = await DashboardService.getCandidateDashboard(
      req.user!.id,
    );

    return sendResponse(
      res,
      200,
      "Candidate dashboard fetched successfully",
      dashboard,
    );
  }

  static async getRecruiterDashboard(req: Request, res: Response) {
    const dashboard = await DashboardService.getRecruiterDashboard(
      req.user!.id,
    );

    return sendResponse(
      res,
      200,
      "Recruiter dashboard fetched successfully",
      dashboard,
    );
  }

  static async getAdminDashboard(_req: Request, res: Response) {
    const dashboard = await DashboardService.getAdminDashboard();

    return sendResponse(
      res,
      200,
      "Admin dashboard fetched successfully",
      dashboard,
    );
  }
}
