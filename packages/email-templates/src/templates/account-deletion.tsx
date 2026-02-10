import { Heading, Text, Preview } from '@react-email/components';
import { EmailLayout } from '../components/email-layout';

export interface AccountDeletionEmailProps {
  email: string;
  deletionDate: string;
}

export function AccountDeletionEmail({
  email,
  deletionDate,
}: AccountDeletionEmailProps) {
  return (
    <EmailLayout preview="Your MarketingAlphaScan account has been deleted">
      <Preview>Your MarketingAlphaScan account has been deleted</Preview>
      <Heading style={h1}>Account deleted</Heading>
      <Text style={body}>
        All your data has been permanently removed, including scan results, chat
        history, and payment records. Stripe retains its own records per their
        privacy policy.
      </Text>
      <Text style={signoff}>We&apos;re sorry to see you go.</Text>
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
  margin: '0 0 16px',
} as const;

const signoff = {
  fontSize: '16px',
  color: '#64748B',
  lineHeight: '1.6',
  margin: '24px 0 0',
} as const;

export default AccountDeletionEmail;
