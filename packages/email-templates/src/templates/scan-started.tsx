import { Heading, Text, Preview, Section } from '@react-email/components';
import { EmailLayout } from '../components/email-layout';
import { CTAButton } from '../components/cta-button';

export interface ScanStartedEmailProps {
  targetDomain: string;
  scanId: string;
  scanUrl: string;
}

export function ScanStartedEmail({ targetDomain, scanId, scanUrl }: ScanStartedEmailProps) {
  return (
    <EmailLayout preview={`Scanning ${targetDomain} — results in ~10 minutes`}>
      <Preview>Scanning {targetDomain} — results in ~10 minutes</Preview>
      <Heading style={h1}>Your scan is underway</Heading>
      <Text style={domain}>{targetDomain}</Text>

      {/* Static progress bar */}
      <Section style={{ margin: '24px 0' }}>
        <div style={progressTrack}>
          <div style={progressFill} />
        </div>
        <Text style={progressLabel}>Phase 1: Passive Recon</Text>
      </Section>

      <Text style={body}>
        We&apos;re running 45 modules across analytics, performance, compliance, and
        more. Results typically arrive in about 7–10 minutes. We run 45 deep modules — it&apos;s worth the wait.
      </Text>
      <div style={{ textAlign: 'center' as const, margin: '32px 0' }}>
        <CTAButton href={scanUrl}>Watch Live Progress</CTAButton>
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

const progressTrack = {
  backgroundColor: '#E2E8F0',
  borderRadius: '8px',
  height: '8px',
  overflow: 'hidden' as const,
} as const;

const progressFill = {
  backgroundColor: '#FFB2EF',
  height: '8px',
  width: '25%',
  borderRadius: '8px',
} as const;

const progressLabel = {
  fontSize: '12px',
  color: '#64748B',
  margin: '8px 0 0',
} as const;

export default ScanStartedEmail;
