import { Request, Response } from "express";

import { ProblemService } from "./problem.service";
import { sendResponse } from "../../app/common/responses/api-response";


export class ProblemController {
  static async create(req: Request, res: Response) {
    const problem = await ProblemService.create(
      req.user!.id,
      req.body
    );

    return sendResponse(
      res,
      201,
      "Problem created successfully",
      problem
    );
  }

  static async findAll(req: Request, res: Response) {
    const problems = await ProblemService.findAll(
      req.user!.id
    );

    return sendResponse(
      res,
      200,
      "Problems fetched successfully",
      problems
    );
  }

  static async findById(req: Request, res: Response) {
    const problem = await ProblemService.findById(
      req.user!.id,
      req.params.id as string
    );

    return sendResponse(
      res,
      200,
      "Problem fetched successfully",
      problem
    );
  }

  static async update(req: Request, res: Response) {
    const problem = await ProblemService.update(
      req.user!.id,
      req.params.id as string,
      req.body
    );

    return sendResponse(
      res,
      200,
      "Problem updated successfully",
      problem
    );
  }

  static async archive(req: Request, res: Response) {
    const problem = await ProblemService.archive(
      req.user!.id,
      req.params.id as string
    );

    return sendResponse(
      res,
      200,
      "Problem archived successfully",
      problem
    );
  }
}