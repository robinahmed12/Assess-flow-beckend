import { z } from "zod";
import { CREDIT_PACKAGES } from "../../app/common/utils/bkash-payment.constants";

const packageCodes = Object.keys(CREDIT_PACKAGES) as [string, ...string[]];

export const createBkashPaymentSchema = z.object({
  body: z.object({
    packageCode: z.enum(packageCodes),
  }),
  params: z.object({}),
  query: z.object({}),
});

export const executeBkashPaymentSchema = z.object({
  body: z.object({
    paymentID: z.string().min(1, "Payment ID is required"),
  }),
  params: z.object({}),
  query: z.object({}),
});

export const queryBkashPaymentSchema = z.object({
  body: z.object({
    paymentID: z.string().min(1, "Payment ID is required"),
  }),
  params: z.object({}),
  query: z.object({}),
});

export const bkashCallbackSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({
    status: z.string().min(1, "Callback status is required"),
    paymentID: z.string().min(1, "Payment ID is required"),
  }),
});

export const listPaymentsSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z
      .enum(["PENDING", "SUCCEEDED", "FAILED", "REFUNDED"])
      .optional(),
  }),
});

export const paymentIdParamSchema = z.object({
  body: z.object({}),
  params: z.object({
    id: z.string().uuid("Invalid payment ID"),
  }),
  query: z.object({}),
});
