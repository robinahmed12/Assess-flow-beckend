-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "bkashPaymentId" TEXT,
ADD COLUMN     "bkashTransactionId" TEXT,
ADD COLUMN     "invoiceEmailSentAt" TIMESTAMP(3),
ADD COLUMN     "invoiceNumber" TEXT;
