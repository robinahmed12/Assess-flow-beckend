import { NextFunction, Request, Response } from "express";
import { getAuthUser } from "./payment.auth";
import { paymentService } from "./payment.service";
import { AuthenticatedRequest } from "./payment.types";

const success = (res: Response, message: string, data: unknown, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export const paymentController = {
  async createCheckout(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const result = await paymentService.createCheckoutSession(user.id, req.body.packageCode);
      return success(res, "Checkout session created successfully.", result, 201);
    } catch (error) {
      next(error);
    }
  },

  async listPayments(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 20);
      const status = typeof req.query.status === "string" ? req.query.status : undefined;

      const result = await paymentService.listRecruiterPayments(user.id, page, limit, status);
      return success(res, "Payments retrieved successfully.", result);
    } catch (error) {
      next(error);
    }
  },

  async getPaymentById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const result = await paymentService.getRecruiterPaymentById(user.id, req.params.id);
      return success(res, "Payment retrieved successfully.", result);
    } catch (error) {
      next(error);
    }
  },

  async handleWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const signature = req.headers["stripe-signature"];
      const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
      const event = paymentService.constructWebhookEvent(rawBody, signature);
      const result = await paymentService.handleWebhookEvent(event);

      return res.status(200).json({
        received: true,
        result,
      });
    } catch (error) {
      next(error);
    }
  },
};
