export type CreditPackageCode = "STARTER" | "GROWTH" | "SCALE";

export const CREDIT_PACKAGES: Record<CreditPackageCode, {
  code: CreditPackageCode;
  name: string;
  amount: number;
  credits: number;
}> = {
  STARTER: {
    code: "STARTER",
    name: "Starter Credit Pack",
    amount: 500,
    credits: 10,
  },
  GROWTH: {
    code: "GROWTH",
    name: "Growth Credit Pack",
    amount: 2000,
    credits: 50,
  },
  SCALE: {
    code: "SCALE",
    name: "Scale Credit Pack",
    amount: 5000,
    credits: 150,
  },
};

export const BKASH_ACTIONS = {
  PAYMENT_CREATED: "BKASH_PAYMENT_CREATED",
  PAYMENT_EXECUTED: "BKASH_PAYMENT_EXECUTED_CREDITS_GRANTED",
  PAYMENT_ALREADY_SUCCEEDED: "BKASH_PAYMENT_ALREADY_SUCCEEDED",
  PAYMENT_FAILED: "BKASH_PAYMENT_FAILED",
  PAYMENT_CANCELLED: "BKASH_PAYMENT_CANCELLED",
  PAYMENT_QUERY: "BKASH_PAYMENT_QUERY",
} as const;
