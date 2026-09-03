import { z } from "zod";
import { AttemptStatus } from "@prisma/client";

export const assessmentIdSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid assessment id"),
  }),
});

export const attemptIdSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid attempt id"),
  }),
});

export const attemptAnswerIdSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid attempt id"),
    answerId: z.string().uuid("Invalid answer id"),
  }),
});

export const evaluateAnswerSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid attempt id"),
    answerId: z.string().uuid("Invalid answer id"),
  }),
  body: z.object({
    score: z.coerce.number().min(0, "Score cannot be negative"),
    feedback: z.string().trim().max(5000, "Feedback is too long").optional(),
  }),
});

export const submissionsQuerySchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid assessment id"),
  }),
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.nativeEnum(AttemptStatus).optional(),
    q: z.string().trim().optional(),
  }),
});
