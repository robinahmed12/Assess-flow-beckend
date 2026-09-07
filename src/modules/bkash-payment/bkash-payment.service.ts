import { bkashPaymentErrors } from "../../app/common/errors/bkash-payment.errors";
import {
  BKASH_ACTIONS,
  CREDIT_PACKAGES,
  CreditPackageCode,
} from "../../app/common/utils/bkash-payment.constants";
import { prisma } from "../../lib/prisma";

import {
  BkashConfig,
  BkashCreatePaymentResponse,
  BkashExecutePaymentResponse,
  BkashGrantTokenResponse,
  BkashQueryPaymentResponse,
} from "./bkash-payment.types";

const SUCCESS_CODE = "0000";
const COMPLETED_STATUS = "Completed";

let cachedToken: { token: string; expiresAt: number } | null = null;

export class BkashPaymentService {
  private static getConfig(): BkashConfig {
    const baseUrl = process.env.BKASH_BASE_URL;
    const appKey = process.env.BKASH_APP_KEY;
    const appSecret = process.env.BKASH_APP_SECRET;
    const username = process.env.BKASH_USERNAME;
    const password = process.env.BKASH_PASSWORD;
    const callbackUrl = process.env.BKASH_CALLBACK_URL;

    if (
      !baseUrl ||
      !appKey ||
      !appSecret ||
      !username ||
      !password ||
      !callbackUrl
    ) {
      throw bkashPaymentErrors.missingConfig();
    }

    return {
      baseUrl: baseUrl.replace(/\/$/, ""),
      appKey,
      appSecret,
      username,
      password,
      callbackUrl,
    };
  }

  private static getAuthHeaders(config: BkashConfig, idToken: string) {
    return {
      Accept: "application/json",
      "Content-Type": "application/json",
      authorization: idToken,
      "x-app-key": config.appKey,
    };
  }

  private static async postToBkash<T>(
    url: string,
    headers: Record<string, string>,
    body: unknown,
  ): Promise<T> {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const data = (await response.json().catch(() => null)) as T | null;

    if (!response.ok || !data) {
      throw bkashPaymentErrors.bkashRequestFailed({
        status: response.status,
        data,
      });
    }

    return data;
  }

  private static isBkashSuccess(response: { statusCode?: string }) {
    return response.statusCode === SUCCESS_CODE;
  }

  private static isPaymentCompleted(response: {
    statusCode?: string;
    transactionStatus?: string;
  }) {
    return (
      this.isBkashSuccess(response) &&
      response.transactionStatus === COMPLETED_STATUS
    );
  }

  private static parseBkashStatus(value: unknown) {
    return typeof value === "string" ? value.toLowerCase() : "";
  }

  private static async getRecruiterCompany(recruiterId: string) {
    const recruiter = await prisma.user.findUnique({
      where: {
        id: recruiterId,
      },
      include: {
        company: true,
      },
    });

    if (!recruiter?.company) {
      throw bkashPaymentErrors.companyRequired();
    }

    return recruiter;
  }

  static async grantToken(forceRefresh = false) {
    const now = Date.now();

    if (
      !forceRefresh &&
      cachedToken &&
      cachedToken.expiresAt > now + 60_000
    ) {
      return cachedToken.token;
    }

    const config = this.getConfig();

    const tokenResponse = await this.postToBkash<BkashGrantTokenResponse>(
      `${config.baseUrl}/tokenized/checkout/token/grant`,
      {
        Accept: "application/json",
        "Content-Type": "application/json",
        username: config.username,
        password: config.password,
      },
      {
        app_key: config.appKey,
        app_secret: config.appSecret,
      },
    );

    if (!this.isBkashSuccess(tokenResponse) || !tokenResponse.id_token) {
      throw bkashPaymentErrors.bkashRequestFailed(tokenResponse);
    }

    const expiresInSeconds = Number(tokenResponse.expires_in || 3600);

    cachedToken = {
      token: tokenResponse.id_token,
      expiresAt: now + expiresInSeconds * 1000,
    };

    return cachedToken.token;
  }

  static async createPayment(
    recruiterId: string,
    packageCode: CreditPackageCode,
  ) {
    const selectedPackage = CREDIT_PACKAGES[packageCode];

    if (!selectedPackage) {
      throw bkashPaymentErrors.invalidPackage();
    }

    const recruiter = await this.getRecruiterCompany(recruiterId);
    const config = this.getConfig();
    const idToken = await this.grantToken();

    const payment = await prisma.payment.create({
      data: {
        amount: selectedPackage.amount,
        creditsPurchased: selectedPackage.credits,
        status: "PENDING",
        companyId: recruiter.company!.id,
      },
    });

    const createResponse =
      await this.postToBkash<BkashCreatePaymentResponse>(
        `${config.baseUrl}/tokenized/checkout/create`,
        this.getAuthHeaders(config, idToken),
        {
          mode: "0011",
          payerReference: recruiter.email || recruiter.id,
          callbackURL: config.callbackUrl,
          amount: selectedPackage.amount.toFixed(2),
          currency: "BDT",
          intent: "sale",
          merchantInvoiceNumber: payment.id,
        },
      );

    if (
      !this.isBkashSuccess(createResponse) ||
      !createResponse.paymentID ||
      !createResponse.bkashURL
    ) {
      await prisma.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          status: "FAILED",
        },
      });

      await prisma.auditLog.create({
        data: {
          actorId: recruiterId,
          action: BKASH_ACTIONS.PAYMENT_FAILED,
          entityType: "Payment",
          entityId: payment.id,
        },
      });

      throw bkashPaymentErrors.bkashRequestFailed(createResponse);
    }

    const updatedPayment = await prisma.payment.update({
      where: {
        id: payment.id,
      },
      data: {
        stripeSessionId: createResponse.paymentID,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: recruiterId,
        action: BKASH_ACTIONS.PAYMENT_CREATED,
        entityType: "Payment",
        entityId: payment.id,
        metadata: {
          provider: "BKASH_TOKENIZED",
          packageCode,
          creditsPurchased: selectedPackage.credits,
          amount: selectedPackage.amount,
          bkashPaymentID: createResponse.paymentID,
          bkashURL: createResponse.bkashURL,
        },
      },
    });

    return {
      payment: updatedPayment,
      bkash: {
        paymentID: createResponse.paymentID,
        bkashURL: createResponse.bkashURL,
        callbackURL: createResponse.callbackURL,
        merchantInvoiceNumber: payment.id,
      },
    };
  }

  static async executePayment(paymentID: string) {
    if (!paymentID) {
      throw bkashPaymentErrors.paymentIdRequired();
    }

    const config = this.getConfig();
    const idToken = await this.grantToken();

    const executeResponse =
      await this.postToBkash<BkashExecutePaymentResponse>(
        `${config.baseUrl}/tokenized/checkout/execute`,
        this.getAuthHeaders(config, idToken),
        {
          paymentID,
        },
      );

    if (!this.isPaymentCompleted(executeResponse)) {
      throw bkashPaymentErrors.paymentNotSuccessful(executeResponse);
    }

    return this.grantCreditsAfterSuccessfulBkashPayment(executeResponse);
  }

  private static async grantCreditsAfterSuccessfulBkashPayment(
    executeResponse: BkashExecutePaymentResponse,
  ) {
    const paymentID = executeResponse.paymentID;

    if (!paymentID) {
      throw bkashPaymentErrors.paymentIdRequired();
    }

    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: {
          stripeSessionId: paymentID,
        },
      });

      if (!payment) {
        throw bkashPaymentErrors.paymentNotFound();
      }

      if (payment.status === "SUCCEEDED") {
        await tx.auditLog.create({
          data: {
            actorId: null,
            action: BKASH_ACTIONS.PAYMENT_ALREADY_SUCCEEDED,
            entityType: "Payment",
            entityId: payment.id,
            metadata: {
              provider: "BKASH_TOKENIZED",
              paymentID,
              trxID: executeResponse.trxID,
              message:
                "Idempotent call: credits were not granted again.",
            },
          },
        });

        return {
          idempotent: true,
          payment,
          bkash: executeResponse,
        };
      }

      const updatedPayment = await tx.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          status: "SUCCEEDED",
          stripePaymentIntentId:
            executeResponse.trxID || payment.stripePaymentIntentId,
        },
      });

      const updatedCompany = await tx.company.update({
        where: {
          id: payment.companyId,
        },
        data: {
          credits: {
            increment: payment.creditsPurchased,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: null,
          action: BKASH_ACTIONS.PAYMENT_EXECUTED,
          entityType: "Payment",
          entityId: payment.id,
          metadata: {
            provider: "BKASH_TOKENIZED",
            paymentID,
            trxID: executeResponse.trxID,
            transactionStatus: executeResponse.transactionStatus,
            amount: executeResponse.amount,
            companyId: payment.companyId,
            creditsPurchased: payment.creditsPurchased,
            companyCreditsAfter: updatedCompany.credits,
          },
        },
      });

      return {
        idempotent: false,
        payment: updatedPayment,
        companyCredits: updatedCompany.credits,
        bkash: executeResponse,
      };
    });
  }

  static async queryPayment(paymentID: string) {
    if (!paymentID) {
      throw bkashPaymentErrors.paymentIdRequired();
    }

    const config = this.getConfig();
    const idToken = await this.grantToken();

    const queryResponse =
      await this.postToBkash<BkashQueryPaymentResponse>(
        `${config.baseUrl}/tokenized/checkout/payment/status`,
        this.getAuthHeaders(config, idToken),
        {
          paymentID,
        },
      );

    await prisma.auditLog.create({
      data: {
        actorId: null,
        action: BKASH_ACTIONS.PAYMENT_QUERY,
        entityType: "Payment",
        entityId: paymentID,
      },
    });

    return queryResponse;
  }

  static async handleCallback(status: unknown, paymentID: unknown) {
    const normalizedStatus = this.parseBkashStatus(status);
    const bkashPaymentID =
      typeof paymentID === "string" ? paymentID : "";

    if (!bkashPaymentID) {
      throw bkashPaymentErrors.invalidCallback();
    }

    if (normalizedStatus === "success") {
      return this.executePayment(bkashPaymentID);
    }

    const action =
      normalizedStatus === "cancel" ||
      normalizedStatus === "cancelled"
        ? BKASH_ACTIONS.PAYMENT_CANCELLED
        : BKASH_ACTIONS.PAYMENT_FAILED;

    const payment = await prisma.payment.findFirst({
      where: {
        stripeSessionId: bkashPaymentID,
      },
    });

    if (!payment) {
      throw bkashPaymentErrors.paymentNotFound();
    }

    if (payment.status !== "SUCCEEDED") {
      const updatedPayment = await prisma.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          status: "FAILED",
        },
      });

      await prisma.auditLog.create({
        data: {
          actorId: null,
          action,
          entityType: "Payment",
          entityId: payment.id,
          metadata: {
            provider: "BKASH_TOKENIZED",
            paymentID: bkashPaymentID,
            callbackStatus: normalizedStatus,
            previousStatus: payment.status,
            newStatus: updatedPayment.status,
          },
        },
      });

      return {
        payment: updatedPayment,
        callbackStatus: normalizedStatus,
      };
    }

    return {
      payment,
      callbackStatus: normalizedStatus,
      idempotent: true,
    };
  }

  static async listRecruiterPayments(
    recruiterId: string,
    page: number,
    limit: number,
    status?: string,
  ) {
    const recruiter = await this.getRecruiterCompany(recruiterId);

    const where = {
      companyId: recruiter.company!.id,
      ...(status ? { status: status as any } : {}),
    };

    const [total, items] = await prisma.$transaction([
      prisma.payment.count({
        where,
      }),
      prisma.payment.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getRecruiterPaymentById(
    recruiterId: string,
    paymentId: string,
  ) {
    const recruiter = await this.getRecruiterCompany(recruiterId);

    const payment = await prisma.payment.findFirst({
      where: {
        id: paymentId,
        companyId: recruiter.company!.id,
      },
    });

    if (!payment) {
      throw bkashPaymentErrors.paymentNotFound();
    }

    return payment;
  }
}
