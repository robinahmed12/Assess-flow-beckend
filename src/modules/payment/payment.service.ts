import Stripe from "stripe";

import { prisma } from "../../lib/prisma";
import {
  CREDIT_PACKAGES,
  CreditPackageCode,
} from "../../app/common/utils/payment.constants";
import { paymentErrors } from "../../app/common/errors/payment.errors";
import config from "../../app/config";
import { PaymentListQuery, WebhookProcessResult } from "./payment.types";

type PaymentFailureStatus = "FAILED";

export class PaymentService {
  private static getStripe() {
    const secretKey = config.stripe_secret_key || process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      throw paymentErrors.missingStripeConfig();
    }

    return new Stripe(secretKey);
  }

  private static getWebhookSecret() {
    const webhookSecret =
      config.stripe_webhook_secret || process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw paymentErrors.missingStripeConfig();
    }

    return webhookSecret;
  }

  private static getSuccessUrl() {
    return (
      config.stripe_success_url ||
      process.env.STRIPE_SUCCESS_URL ||
      "http://localhost:3000/payments/success?session_id={CHECKOUT_SESSION_ID}"
    );
  }

  private static getCancelUrl() {
    return (
      config.stripe_cancel_url ||
      process.env.STRIPE_CANCEL_URL ||
      "http://localhost:3000/payments/cancel"
    );
  }

  private static toDollars(amountInCents: number) {
    return amountInCents / 100;
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
      throw paymentErrors.companyRequired();
    }

    return {
      recruiter,
      company: recruiter.company,
    };
  }

  static async createCheckoutSession(
    recruiterId: string,
    data: {
      packageCode: CreditPackageCode;
    }
  ) {
    const selectedPackage = CREDIT_PACKAGES[data.packageCode];

    if (!selectedPackage) {
      throw paymentErrors.invalidPackage();
    }

    const { recruiter, company } = await this.getRecruiterCompany(recruiterId);

    const stripe = this.getStripe();

    const payment = await prisma.payment.create({
      data: {
        amount: this.toDollars(selectedPackage.amountInCents),
        creditsPurchased: selectedPackage.credits,
        status: "PENDING",
        companyId: company.id,
      },
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: this.getSuccessUrl(),
      cancel_url: this.getCancelUrl(),
      customer_email: recruiter.email,

      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: selectedPackage.currency,
            unit_amount: selectedPackage.amountInCents,
            product_data: {
              name: selectedPackage.name,
              metadata: {
                packageCode: selectedPackage.code,
                credits: String(selectedPackage.credits),
              },
            },
          },
        },
      ],

      metadata: {
        paymentId: payment.id,
        companyId: company.id,
        recruiterId,
        packageCode: selectedPackage.code,
        creditsPurchased: String(selectedPackage.credits),
      },

      payment_intent_data: {
        metadata: {
          paymentId: payment.id,
          companyId: company.id,
          recruiterId,
          packageCode: selectedPackage.code,
          creditsPurchased: String(selectedPackage.credits),
        },
      },
    });

    const updatedPayment = await prisma.payment.update({
      where: {
        id: payment.id,
      },
      data: {
        stripeSessionId: session.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: recruiterId,
        action: "PAYMENT_CHECKOUT_CREATED",
        entityType: "Payment",
        entityId: payment.id,
        metadata: {
          stripeSessionId: session.id,
          packageCode: selectedPackage.code,
          creditsPurchased: selectedPackage.credits,
          amount: updatedPayment.amount,
        },
      },
    });

    return {
      payment: updatedPayment,
      checkout: {
        sessionId: session.id,
        url: session.url,
      },
    };
  }

  static async listRecruiterPayments(
    recruiterId: string,
    query: PaymentListQuery
  ) {
    const { company } = await this.getRecruiterCompany(recruiterId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      companyId: company.id,
      ...(query.status ? { status: query.status } : {}),
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
        skip,
        take: limit,
      }),
    ]);

    return {
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      data: items,
    };
  }

  static async getRecruiterPaymentById(
    recruiterId: string,
    paymentId: string
  ) {
    const { company } = await this.getRecruiterCompany(recruiterId);

    const payment = await prisma.payment.findFirst({
      where: {
        id: paymentId,
        companyId: company.id,
      },
    });

    if (!payment) {
      throw paymentErrors.paymentNotFound();
    }

    return payment;
  }

  static constructWebhookEvent(
    rawBody: Buffer,
    signature: string | string[] | undefined
  ) {
    if (!signature || Array.isArray(signature)) {
      throw paymentErrors.invalidWebhookSignature();
    }

    try {
      return this.getStripe().webhooks.constructEvent(
        rawBody,
        signature,
        this.getWebhookSecret()
      );
    } catch (_error) {
      throw paymentErrors.invalidWebhookSignature();
    }
  }

  static async handleWebhookEvent(
    event: Stripe.Event
  ): Promise<WebhookProcessResult> {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        return this.handleCheckoutSessionCompleted(session);
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        return this.handleCheckoutSessionFailed(
          session,
          "FAILED",
          "CHECKOUT_SESSION_EXPIRED"
        );
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        return this.handlePaymentIntentFailed(paymentIntent);
      }

      default:
        return {
          processed: false,
          eventType: event.type,
          message: "Webhook event ignored",
        };
    }
  }

  private static async handleCheckoutSessionCompleted(
    session: Stripe.Checkout.Session
  ): Promise<WebhookProcessResult> {
    const paymentId = session.metadata?.paymentId;

    if (!paymentId) {
      return {
        processed: false,
        message: "Missing paymentId metadata",
      };
    }

    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: {
          id: paymentId,
        },
      });

      if (!payment) {
        return {
          processed: false,
          message: "Payment not found",
        };
      }

      if (payment.status === "SUCCEEDED") {
        return {
          processed: true,
          idempotent: true,
          paymentId: payment.id,
          message: "Payment already succeeded. Credits were not granted again.",
        };
      }

      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id;

      const updatedPayment = await tx.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          status: "SUCCEEDED",
          stripePaymentIntentId:
            paymentIntentId || payment.stripePaymentIntentId,
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
          action: "PAYMENT_SUCCEEDED_CREDITS_GRANTED",
          entityType: "Payment",
          entityId: payment.id,
          metadata: {
            stripeSessionId: session.id,
            stripePaymentIntentId: paymentIntentId,
            companyId: payment.companyId,
            creditsPurchased: payment.creditsPurchased,
            companyCreditsAfter: updatedCompany.credits,
          },
        },
      });

      return {
        processed: true,
        idempotent: false,
        payment: updatedPayment,
        companyCredits: updatedCompany.credits,
      };
    });
  }

  private static async handleCheckoutSessionFailed(
    session: Stripe.Checkout.Session,
    status: PaymentFailureStatus,
    action: string
  ): Promise<WebhookProcessResult> {
    const paymentId = session.metadata?.paymentId;

    if (!paymentId) {
      return {
        processed: false,
        message: "Missing paymentId metadata",
      };
    }

    const payment = await prisma.payment.findUnique({
      where: {
        id: paymentId,
      },
    });

    if (!payment || payment.status === "SUCCEEDED") {
      return {
        processed: false,
        message: "Payment not found or already succeeded",
      };
    }

    const updatedPayment = await prisma.payment.update({
      where: {
        id: payment.id,
      },
      data: {
        status,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: null,
        action,
        entityType: "Payment",
        entityId: payment.id,
        metadata: {
          stripeSessionId: session.id,
          previousStatus: payment.status,
          newStatus: updatedPayment.status,
        },
      },
    });

    return {
      processed: true,
      payment: updatedPayment,
    };
  }

  private static async handlePaymentIntentFailed(
    paymentIntent: Stripe.PaymentIntent
  ): Promise<WebhookProcessResult> {
    const paymentId = paymentIntent.metadata?.paymentId;

    const payment = paymentId
      ? await prisma.payment.findUnique({
          where: {
            id: paymentId,
          },
        })
      : await prisma.payment.findFirst({
          where: {
            stripePaymentIntentId: paymentIntent.id,
          },
        });

    if (!payment || payment.status === "SUCCEEDED") {
      return {
        processed: false,
        message: "Payment not found or already succeeded",
      };
    }

    const updatedPayment = await prisma.payment.update({
      where: {
        id: payment.id,
      },
      data: {
        status: "FAILED",
        stripePaymentIntentId:
          payment.stripePaymentIntentId || paymentIntent.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: null,
        action: "PAYMENT_FAILED",
        entityType: "Payment",
        entityId: payment.id,
        metadata: {
          stripePaymentIntentId: paymentIntent.id,
          previousStatus: payment.status,
          newStatus: updatedPayment.status,
        },
      },
    });

    return {
      processed: true,
      payment: updatedPayment,
    };
  }
}