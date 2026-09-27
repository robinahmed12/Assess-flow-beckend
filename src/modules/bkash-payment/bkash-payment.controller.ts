import { Request, Response } from "express";
import { BkashPaymentService } from "./bkash-payment.service";
import { sendResponse } from "../../app/common/responses/api-response";
import config from "../../app/config";

export class BkashPaymentController {
  static async createCheckout(req: Request, res: Response) {
    const result = await BkashPaymentService.createPayment(
      req.user!.id,
      req.body.packageCode,
    );

    return sendResponse(
      res,
      201,
      "bKash payment created successfully.",
      result,
    );
  }

  static async queryPayment(req: Request, res: Response) {
    const result = await BkashPaymentService.queryPayment(
      req.body.paymentID,
    );

    return sendResponse(
      res,
      200,
      "bKash payment status retrieved successfully.",
      result,
    );
  }

  static async handleCallback(req: Request, res: Response) {
    const frontendUrl = (config.frontend_url || "http://localhost:3000")
      .trim()
      .replace(/\/+$/, "");

    const status =
      typeof req.query.status === "string" ? req.query.status.toLowerCase() : "";
    const paymentID =
      typeof req.query.paymentID === "string" ? req.query.paymentID : "";

    const redirectToCancel = (reason: string) =>
      res.redirect(
        `${frontendUrl}/payments/cancel?reason=${encodeURIComponent(reason)}`,
      );

    try {
      const result = (await BkashPaymentService.handleCallback(
        req.query.status,
        req.query.paymentID,
      )) as { paymentId?: string; payment?: { id?: string } } | undefined;

      // The success branch returns `paymentId`; the cancel branch returns
      // `payment` (whose status is FAILED), so status must drive the branch.
      const paymentId = result?.paymentId ?? result?.payment?.id;

      if (status === "success" && paymentId) {
        return res.redirect(
          `${frontendUrl}/payments/bkash-success?payment=${encodeURIComponent(paymentId)}`,
        );
      }

      if (status === "cancel" || status === "cancelled") {
        return redirectToCancel("cancelled");
      }

      return redirectToCancel("failed");
    } catch (error) {
      console.error("[bkash] callback processing failed", {
        status,
        paymentID,
        error,
      });

      return redirectToCancel("error");
    }
  }

  static async listPayments(req: Request, res: Response) {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const status =
      typeof req.query.status === "string"
        ? req.query.status
        : undefined;

    const result = await BkashPaymentService.listRecruiterPayments(
      req.user!.id,
      page,
      limit,
      status,
    );

    return sendResponse(
      res,
      200,
      "Payments retrieved successfully.",
      result,
    );
  }

  static async getPaymentById(req: Request, res: Response) {
    const result = await BkashPaymentService.getRecruiterPaymentById(
      req.user!.id,
      req.params.id as string,
    );

    return sendResponse(
      res,
      200,
      "Payment retrieved successfully.",
      result,
    );
  }
}
