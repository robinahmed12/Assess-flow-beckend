import { z } from "zod";

const problemIdSchema = z.string().uuid("Invalid problem ID");

export const createAssessmentSchema = z.object({
  body: z.object({
    title: z
      .string()
      .min(3, "Title must be at least 3 characters")
      .max(200),

    description: z
      .string()
      .max(2000)
      .optional(),

    durationMinutes: z
      .number()
      .int()
      .min(1, "Duration must be at least 1 minute")
      .max(1440),

    passingScore: z
      .number()
      .int()
      .min(0, "Passing score cannot be negative"),

    problemIds: z
      .array(problemIdSchema)
      .min(1, "At least one problem is required")
      .max(100),
  }),

  params: z.object({}),

  query: z.object({}),
});

export const updateAssessmentSchema = z.object({
  body: z.object({
    title: z
      .string()
      .min(3)
      .max(200)
      .optional(),

    description: z
      .string()
      .max(2000)
      .nullable()
      .optional(),

    durationMinutes: z
      .number()
      .int()
      .min(1)
      .max(1440)
      .optional(),

    passingScore: z
      .number()
      .int()
      .min(0)
      .optional(),

    problemIds: z
      .array(problemIdSchema)
      .min(1)
      .max(100)
      .optional(),
  }),

  params: z.object({
    id: z.string().uuid("Invalid assessment ID"),
  }),

  query: z.object({}),
});

export const assessmentIdSchema = z.object({
  body: z.object({}),

  params: z.object({
    id: z.string().uuid("Invalid assessment ID"),
  }),

  query: z.object({}),
});