import { Heading, Text, Preview } from '@react-email/components';
import { EmailLayout } from '../components/email-layout';
import { CTAButton } from '../components/cta-button';

export interface VerificationEmailProps {
  email: string;
  confirmationUrl: string;
}

export function VerificationEmail({ email, confirmationUrl }: VerificationEmailProps) {
  return (
    <EmailLayout preview="Verify your email to unlock Full Scan access">
      <Preview>Verify your email to unlock Full Scan access</Preview>
      <Heading style={h1}>Confirm your email</Heading>
      <Text style={body}>
        Click the button below to verify your email and unlock Full Scan
        access — our comprehensive 45-module marketing technology audit.
      </Text>
      <div style={{ textAlign: 'center' as const, margin: '32px 0' }}>
        <CTAButton href={confirmationUrl}>Verify Email</CTAButton>
      </div>
      <Text style={note}>
        This link expires in 24 hours. If you didn&apos;t create an account,
        you can safely ignore this email.
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

const body = {
  fontSize: '16px',
  color: '#1A1A2E',
  lineHeight: '1.6',
  margin: '0 0 8px',
} as const;

const note = {
  fontSize: '14px',
  color: '#64748B',
  lineHeight: '1.5',
  margin: '16px 0 0',
} as const;

export default VerificationEmail;
