import { Heading, Text, Preview } from '@react-email/components';
import { EmailLayout } from '../components/email-layout';
import { CTAButton } from '../components/cta-button';
import { SecondaryLink } from '../components/secondary-link';

export interface ReportReadyEmailProps {
  targetDomain: string;
  reportUrl: string;
  pdfUrl: string;
  chatUrl: string;
}

export function ReportReadyEmail({
  targetDomain,
  reportUrl,
  pdfUrl,
  chatUrl,
}: ReportReadyEmailProps) {
  return (
    <EmailLayout preview={`Your Alpha Brief for ${targetDomain} is ready`}>
      <Preview>Your Alpha Brief for {targetDomain} is ready</Preview>
      <Heading style={h1}>Your Alpha Brief is ready</Heading>
      <Text style={domain}>{targetDomain}</Text>

      <div style={{ textAlign: 'center' as const, margin: '32px 0' }}>
        <CTAButton href={reportUrl}>View Report</CTAButton>
      </div>

      <div style={{ textAlign: 'center' as const, margin: '0 0 24px' }}>
        <SecondaryLink href={pdfUrl}>Download PDF</SecondaryLink>
      </div>

      <Text style={body}>
        You also have 50 AI Chat messages to explore your findings in depth.
      </Text>

      <div style={{ textAlign: 'center' as const, margin: '24px 0' }}>
        <CTAButton href={chatUrl} variant="secondary">Start Chat</CTAButton>
      </div>
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

const body = {
  fontSize: '16px',
  color: '#1A1A2E',
  lineHeight: '1.6',
  margin: '0 0 8px',
} as const;

export default ReportReadyEmail;
