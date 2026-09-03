import express from "express";
import { paymentController } from "./payment.controller";
import { requireRecruiter } from "./payment.auth";
import { createCheckoutSchema, listPaymentsSchema, paymentIdParamSchema, validateRequest } from "./payment.validation";

export const paymentWebhookRouter = express.Router();
paymentWebhookRouter.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  paymentController.handleWebhook,
);

const paymentRouter = express.Router();

paymentRouter.post(
  "/checkout",
  requireRecruiter,
  validateRequest(createCheckoutSchema),
  paymentController.createCheckout,
);

paymentRouter.get(
  "/",
  requireRecruiter,
  validateRequest(listPaymentsSchema),
  paymentController.listPayments,
);

paymentRouter.get(
  "/:id",
  requireRecruiter,
  validateRequest(paymentIdParamSchema),
  paymentController.getPaymentById,
);

export default paymentRouter;
