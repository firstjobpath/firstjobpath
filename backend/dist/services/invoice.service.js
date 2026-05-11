import { customAlphabet } from "nanoid";
import { prisma } from "../lib/prisma.js";
const nano = customAlphabet("0123456789ABCDEFGHJKLMNPQRSTUVWXYZ", 8);
export async function createInvoiceForPayment(input) {
    const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}-${nano()}`;
    const lineItems = [
        {
            title: input.lineTitle ?? "FirstJobPath — course / booking",
            amount: input.amount.toString(),
            currency: input.currency,
        },
    ];
    return prisma.invoice.create({
        data: {
            paymentId: input.paymentId,
            invoiceNumber,
            lineItems,
            pdfUrl: null,
        },
    });
}
