import { NextFunction, Request, Response } from "express";
import { bkashPaymentService } from "./bkash-payment.service";
import { AuthenticatedRequest } from "./bkash-payment.types";
import { bkashPaymentErrors } from "../../app/common/errors/bkash-payment.errors";
import { sendResponse } from "../../app/common/responses/api-response";

const getAuthUser = (req: AuthenticatedRequest) => {
  if (!req.user?.id) {
    throw bkashPaymentErrors.unauthorized();
  }

  return req.user;
};

export const bkashPaymentController = {
  async createCheckout(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const result = await bkashPaymentService.createPayment(user.id, req.body.packageCode);
      return sendResponse(res, 201, "bKash payment created successfully.", result);
    } catch (error) {
      next(error);
    }
  },

  async executePayment(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await bkashPaymentService.executePayment(req.body.paymentID);
      return sendResponse(res, 200, "bKash payment executed successfully.", result);
    } catch (error) {
      next(error);
    }
  },

  async queryPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await bkashPaymentService.queryPayment(req.body.paymentID);
      return sendResponse(res, 200, "bKash payment status retrieved successfully.", result);
    } catch (error) {
      next(error);
    }
  },

  async handleCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await bkashPaymentService.handleCallback(req.query.status, req.query.paymentID);
      return sendResponse(res, 200, "bKash callback processed successfully.", result);
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

      const result = await bkashPaymentService.listRecruiterPayments(user.id, page, limit, status);
      return sendResponse(res, 200, "Payments retrieved successfully.", result);
    } catch (error) {
      next(error);
    }
  },

  async getPaymentById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const result = await bkashPaymentService.getRecruiterPaymentById(user.id, req.params.id as string);
      return sendResponse(res, 200, "Payment retrieved successfully.", result);
    } catch (error) {
      next(error);
    }
  },
};
