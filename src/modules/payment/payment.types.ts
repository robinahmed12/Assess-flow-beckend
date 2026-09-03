import { Request } from "express";
import { CreditPackageCode } from "../../app/common/utils/payment.constants";

export type AuthUser = {
  id: string;
  role: "ADMIN" | "RECRUITER" | "CANDIDATE" | string;
  email?: string;
};

export type AuthenticatedRequest = Request & {
  user?: AuthUser;
};

export type CreateCheckoutPayload = {
  packageCode: CreditPackageCode;
};

export type PaymentListQuery = {
  page?: number;
  limit?: number;
  status?: string;
};
