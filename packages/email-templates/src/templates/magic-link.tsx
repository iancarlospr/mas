import { Heading, Text, Preview } from '@react-email/components';
import { EmailLayout } from '../components/email-layout';
import { CTAButton } from '../components/cta-button';

export interface MagicLinkEmailProps {
  email: string;
  magicLinkUrl: string;
}

export function MagicLinkEmail({ email, magicLinkUrl }: MagicLinkEmailProps) {
  return (
    <EmailLayout preview="Your login link for MarketingAlphaScan">
      <Preview>Your login link for MarketingAlphaScan</Preview>
      <Heading style={h1}>Sign in to MarketingAlphaScan</Heading>
      <Text style={body}>
        Click the button below to sign in to your account.
      </Text>
      <div style={{ textAlign: 'center' as const, margin: '32px 0' }}>
        <CTAButton href={magicLinkUrl}>Sign In</CTAButton>
      </div>
      <Text style={note}>This link expires in 10 minutes.</Text>
      <Text style={note}>
        If you didn&apos;t request this login link, you can safely ignore this
        email. Your account is secure.
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

export default MagicLinkEmail;
