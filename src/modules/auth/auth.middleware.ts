import { NextFunction, Request, Response } from "express";
import { AppError } from "../../app/common/errors/app-error";
import { verifyAccessToken } from "../../app/common/utils/jwt";
import { prisma } from "../../lib/prisma";



export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith("Bearer ")) {
      throw new AppError("Authentication token is required", 401);
    }

    const token = authorization.split(" ")[1];

    if (!token) {
      throw new AppError("Authentication token is required", 401);
    }

    const payload = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: {
        id: payload.userId,
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
      },
    });

    if (!user) {
      throw new AppError("User not found", 401);
    }

    if (user.status !== "ACTIVE") {
      throw new AppError("Your account is not active", 403);
    }

    req.user = user;

    next();
  } catch (error) {
    next(error);
  }
};