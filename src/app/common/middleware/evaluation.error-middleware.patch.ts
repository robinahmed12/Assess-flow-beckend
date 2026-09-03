import { NextFunction, Request, Response } from "express";
import { EvaluationError } from "../errors/evaluation.errors";

/**
 * OPTIONAL PATCH
 * Add this logic inside your existing globalErrorHandler if it does not already
 * support custom statusCode errors.
 */
export const evaluationErrorMiddlewarePatch = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (error instanceof EvaluationError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      error: {
        code: error.code,
      },
    });
  }

  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
};
