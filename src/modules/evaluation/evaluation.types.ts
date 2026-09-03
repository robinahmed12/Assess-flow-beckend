import { Request } from "express";
import { UserRole, UserStatus } from "@prisma/client";

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
};

export type EvaluationRequest = Request & {
  user?: AuthUser;
};

export type ProblemTypeValue = "MCQ" | "WRITTEN" | "CODING";
