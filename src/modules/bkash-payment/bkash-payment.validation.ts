import { NextFunction, Request, Response } from "express";
import { z, ZodSchema, ZodTypeAny } from "zod";
import { CREDIT_PACKAGES } from "../../app/common/utils/payment.constants";

const packageCodes = Object.keys(CREDIT_PACKAGES) as [string, ...string[]];
type ValidationSchema = {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
};

type ParsedRequestData = {
  body?: unknown;
  params?: unknown;
  query?: unknown;
};

export const createBkashPaymentSchema = z.object({
  body: z.object({
    packageCode: z.enum(packageCodes),
  }),
});

export const paymentIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const executeBkashPaymentSchema = z.object({
  body: z.object({
    paymentID: z.string().min(1),
  }),
});

export const queryBkashPaymentSchema = z.object({
  body: z.object({
    paymentID: z.string().min(1),
  }),
});

export const listPaymentsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(["PENDING", "SUCCEEDED", "FAILED", "REFUNDED"]).optional(),
  }),
});

export const validateRequest =
  (schema: ValidationSchema) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = z
      .object({
        body: schema.body ?? z.any(),
        params: schema.params ?? z.any(),
        query: schema.query ?? z.any(),
      })
      .safeParse({
        body: req.body,
        params: req.params,
        query: req.query,
      });

    if (!result.success) {
      return next(result.error);
    }

    const data = result.data as ParsedRequestData;

    if (data.body !== undefined) {
      req.body = data.body;
    }

    if (data.params !== undefined) {
      req.params = data.params as typeof req.params;
    }

    if (data.query !== undefined) {
      req.query = data.query as typeof req.query;
    }

    return next();
  };

type RequestHandler = (req: Request, res: Response, next: NextFunction) => void;
