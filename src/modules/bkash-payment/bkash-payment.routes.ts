import { Router } from "express";
import { UserRole } from "@prisma/client";

import { BkashPaymentController } from "./bkash-payment.controller";
import {
  createBkashPaymentSchema,
  executeBkashPaymentSchema,
  listPaymentsSchema,
  paymentIdParamSchema,
  queryBkashPaymentSchema,
} from "./bkash-payment.validation";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../auth/authorize.middleware";
import { validateRequest } from "../../app/common/middleware/validate-request.middleware";
import { asyncHandler } from "../../app/common/utils/async-handler";

export const bkashPaymentCallbackRouter = Router();

bkashPaymentCallbackRouter.get(
  "/bkash/callback",
  //validateRequest(bkashCallbackSchema),
  asyncHandler(BkashPaymentController.handleCallback),
);

const router = Router();

// These routes were public in the existing implementation.
router.post(
  "/bkash/execute",
  validateRequest(executeBkashPaymentSchema),
  asyncHandler(BkashPaymentController.executePayment),
);

router.post(
  "/bkash/query",
  validateRequest(queryBkashPaymentSchema),
  asyncHandler(BkashPaymentController.queryPayment),
);

router.use(authenticate);
router.use(authorize(UserRole.RECRUITER));

router.post(
  "/checkout",
  validateRequest(createBkashPaymentSchema),
  asyncHandler(BkashPaymentController.createCheckout),
);

router.get(
  "/",
  validateRequest(listPaymentsSchema),
  asyncHandler(BkashPaymentController.listPayments),
);

router.get(
  "/:id",
  validateRequest(paymentIdParamSchema),
  asyncHandler(BkashPaymentController.getPaymentById),
);

export default router;
