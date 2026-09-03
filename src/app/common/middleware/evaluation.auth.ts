import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

import { forbidden, unauthorized } from "../errors/evaluation.errors";
import { prisma } from "../../../lib/prisma";


/**
 * Self-contained auth middleware for this module.
 *
 * It supports access tokens where the user id is stored in one of:
 * - payload.sub
 * - payload.userId
 * - payload.id
 *
 * If your project already has an authenticate() middleware, you can replace this
 * middleware in evaluation.routes.ts with your existing one.
 */
export const authenticateEvaluationRequest = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw unauthorized("Missing bearer token");
    }

    const token = authHeader.slice("Bearer ".length).trim();
    const secret = process.env.JWT_ACCESS_SECRET;

    if (!secret) {
      throw new Error("JWT_ACCESS_SECRET is not configured");
    }

    const decoded = jwt.verify(token, secret) as JwtPayload & {
      id?: string;
      userId?: string;
      role?: string;
    };

    const userId =
      typeof decoded.sub === "string"
        ? decoded.sub
        : decoded.userId || decoded.id;

    if (!userId) {
      throw unauthorized("Invalid token payload");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
      },
    });

    if (!user) {
      throw unauthorized("User does not exist");
    }

    if (user.status === "SUSPENDED") {
      throw forbidden("Suspended users cannot access protected resources");
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};
