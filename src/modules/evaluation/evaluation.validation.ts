import { z } from "zod";
import { AttemptStatus } from "@prisma/client";

export const idParamSchema = z.object({
  id: z.string().uuid("Invalid id"),
});

export const attemptAnswerParamSchema = z.object({
  id: z.string().uuid("Invalid attempt id"),
  answerId: z.string().uuid("Invalid answer id"),
});

export const evaluateAnswerBodySchema = z.object({
  score: z.number().min(0, "Score cannot be negative"),
  feedback: z.string().max(5000).optional(),
});

export const submissionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(AttemptStatus).optional(),
  q: z.string().trim().optional(),
});
