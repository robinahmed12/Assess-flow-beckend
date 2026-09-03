import { NextFunction, Response } from "express";
import { AuthenticatedRequest, AuthUser } from "../../../modules/payment/payment.types";
import { paymentErrors } from "../errors/payment.errors";

const normalizeRole = (role: string) => role.toUpperCase();

export const getAuthUser = (req: AuthenticatedRequest): AuthUser => {
  const user = req.user;

  if (!user?.id || !user.role) {
    throw paymentErrors.unauthorized();
  }

  return user;
};

export const requireRecruiter = (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  try {
    const user = getAuthUser(req);

    if (normalizeRole(user.role) !== "RECRUITER") {
      throw paymentErrors.forbidden();
    }

    next();
  } catch (error) {
    next(error);
  }
};
