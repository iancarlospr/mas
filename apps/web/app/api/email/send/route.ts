import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@marketing-alpha/email-service';
import {
  WelcomeEmail,
  ScanStartedEmail,
  ScanCompleteEmail,
  PaymentReceiptEmail,
  ReportReadyEmail,
  ScanFailedEmail,
  AccountDeletionEmail,
} from '@marketing-alpha/email-templates';
import { createServiceClient } from '@/lib/supabase/server';

/** POST /api/email/send — Internal email trigger endpoint.
 *  Called by app logic (not user-facing). Expects JSON body with template + data. */
export async function POST(request: NextRequest) {
  // Verify internal call via secret header
  const secret = request.headers.get('x-internal-secret');
  const expectedSecret = process.env.INTERNAL_API_SECRET;
  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { template, userId, data } = body as {
    template: string;
    userId?: string;
    data: Record<string, unknown>;
  };

  // Resolve user email
  let email = data.email as string | undefined;
  if (!email && userId) {
    const supabase = createServiceClient();
    const { data: userData } = await supabase.auth.admin.getUserById(userId);
    email = userData?.user?.email ?? undefined;
  }
  if (!email) {
    return NextResponse.json({ error: 'No email address' }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://marketingalphascan.com';

  try {
    switch (template) {
      case 'welcome': {
        const scanUrl = `${baseUrl}/?focus=scan`;
        const result = await sendEmail({
          to: email,
          userId,
          template: 'welcome',
          subject: 'Welcome to MarketingAlphaScan — run your first Full Scan',
          react: WelcomeEmail({ email, scanUrl }),
          referenceId: userId,
        });
        return NextResponse.json(result);
      }

      case 'scan-started': {
        const d = data as { targetDomain: string; scanId: string };
        const scanUrl = `${baseUrl}/scan/${d.scanId}`;
        const result = await sendEmail({
          to: email,
          userId,
          template: 'scan-started',
          subject: `Scanning ${d.targetDomain} — results in ~3 minutes`,
          react: ScanStartedEmail({
            targetDomain: d.targetDomain,
            scanId: d.scanId,
            scanUrl,
          }),
          referenceId: d.scanId,
        });
        return NextResponse.json(result);
      }

      case 'scan-complete': {
        const d = data as {
          targetDomain: string;
          scanId: string;
          marketingIQ: number;
          marketingIQLabel: string;
          categoryScores: Array<{ name: string; score: number; light: 'green' | 'yellow' | 'red' }>;
          topFinding: string;
        };
        const scanUrl = `${baseUrl}/scan/${d.scanId}`;
        const reportUrl = `${baseUrl}/scan/${d.scanId}?upgrade=true`;
        const result = await sendEmail({
          to: email,
          userId,
          template: 'scan-complete',
          subject: `${d.targetDomain} scored ${d.marketingIQ}/100 — your Full Scan is ready`,
          react: ScanCompleteEmail({
            ...d,
            scanUrl,
            reportUrl,
          }),
          referenceId: d.scanId,
        });
        return NextResponse.json(result);
      }

      case 'payment-receipt': {
        const d = data as {
          productName: string;
          amount: string;
          currency: string;
          receiptDate: string;
          stripeReceiptUrl: string;
          scanUrl?: string;
        };
        const result = await sendEmail({
          to: email,
          userId,
          template: 'payment-receipt',
          subject: `Receipt: ${d.productName} — MarketingAlphaScan`,
          react: PaymentReceiptEmail(d),
          critical: false,
        });
        return NextResponse.json(result);
      }

      case 'report-ready': {
        const d = data as { targetDomain: string; scanId: string };
        const reportUrl = `${baseUrl}/report/${d.scanId}`;
        const pdfUrl = `${baseUrl}/api/reports/${d.scanId}/pdf`;
        const chatUrl = `${baseUrl}/chat/${d.scanId}`;
        const result = await sendEmail({
          to: email,
          userId,
          template: 'report-ready',
          subject: `Your Alpha Brief for ${d.targetDomain} is ready`,
          react: ReportReadyEmail({
            targetDomain: d.targetDomain,
            reportUrl,
            pdfUrl,
            chatUrl,
          }),
          referenceId: d.scanId,
        });
        return NextResponse.json(result);
      }

      case 'scan-failed': {
        const d = data as {
          targetDomain: string;
          scanId: string;
          failureReason: 'unreachable' | 'blocked' | 'timeout' | 'error';
        };
        const scanUrl = `${baseUrl}/scan/${d.scanId}`;
        const result = await sendEmail({
          to: email,
          userId,
          template: 'scan-failed',
          subject: `Scan could not complete for ${d.targetDomain}`,
          react: ScanFailedEmail({
            targetDomain: d.targetDomain,
            failureReason: d.failureReason,
            scanUrl,
          }),
          referenceId: d.scanId,
        });
        return NextResponse.json(result);
      }

      case 'account-deletion': {
        const result = await sendEmail({
          to: email,
          userId,
          template: 'account-deletion',
          subject: 'Your MarketingAlphaScan account has been deleted',
          react: AccountDeletionEmail({
            email,
            deletionDate: new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }),
          }),
          referenceId: userId,
        });
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({ error: `Unknown template: ${template}` }, { status: 400 });
    }
  } catch (err) {
    console.error(`[email/send] Failed to send template="${template}" to="${email}":`, err);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
