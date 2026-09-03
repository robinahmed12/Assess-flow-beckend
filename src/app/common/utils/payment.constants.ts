export type CreditPackageCode = "STARTER" | "GROWTH" | "SCALE";

export type CreditPackage = {
  code: CreditPackageCode;
  name: string;
  credits: number;
  amountInCents: number;
  currency: string;
};

/**
 * Server-controlled pricing. Never trust amount or credit count from client.
 * Update these values to match your assignment/demo pricing.
 */
export const CREDIT_PACKAGES: Record<CreditPackageCode, CreditPackage> = {
  STARTER: {
    code: "STARTER",
    name: "Starter - 10 assessment credits",
    credits: 10,
    amountInCents: 1000,
    currency: "usd",
  },
  GROWTH: {
    code: "GROWTH",
    name: "Growth - 50 assessment credits",
    credits: 50,
    amountInCents: 4000,
    currency: "usd",
  },
  SCALE: {
    code: "SCALE",
    name: "Scale - 150 assessment credits",
    credits: 150,
    amountInCents: 10000,
    currency: "usd",
  },
};
