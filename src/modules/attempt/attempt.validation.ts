import { z } from "zod";

export const attemptIdSchema = z.object({
  body: z.object({}),
  params: z.object({
    id: z.string().uuid("Invalid attempt ID"),
  }),
  query: z.object({}),
});

export const saveAnswerSchema = z
  .object({
    body: z.object({
      selectedOptionId: z.string().uuid("Invalid selected option ID").optional(),
      answerText: z.string().trim().min(1, "Answer text cannot be empty").optional(),
    }),
    params: z.object({
      id: z.string().uuid("Invalid attempt ID"),
      problemId: z.string().uuid("Invalid problem ID"),
    }),
    query: z.object({}),
  })
  .superRefine(({ body }, ctx) => {
    if (!body.selectedOptionId && !body.answerText) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["body"],
        message: "Either selectedOptionId or answerText is required",
      });
    }
  });
