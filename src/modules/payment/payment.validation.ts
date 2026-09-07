import { z } from "zod";

export const createCheckoutSchema = z.object({
  body: z.object({
    packageCode: z.enum(["STARTER", "GROWTH", "SCALE"]),
  }),

  params: z.object({}),
  query: z.object({}),
});

export const listPaymentsSchema = z.object({
  body: z.object({}),

  params: z.object({}),

  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(["PENDING", "SUCCEEDED", "FAILED", "REFUNDED"]).optional(),
  }),
});

export const paymentIdParamSchema = z.object({
  body: z.object({}),

  params: z.object({
    id: z.string().uuid("Invalid payment id"),
  }),

  query: z.object({}),
});