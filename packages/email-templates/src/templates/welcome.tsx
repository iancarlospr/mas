import { Heading, Text, Preview } from '@react-email/components';
import { EmailLayout } from '../components/email-layout';
import { CTAButton } from '../components/cta-button';

export interface WelcomeEmailProps {
  email: string;
  scanUrl: string;
}

export function WelcomeEmail({ email, scanUrl }: WelcomeEmailProps) {
  return (
    <EmailLayout preview="Welcome to MarketingAlphaScan — run your first Full Scan">
      <Preview>Welcome to MarketingAlphaScan — run your first Full Scan</Preview>
      <Heading style={h1}>Welcome to MarketingAlphaScan</Heading>
      <Text style={body}>
        Your email is verified. You now have access to Full Scan — our
        comprehensive 45-module marketing technology audit.
      </Text>
      <Heading as="h2" style={h2}>What Full Scan reveals:</Heading>
      <Text style={bullet}>
        &bull; Every analytics tool, ad pixel, and MarTech platform on any website
      </Text>
      <Text style={bullet}>
        &bull; Core Web Vitals, performance bottlenecks, and mobile readiness
      </Text>
      <Text style={bullet}>
        &bull; Compliance gaps (GDPR, CCPA, PCI DSS) with specific remediation steps
      </Text>
      <Text style={bullet}>
        &bull; AI-powered insights with actionable recommendations
      </Text>
      <Text style={body}>
        Your MarketingIQ score benchmarks the site against 250+ checkpoints
        across 8 categories.
      </Text>
      <div style={{ textAlign: 'center' as const, margin: '32px 0' }}>
        <CTAButton href={scanUrl}>Run Your First Full Scan</CTAButton>
      </div>
      <Text style={body}>
        Have questions? Reply to this email — a human reads every message.
      </Text>
      <Text style={signoff}>— The MarketingAlphaScan Team</Text>
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

const h2 = {
  fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
  fontWeight: 700,
  fontSize: '22px',
  color: '#1A1A2E',
  lineHeight: '1.3',
  margin: '24px 0 12px',
} as const;

const body = {
  fontSize: '16px',
  color: '#1A1A2E',
  lineHeight: '1.6',
  margin: '0 0 8px',
} as const;

const bullet = {
  fontSize: '16px',
  color: '#1A1A2E',
  lineHeight: '1.6',
  margin: '4px 0',
  paddingLeft: '8px',
} as const;

const signoff = {
  fontSize: '16px',
  color: '#64748B',
  lineHeight: '1.6',
  margin: '24px 0 0',
} as const;

export default WelcomeEmail;
