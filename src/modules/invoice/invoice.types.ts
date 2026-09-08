export interface PaymentInvoiceData {
  invoiceNumber: string;
  paymentId: string;
  paymentDate: Date;

  companyName: string;
  recruiterName: string;
  recruiterEmail: string;

  paymentMethod: string;
  transactionId?: string | null;

  creditsPurchased: number;
  amount: number;
  currency: string;
  status: string;
}