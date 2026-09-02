import { Request, Response } from "express";

import { CompanyService } from "./company.service";
import { sendResponse } from "../../app/common/responses/api-response";


export class CompanyController {
  static async getMyCompany(req: Request, res: Response) {
    const company = await CompanyService.getMyCompany(req.user!.id);

    return sendResponse(
      res,
      200,
      "Company fetched successfully",
      company
    );
  }

  static async updateMyCompany(req: Request, res: Response) {
    const company = await CompanyService.updateMyCompany(
      req.user!.id,
      req.body
    );

    return sendResponse(
      res,
      200,
      "Company updated successfully",
      company
    );
  }
}