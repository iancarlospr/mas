import { Heading, Text, Preview } from '@react-email/components';
import { EmailLayout } from '../components/email-layout';
import { CTAButton } from '../components/cta-button';

export interface ReEngagementEmailProps {
  email: string;
  firstName?: string;
  scanUrl: string;
  unsubscribeUrl: string;
}

export function ReEngagementEmail({
  email,
  firstName,
  scanUrl,
  unsubscribeUrl,
}: ReEngagementEmailProps) {
  return (
    <EmailLayout
      preview="Your first scan is waiting — pick any URL"
      showUnsubscribe
      unsubscribeUrl={unsubscribeUrl}
      showAddress
    >
      <Preview>Your first scan is waiting — pick any URL</Preview>
      <Heading style={h1}>{firstName ?? 'Hey'},</Heading>
      <Text style={body}>
        You verified your email a week ago but haven&apos;t run a scan yet.
      </Text>
      <Text style={body}>
        Here&apos;s what you&apos;re missing: paste any URL and in 3 minutes
        you&apos;ll see exactly what marketing technology they&apos;re running —
        every analytics tool, ad pixel, consent configuration, and performance
        metric.
      </Text>
      <Text style={body}>
        Try scanning a competitor. Or your own site. The results might surprise you.
      </Text>
      <div style={{ textAlign: 'center' as const, margin: '32px 0' }}>
        <CTAButton href={scanUrl}>Scan Any URL</CTAButton>
      </div>
      <Text style={body}>Popular first scans:</Text>
      <Text style={bullet}>&bull; Your company&apos;s website</Text>
      <Text style={bullet}>&bull; Your top competitor</Text>
      <Text style={bullet}>
        &bull; A brand you admire (try hubspot.com or stripe.com)
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

export default ReEngagementEmail;
