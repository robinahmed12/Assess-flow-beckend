import Stripe from "stripe";
import { prisma } from "../../lib/prisma";
import { CREDIT_PACKAGES, CreditPackageCode } from "../../app/common/utils/payment.constants";
import { paymentErrors } from "../../app/common/errors/payment.errors";

const getStripe = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw paymentErrors.missingStripeConfig();
  }

  return new Stripe(secretKey);

};

const getSuccessUrl = () => {
  return process.env.STRIPE_SUCCESS_URL || "http://localhost:3000/payments/success?session_id={CHECKOUT_SESSION_ID}";
};

const getCancelUrl = () => {
  return process.env.STRIPE_CANCEL_URL || "http://localhost:3000/payments/cancel";
};

const toDollars = (amountInCents: number) => amountInCents / 100;

export const paymentService = {
  async createCheckoutSession(recruiterId: string, packageCode: CreditPackageCode) {
    const selectedPackage = CREDIT_PACKAGES[packageCode];

    if (!selectedPackage) {
      throw paymentErrors.invalidPackage();
    }

    const recruiter = await prisma.user.findUnique({
      where: { id: recruiterId },
      include: { company: true },
    });

    if (!recruiter?.company) {
      throw paymentErrors.companyRequired();
    }

    const stripe = getStripe();

    const payment = await prisma.payment.create({
      data: {
        amount: toDollars(selectedPackage.amountInCents),
        creditsPurchased: selectedPackage.credits,
        status: "PENDING",
        companyId: recruiter.company.id,
      },
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: getSuccessUrl(),
      cancel_url: getCancelUrl(),
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
        companyId: recruiter.company.id,
        recruiterId,
        packageCode: selectedPackage.code,
        creditsPurchased: String(selectedPackage.credits),
      },
    });

    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
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
  },

  async listRecruiterPayments(recruiterId: string, page: number, limit: number, status?: string) {
    const recruiter = await prisma.user.findUnique({
      where: { id: recruiterId },
      include: { company: true },
    });

    if (!recruiter?.company) {
      throw paymentErrors.companyRequired();
    }

    const where = {
      companyId: recruiter.company.id,
      ...(status ? { status: status as any } : {}),
    };

    const [total, items] = await prisma.$transaction([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        orderBy: { createdAt: "desc" },
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
  },

  async getRecruiterPaymentById(recruiterId: string, paymentId: string) {
    const recruiter = await prisma.user.findUnique({
      where: { id: recruiterId },
      include: { company: true },
    });

    if (!recruiter?.company) {
      throw paymentErrors.companyRequired();
    }

    const payment = await prisma.payment.findFirst({
      where: {
        id: paymentId,
        companyId: recruiter.company.id,
      },
    });

    if (!payment) {
      throw paymentErrors.paymentNotFound();
    }

    return payment;
  },

  constructWebhookEvent(rawBody: Buffer, signature: string | string[] | undefined) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw paymentErrors.missingStripeConfig();
    }

    if (!signature || Array.isArray(signature)) {
      throw paymentErrors.invalidWebhookSignature();
    }

    try {
      return getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (_error) {
      throw paymentErrors.invalidWebhookSignature();
    }
  },

  async handleWebhookEvent(event: Stripe.Event) {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      return this.handleCheckoutSessionCompleted(session);
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      return this.handleCheckoutSessionFailed(session, "FAILED", "CHECKOUT_SESSION_EXPIRED");
    }

    if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      return this.handlePaymentIntentFailed(paymentIntent);
    }

    return {
      processed: false,
      eventType: event.type,
      message: "Webhook event ignored.",
    };
  },

  async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    const paymentId = session.metadata?.paymentId;

    if (!paymentId) {
      return {
        processed: false,
        message: "Missing paymentId metadata.",
      };
    }

    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
      });

      if (!payment) {
        return {
          processed: false,
          message: "Payment not found.",
        };
      }

      if (payment.status === "SUCCEEDED") {
        return {
          processed: true,
          idempotent: true,
          paymentId: payment.id,
          message: "Payment already succeeded. No credits granted again.",
        };
      }

      const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;

      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "SUCCEEDED",
          stripePaymentIntentId: paymentIntentId || payment.stripePaymentIntentId,
        },
      });

      const updatedCompany = await tx.company.update({
        where: { id: payment.companyId },
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
  },

  async handleCheckoutSessionFailed(session: Stripe.Checkout.Session, status: "FAILED", action: string) {
    const paymentId = session.metadata?.paymentId;

    if (!paymentId) {
      return {
        processed: false,
        message: "Missing paymentId metadata.",
      };
    }

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });

    if (!payment || payment.status === "SUCCEEDED") {
      return {
        processed: false,
        message: "Payment not found or already succeeded.",
      };
    }

    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: { status },
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
  },

  async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
    const payment = await prisma.payment.findFirst({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (!payment || payment.status === "SUCCEEDED") {
      return {
        processed: false,
        message: "Payment not found or already succeeded.",
      };
    }

    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED" },
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
  },
};
