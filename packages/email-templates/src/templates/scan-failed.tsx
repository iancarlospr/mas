import { Heading, Text, Preview } from '@react-email/components';
import { EmailLayout } from '../components/email-layout';
import { CTAButton } from '../components/cta-button';
import { AlertBox } from '../components/alert-box';

export interface ScanFailedEmailProps {
  targetDomain: string;
  failureReason: 'unreachable' | 'blocked' | 'timeout' | 'error';
  scanUrl: string;
}

const reasonMessages: Record<ScanFailedEmailProps['failureReason'], string> = {
  unreachable:
    'The site appears to be down or unreachable. It may be experiencing an outage — try again later.',
  blocked:
    'The site is actively blocking automated requests. Some sites use aggressive bot protection that prevents scanning.',
  timeout:
    'The scan took too long to complete. This usually happens with very large or slow-loading sites.',
  error:
    'An unexpected error occurred during the scan. Our team has been notified and is looking into it.',
};

export function ScanFailedEmail({
  targetDomain,
  failureReason,
  scanUrl,
}: ScanFailedEmailProps) {
  return (
    <EmailLayout preview={`Scan could not complete for ${targetDomain}`}>
      <Preview>Scan could not complete for {targetDomain}</Preview>
      <Heading style={h1}>We hit a snag</Heading>
      <Text style={domain}>{targetDomain}</Text>

      <AlertBox type="warning">{reasonMessages[failureReason]}</AlertBox>

      <div style={{ textAlign: 'center' as const, margin: '32px 0' }}>
        <CTAButton href={scanUrl}>Try Again</CTAButton>
      </div>

      <Text style={note}>
        This scan doesn&apos;t count against your daily limit.
      </Text>
    </EmailLayout>
  );
}

const h1 = {
  fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
  fontWeight: 800,
  fontSize: '28px',
  color: '#1A1A2E',
  lineHeight: '1.3',
  margin: '0 0 16px',
} as const;

const domain = {
  fontFamily: "'JetBrains Mono', monospace",
  fontWeight: 600,
  fontSize: '22px',
  color: '#1A1A2E',
  margin: '0 0 8px',
} as const;

const note = {
  fontSize: '14px',
  color: '#64748B',
  lineHeight: '1.5',
  margin: '0',
} as const;

export default ScanFailedEmail;
