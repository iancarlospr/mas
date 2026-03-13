import { Heading, Text, Preview, Section } from '@react-email/components';
import { EmailLayout } from '../components/email-layout';
import { CTAButton } from '../components/cta-button';
import { ScoreBadge } from '../components/score-badge';
import { TrafficLightRow } from '../components/traffic-light-row';
import { Divider } from '../components/divider';
import { AlertBox } from '../components/alert-box';

export interface ScanCompleteEmailProps {
  targetDomain: string;
  scanId: string;
  marketingIQ: number;
  marketingIQLabel: string;
  categoryScores: Array<{
    name: string;
    score: number;
    light: 'green' | 'yellow' | 'red';
  }>;
  topFinding: string;
  scanUrl: string;
  reportUrl: string;
}

export function ScanCompleteEmail({
  targetDomain,
  scanId,
  marketingIQ,
  marketingIQLabel,
  categoryScores,
  topFinding,
  scanUrl,
  reportUrl,
}: ScanCompleteEmailProps) {
  return (
    <EmailLayout preview={`${targetDomain} scored ${marketingIQ}/100 — your Full Scan is ready`}>
      <Preview>{`${targetDomain} scored ${marketingIQ}/100 — your Full Scan is ready`}</Preview>
      <Heading style={h1}>Your Full Scan results are ready</Heading>
      <Text style={domain}>{targetDomain}</Text>

      {/* Score */}
      <div style={{ textAlign: 'center' as const, margin: '24px 0' }}>
        <ScoreBadge score={marketingIQ} label={marketingIQLabel} size="lg" />
      </div>

      {/* Category Breakdown */}
      <Heading as="h2" style={h2}>Category Breakdown</Heading>
      <Section style={{ margin: '12px 0' }}>
        {categoryScores.map((cat) => (
          <TrafficLightRow
            key={cat.name}
            name={cat.name}
            score={cat.score}
            light={cat.light}
          />
        ))}
      </Section>

      {/* Top Finding */}
      <Heading as="h2" style={h2}>Top Finding</Heading>
      <AlertBox type="info">{topFinding}</AlertBox>

      <div style={{ textAlign: 'center' as const, margin: '32px 0' }}>
        <CTAButton href={scanUrl}>View Full Dashboard</CTAButton>
      </div>

      <Divider />

      {/* Upsell */}
      <Heading as="h2" style={h2}>Unlock the Executive Report</Heading>
      <Text style={body}>
        Get the Alpha Brief — a McKinsey-style deep dive with:
      </Text>
      <Text style={checkItem}>&check; ROI impact analysis with dollar estimates</Text>
      <Text style={checkItem}>&check; Prioritized remediation roadmap</Text>
      <Text style={checkItem}>&check; Downloadable PDF report</Text>
      <Text style={checkItem}>&check; 50 AI Chat messages to explore findings</Text>
      <Text style={price}>
        <span style={{ textDecoration: 'line-through', color: '#64748B' }}>$29.99</span>
        {' '}
        <span style={{ fontWeight: 700, color: '#E94560', fontSize: '20px' }}>$9.99</span>
        {' '}— Launch Price
      </Text>
      <div style={{ textAlign: 'center' as const, margin: '24px 0' }}>
        <CTAButton href={reportUrl} variant="secondary">Get Alpha Brief</CTAButton>
      </div>

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

const checkItem = {
  fontSize: '16px',
  color: '#1A1A2E',
  lineHeight: '1.6',
  margin: '4px 0',
  paddingLeft: '8px',
} as const;

const price = {
  fontSize: '16px',
  color: '#1A1A2E',
  lineHeight: '1.6',
  margin: '16px 0 0',
} as const;

const signoff = {
  fontSize: '16px',
  color: '#64748B',
  lineHeight: '1.6',
  margin: '24px 0 0',
} as const;

export default ScanCompleteEmail;
