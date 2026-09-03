export class PaymentHttpError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const paymentErrors = {
  unauthorized: () => new PaymentHttpError(401, "UNAUTHORIZED", "Authentication is required."),
  forbidden: () => new PaymentHttpError(403, "FORBIDDEN", "You are not allowed to access this resource."),
  companyRequired: () => new PaymentHttpError(400, "COMPANY_REQUIRED", "Recruiter must have a company before buying credits."),
  invalidPackage: () => new PaymentHttpError(400, "INVALID_PACKAGE", "Selected credit package is invalid."),
  paymentNotFound: () => new PaymentHttpError(404, "PAYMENT_NOT_FOUND", "Payment was not found."),
  missingStripeConfig: () => new PaymentHttpError(500, "STRIPE_CONFIG_MISSING", "Stripe configuration is missing."),
  invalidWebhookSignature: () => new PaymentHttpError(400, "INVALID_WEBHOOK_SIGNATURE", "Invalid Stripe webhook signature."),
};
