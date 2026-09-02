import { ErrorRequestHandler } from "express";
import { AppError } from "../errors/app-error";
import config from "../../config";

export const globalErrorHandler: ErrorRequestHandler = (
  err,
  _req,
  res,
  _next
) => {
  let statusCode = 500;
  let message = "Internal server error";
  let errors: unknown;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    errors = err.errors;
  }

  if (config.node_env === "development") {
    console.error(err);
  }

 res.status(statusCode).json({
  success: false,
  message,
  ...(errors ? { errors } : {}),
  ...(config.node_env === "development" ? { stack: err.stack } : {}),
});

};