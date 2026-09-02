import { Request, Response } from "express";
import { AssessmentService } from "./assessment.service";
import { sendResponse } from "../../app/common/responses/api-response";

export class AssessmentController {
  static async create(
    req: Request,
    res: Response
  ) {
    const assessment =
      await AssessmentService.create(
        req.user!.id,
        req.body
      );

    return sendResponse(
      res,
      201,
      "Assessment created successfully",
      assessment
    );
  }

  static async findAll(
    req: Request,
    res: Response
  ) {
    const assessments =
      await AssessmentService.findAll(
        req.user!.id
      );

    return sendResponse(
      res,
      200,
      "Assessments fetched successfully",
      assessments
    );
  }

  static async findById(
    req: Request,
    res: Response
  ) {
    const assessment =
      await AssessmentService.findById(
        req.user!.id,
        req.params.id as string
      );

    return sendResponse(
      res,
      200,
      "Assessment fetched successfully",
      assessment
    );
  }

  static async update(
    req: Request,
    res: Response
  ) {
    const assessment =
      await AssessmentService.update(
        req.user!.id,
        req.params.id as string,
        req.body
      );

    return sendResponse(
      res,
      200,
      "Assessment updated successfully",
      assessment
    );
  }

  static async publish(
    req: Request,
    res: Response
  ) {
    const assessment =
      await AssessmentService.publish(
        req.user!.id,
        req.params.id as string
      );

    return sendResponse(
      res,
      200,
      "Assessment published successfully",
      assessment
    );
  }

  static async archive(
    req: Request,
    res: Response
  ) {
    const assessment =
      await AssessmentService.archive(
        req.user!.id,
        req.params.id as string
      );

    return sendResponse(
      res,
      200,
      "Assessment archived successfully",
      assessment
    );
  }
}