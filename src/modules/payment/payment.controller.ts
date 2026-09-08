import { Request, Response } from "express";

import { PaymentService } from "./payment.service";
import { sendResponse } from "../../app/common/responses/api-response";
import { CreateCheckoutInput, PaymentListQuery } from "./payment.types";

export class PaymentController {
  static async createCheckout(req: Request, res: Response) {
    const result = await PaymentService.createCheckoutSession(
      req.user!.id,
      req.body as CreateCheckoutInput
    );

    return sendResponse(
      res,
      201,
      "Checkout session created successfully",
      result
    );
  }

  static async listPayments(req: Request, res: Response) {
    const result = await PaymentService.listRecruiterPayments(
      req.user!.id,
      req.query as unknown as PaymentListQuery
    );

    return sendResponse(
      res,
      200,
      "Payments fetched successfully",
      result
    );
  }

  static async getPaymentById(req: Request, res: Response) {
    const result = await PaymentService.getRecruiterPaymentById(
      req.user!.id,
      req.params.id as string
    );

    return sendResponse(
      res,
      200,
      "Payment fetched successfully",
      result
    );
  }

  static async handleWebhook(req: Request, res: Response) {
    const signature = req.headers["stripe-signature"];

    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(JSON.stringify(req.body));

    const event = PaymentService.constructWebhookEvent(rawBody, signature);
    const result = await PaymentService.handleWebhookEvent(event);

    return res.status(200).json({
      received: true,
      result,
    });
  }
}