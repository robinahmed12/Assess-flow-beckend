import express from "express";
import { UserRole } from "@prisma/client";

import { PaymentController } from "./payment.controller";
import {
  createCheckoutSchema,
  listPaymentsSchema,
  paymentIdParamSchema,
} from "./payment.validation";

import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../auth/authorize.middleware";
import { validateRequest } from "../../app/common/middleware/validate-request.middleware";
import { asyncHandler } from "../../app/common/utils/async-handler";

export const paymentWebhookRouter = express.Router();

paymentWebhookRouter.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  asyncHandler(PaymentController.handleWebhook)
);

const paymentRouter = express.Router();

paymentRouter.use(authenticate);
paymentRouter.use(authorize(UserRole.RECRUITER));

paymentRouter.post(
  "/checkout",
  validateRequest(createCheckoutSchema),
  asyncHandler(PaymentController.createCheckout)
);

paymentRouter.get(
  "/",
  validateRequest(listPaymentsSchema),
  asyncHandler(PaymentController.listPayments)
);

paymentRouter.get(
  "/:id",
  validateRequest(paymentIdParamSchema),
  asyncHandler(PaymentController.getPaymentById)
);

export default paymentRouter;