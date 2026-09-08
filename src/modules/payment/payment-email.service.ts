import { transporter } from "../../lib/nodemailer";
import config from "../../app/config";

export class PaymentEmailService {
  static async sendPaymentSuccessEmail(params: {
    to: string;
    recruiterName: string;
    companyName: string;
    amount: number;
    currency: string;
    creditsPurchased: number;
    transactionId?: string | null;
    invoiceNumber: string;
    invoicePdfBuffer: Buffer;
  }) {
    await transporter.sendMail({
      from: config.smtp_user,
      to: params.to,
      subject: `Payment successful - Invoice ${params.invoiceNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #111827;">
          <h2>Payment Successful</h2>

          <p>Hi ${params.recruiterName},</p>

          <p>Your payment has been completed successfully.</p>

          <table style="border-collapse: collapse; margin-top: 16px;">
            <tr>
              <td style="padding: 6px 12px; font-weight: bold;">Company</td>
              <td style="padding: 6px 12px;">${params.companyName}</td>
            </tr>
            <tr>
              <td style="padding: 6px 12px; font-weight: bold;">Amount</td>
              <td style="padding: 6px 12px;">
                ${params.currency.toUpperCase()} ${params.amount.toFixed(2)}
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 12px; font-weight: bold;">Credits Purchased</td>
              <td style="padding: 6px 12px;">${params.creditsPurchased}</td>
            </tr>
            <tr>
              <td style="padding: 6px 12px; font-weight: bold;">Transaction ID</td>
              <td style="padding: 6px 12px;">${params.transactionId || "N/A"}</td>
            </tr>
            <tr>
              <td style="padding: 6px 12px; font-weight: bold;">Invoice</td>
              <td style="padding: 6px 12px;">${params.invoiceNumber}</td>
            </tr>
          </table>

          <p style="margin-top: 20px;">
            Your invoice PDF is attached with this email.
          </p>

          <p>Thank you.</p>
        </div>
      `,
      attachments: [
        {
          filename: `${params.invoiceNumber}.pdf`,
          content: params.invoicePdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });
  }
}
