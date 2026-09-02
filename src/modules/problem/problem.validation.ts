import { ProblemType } from "@prisma/client";
import { z } from "zod";

const problemOptionSchema = z.object({
  text: z
    .string()
    .min(1, "Option text is required")
    .max(1000),

  isCorrect: z.boolean(),
});

const baseProblemSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(200),

  description: z
    .string()
    .min(5, "Description must be at least 5 characters"),

  type: z.nativeEnum(ProblemType),

  points: z
    .number()
    .int("Points must be an integer")
    .positive("Points must be greater than 0"),

  difficulty: z
    .string()
    .max(50)
    .optional(),

  tags: z
    .array(z.string().min(1).max(50))
    .max(10)
    .default([]),

  options: z
    .array(problemOptionSchema)
    .optional(),
});

export const createProblemSchema = z
  .object({
    body: baseProblemSchema,
    params: z.object({}),
    query: z.object({}),
  })
  .superRefine(({ body }, ctx) => {
    if (body.type === ProblemType.MCQ) {
      if (!body.options || body.options.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["body", "options"],
          message: "MCQ must have at least 2 options",
        });
      }

      const correctCount =
        body.options?.filter((option) => option.isCorrect).length ?? 0;

      if (correctCount !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["body", "options"],
          message: "MCQ must have exactly one correct option",
        });
      }
    }

    if (
      body.type !== ProblemType.MCQ &&
      body.options &&
      body.options.length > 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["body", "options"],
        message: "Only MCQ problems can have options",
      });
    }
  });

export const updateProblemSchema = z
  .object({
    body: baseProblemSchema.partial(),
    params: z.object({
      id: z.string().uuid("Invalid problem ID"),
    }),
    query: z.object({}),
  })
  .superRefine(({ body }, ctx) => {
    /*
      Update validation for MCQ is more complicated because
      the request may contain only some fields.

      We will enforce full MCQ validation in the service layer
      after merging the existing problem with the update data.
    */

    if (
      body.type &&
      body.type !== ProblemType.MCQ &&
      body.options &&
      body.options.length > 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["body", "options"],
        message: "Only MCQ problems can have options",
      });
    }
  });

export const problemIdSchema = z.object({
  body: z.object({}),
  params: z.object({
    id: z.string().uuid("Invalid problem ID"),
  }),
  query: z.object({}),
});