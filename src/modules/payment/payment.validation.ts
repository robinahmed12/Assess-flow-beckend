import { z } from "zod";

export const createCheckoutSchema = z.object({
  body: z.object({
    packageCode: z.enum(["STARTER", "GROWTH", "SCALE"]),
  }),
});

export const listPaymentsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z.enum(["PENDING", "SUCCEEDED", "FAILED", "REFUNDED"]).optional(),
  }),
});

export const paymentIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const validateRequest = (schema: z.ZodTypeAny) => {
  return (req: any, _res: any, next: any) => {
    const parsed = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!parsed.success) {
      return next({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Validation failed.",
        issues: parsed.error.flatten(),
      });
    }

    if (parsed.data.body) req.body = parsed.data.body;
    if (parsed.data.query) req.query = parsed.data.query;
    if (parsed.data.params) req.params = parsed.data.params;

    return next();
  };
};
