import { z } from "zod";

export const updateCompanySchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(2, "Company name must be at least 2 characters")
      .max(150)
      .optional(),
  }),

  params: z.object({}),

  query: z.object({}),
});