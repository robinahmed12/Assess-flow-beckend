import { RequestHandler } from "express";
import { ZodType } from "zod";
import { AppError } from "../errors/app-error";

export const validateRequest =
  (schema: ZodType): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
    });

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));

      return next(
        new AppError("Validation failed", 400, errors)
      );
    }

    next();
  };