import { Router } from "express";
import { bkashPaymentController } from "./bkash-payment.controller";
import { BkashPaymentRouteDeps } from "./bkash-payment.types";
import {
  createBkashPaymentSchema,
  executeBkashPaymentSchema,
  listPaymentsSchema,
  paymentIdParamSchema,
  queryBkashPaymentSchema,
  validateRequest,
} from "./bkash-payment.validation";

export const bkashPaymentCallbackRouter = Router();

bkashPaymentCallbackRouter.get(
  "/bkash/callback",
  bkashPaymentController.handleCallback,
);

export const createBkashPaymentRouter = ({ authenticate, authorizeRecruiter }: BkashPaymentRouteDeps) => {
  const router = Router();

  router.post(
    "/checkout",
    authenticate,
    authorizeRecruiter,
    //validateRequest(createBkashPaymentSchema),
    bkashPaymentController.createCheckout,
  );

  router.post(
    "/bkash/execute",
   // validateRequest(executeBkashPaymentSchema),
    bkashPaymentController.executePayment,
  );

  router.post(
    "/bkash/query",
    //validateRequest(queryBkashPaymentSchema),
    bkashPaymentController.queryPayment,
  );

  router.get(
    "/",
    authenticate,
    authorizeRecruiter,
    //validateRequest(listPaymentsSchema),
    bkashPaymentController.listPayments,
  );

  router.get(
    "/:id",
    authenticate,
    authorizeRecruiter,
    //validateRequest(paymentIdParamSchema),
    bkashPaymentController.getPaymentById,
  );

  return router;
};
