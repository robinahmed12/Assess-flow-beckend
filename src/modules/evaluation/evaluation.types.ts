import { AttemptStatus } from "@prisma/client";

export interface SubmissionsQuery {
  page?: number;
  limit?: number;
  status?: AttemptStatus;
  q?: string;
}

export interface EvaluateAnswerInput {
  score: number;
  feedback?: string;
}

export type SortOrder = "asc" | "desc";
