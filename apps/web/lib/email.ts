import { sendEmail } from '@marketing-alpha/email-service';
import {
  ScanCompleteEmail,
  PaymentReceiptEmail,
} from '@marketing-alpha/email-templates';

/**
 * Legacy wrappers — kept for backward compatibility with existing callers.
 * New code should use sendEmail() from @marketing-alpha/email-service directly.
 */

export async function sendScanCompleteEmail(to: string, scanId: string, domain: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://marketingalphascan.com';
  return sendEmail({
    to,
    template: 'scan-complete',
    subject: `Your scan of ${domain} is ready`,
    react: ScanCompleteEmail({
      targetDomain: domain,
      scanId,
      marketingIQ: 0,
      marketingIQLabel: 'Pending',
      categoryScores: [],
      topFinding: '',
      scanUrl: `${baseUrl}/scan/${scanId}`,
      reportUrl: `${baseUrl}/scan/${scanId}?upgrade=true`,
    }),
    referenceId: scanId,
  });
}

export async function sendPaymentReceiptEmail(
  to: string,
  product: string,
  amountCents: number,
) {
  const productNames: Record<string, string> = {
    alpha_brief: 'Alpha Brief',
    alpha_brief_plus: 'Alpha Brief Plus',
    chat_credits_15: 'Chat Credits (15)',
    chat_credits: 'Chat Credits (100)',
  };
  const productName = productNames[product] ?? product;
  const amount = (amountCents / 100).toFixed(2);

  return sendEmail({
    to,
    template: 'payment-receipt',
    subject: `Receipt: ${productName} — $${amount}`,
    react: PaymentReceiptEmail({
      productName,
      amount,
      currency: 'usd',
      receiptDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      stripeReceiptUrl: '',
    }),
  });
}
