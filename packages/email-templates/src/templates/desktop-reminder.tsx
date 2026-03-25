import { Heading, Text, Preview } from '@react-email/components';
import { EmailLayout } from '../components/email-layout';
import { CTAButton } from '../components/cta-button';

export interface DesktopReminderEmailProps {
  email?: string;
}

export function DesktopReminderEmail({ email }: DesktopReminderEmailProps = {}) {
  const greeting = email ? `hey ${email.split('@')[0]}` : 'hey babe';

  return (
    <EmailLayout preview="Your desktop link to MarketingAlphaScan">
      <Preview>Your desktop link to MarketingAlphaScan</Preview>
      <Heading style={h1}>your desktop link is ready.</Heading>
      <Text style={body}>
        {greeting} — you caught us on mobile, but the full GhostScan
        experience lives on desktop. here&apos;s your shortcut back.
      </Text>
      <div style={{ textAlign: 'center' as const, margin: '32px 0' }}>
        <CTAButton href="https://marketingalphascan.com">
          Open on Desktop
        </CTAButton>
      </div>
      <Heading as="h2" style={h2}>what you&apos;re missing:</Heading>
      <Text style={bullet}>
        &bull; 45-module forensic MarTech audit with interactive report slides
      </Text>
      <Text style={bullet}>
        &bull; Chlo&eacute;&apos;s Bedroom OS — drag windows, play mini-games, watch ASCII movies
      </Text>
      <Text style={bullet}>
        &bull; Boss Deck PDF, executive brief, and full .MD export
      </Text>
      <Text style={bullet}>
        &bull; AI chat with your scan results — ask anything
      </Text>
      <Text style={body}>
        open that link on your laptop and run a scan. trust me, it hits different.
      </Text>
      <Text style={signoff}>&mdash; Chlo&eacute;</Text>
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
  fontStyle: 'italic' as const,
} as const;

export default DesktopReminderEmail;
