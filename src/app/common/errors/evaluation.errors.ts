export class EvaluationError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(statusCode: number, message: string, code = "EVALUATION_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const badRequest = (message: string) => new EvaluationError(400, message, "BAD_REQUEST");
export const unauthorized = (message = "Authentication required") =>
  new EvaluationError(401, message, "UNAUTHORIZED");
export const forbidden = (message = "You are not allowed to access this resource") =>
  new EvaluationError(403, message, "FORBIDDEN");
export const notFound = (message = "Resource not found") =>
  new EvaluationError(404, message, "NOT_FOUND");
export const conflict = (message: string) => new EvaluationError(409, message, "CONFLICT");
