import { CreditPackageCode } from "../../app/common/utils/payment.constants";

export type PaymentStatusFilter = "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED";

export interface CreateCheckoutInput {
  packageCode: CreditPackageCode;
}

export interface PaymentListQuery {
  page: number;
  limit: number;
  status?: PaymentStatusFilter;
}

export interface WebhookProcessResult {
  processed: boolean;
  idempotent?: boolean;
  eventType?: string;
  message?: string;
  paymentId?: string;
  payment?: unknown;
  companyCredits?: number;
}