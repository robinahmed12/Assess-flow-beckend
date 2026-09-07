import PDFDocument from "pdfkit";
import { PaymentInvoiceData } from "./invoice.types";

export class InvoiceService {
  static generateInvoiceNumber(paymentId: string) {
    const shortId = paymentId.slice(0, 8).toUpperCase();
    const timestamp = Date.now();

    return `INV-${timestamp}-${shortId}`;
  }

  static async generatePaymentInvoicePdf(
    invoice: PaymentInvoiceData,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
      });

      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => {
        chunks.push(chunk);
      });

      doc.on("end", () => {
        resolve(Buffer.concat(chunks));
      });

      doc.on("error", reject);

      // Header
      doc.fontSize(22).text("Payment Invoice", {
        align: "center",
      });

      doc.moveDown();

      doc
        .fontSize(10)
        .text(`Invoice No: ${invoice.invoiceNumber}`)
        .text(`Payment ID: ${invoice.paymentId}`)
        .text(`Date: ${invoice.paymentDate.toLocaleString()}`)
        .text(`Status: ${invoice.status}`);

      doc.moveDown();

      // Company / customer info
      doc.fontSize(14).text("Bill To", {
        underline: true,
      });

      doc.moveDown(0.5);

      doc
        .fontSize(10)
        .text(`Company: ${invoice.companyName}`)
        .text(`Recruiter: ${invoice.recruiterName}`)
        .text(`Email: ${invoice.recruiterEmail}`);

      doc.moveDown();

      // Payment info
      doc.fontSize(14).text("Payment Details", {
        underline: true,
      });

      doc.moveDown(0.5);

      doc
        .fontSize(10)
        .text(`Payment Method: ${invoice.paymentMethod}`)
        .text(`Transaction ID: ${invoice.transactionId || "N/A"}`);

      doc.moveDown();

      // Table header
      const tableTop = doc.y + 10;
      const itemX = 50;
      const creditsX = 300;
      const amountX = 420;

      doc
        .fontSize(11)
        .text("Description", itemX, tableTop)
        .text("Credits", creditsX, tableTop)
        .text("Amount", amountX, tableTop);

      doc
        .moveTo(50, tableTop + 18)
        .lineTo(545, tableTop + 18)
        .stroke();

      const rowY = tableTop + 30;

      doc
        .fontSize(10)
        .text("Credit package purchase", itemX, rowY)
        .text(String(invoice.creditsPurchased), creditsX, rowY)
        .text(
          `${invoice.currency.toUpperCase()} ${invoice.amount.toFixed(2)}`,
          amountX,
          rowY,
        );

      doc
        .moveTo(50, rowY + 25)
        .lineTo(545, rowY + 25)
        .stroke();

      doc
        .fontSize(12)
        .text("Total", creditsX, rowY + 45)
        .text(
          `${invoice.currency.toUpperCase()} ${invoice.amount.toFixed(2)}`,
          amountX,
          rowY + 45,
        );

      doc.moveDown(5);

      doc
        .fontSize(9)
        .fillColor("#666666")
        .text(
          "This is an automatically generated invoice. No signature is required.",
          50,
          720,
          {
            align: "center",
          },
        );

      doc.end();
    });
  }
}
