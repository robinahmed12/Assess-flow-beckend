import { z } from "zod";

export const assessmentIdSchema = z.object({
  body: z.object({}),

  params: z.object({
    id: z.string().uuid("Invalid assessment ID"),
  }),

  query: z.object({}),
});