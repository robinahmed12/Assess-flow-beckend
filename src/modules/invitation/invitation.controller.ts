import { Request, Response } from "express";

import { InvitationService } from "./invitation.service";
import { sendResponse } from "../../app/common/responses/api-response";

export class InvitationController {
  static async create(req: Request, res: Response) {
    const invitation = await InvitationService.create(
      req.user!.id,
      req.params.id as string,
      req.body,
    );

    return sendResponse(res, 201, "Candidate invited successfully", invitation);
  }

  static async findByAssessment(req: Request, res: Response) {
    const invitations = await InvitationService.findByAssessment(
      req.user!.id,
      req.params.id as string,
    );

    return sendResponse(
      res,
      200,
      "Invitations fetched successfully",
      invitations,
    );
  }

   static async verifyToken(req: Request, res: Response) {
    const invitation = await InvitationService.verifyInvitationToken(
      req.params.token as string,
    );

    return sendResponse(
      res,
      200,
      "Invitation link is valid",
      invitation
    );
  }
}
