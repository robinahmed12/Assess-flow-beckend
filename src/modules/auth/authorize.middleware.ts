import { RequestHandler } from "express";
import { UserRole } from "@prisma/client";
import { AppError } from "../../app/common/errors/app-error";


export const authorize = (
  ...allowedRoles: UserRole[]
): RequestHandler => {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new AppError("Unauthorized", 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          "You do not have permission to perform this action",
          403
        )
      );
    }

    next();
  };
};