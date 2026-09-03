export class BkashPaymentError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = "BkashPaymentError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const bkashPaymentErrors = {
  unauthorized: () => new BkashPaymentError(401, "Authentication required."),
  forbidden: () => new BkashPaymentError(403, "You are not allowed to perform this action."),
  companyRequired: () => new BkashPaymentError(400, "Recruiter company profile is required before buying credits."),
  invalidPackage: () => new BkashPaymentError(400, "Invalid credit package."),
  missingConfig: () => new BkashPaymentError(500, "bKash payment configuration is incomplete."),
  bkashRequestFailed: (details?: unknown) => new BkashPaymentError(502, "bKash request failed.", details),
  paymentNotFound: () => new BkashPaymentError(404, "Payment not found."),
  paymentIdRequired: () => new BkashPaymentError(400, "paymentID is required."),
  invalidCallback: () => new BkashPaymentError(400, "Invalid bKash callback payload."),
  paymentNotSuccessful: (details?: unknown) => new BkashPaymentError(400, "bKash payment is not successful.", details),
};
