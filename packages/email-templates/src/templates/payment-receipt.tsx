import { Heading, Text, Preview, Row, Column } from '@react-email/components';
import { EmailLayout } from '../components/email-layout';
import { CTAButton } from '../components/cta-button';
import { SecondaryLink } from '../components/secondary-link';
import { Divider } from '../components/divider';

export interface PaymentReceiptEmailProps {
  productName: string;
  amount: string;
  currency: string;
  receiptDate: string;
  stripeReceiptUrl: string;
  scanUrl?: string;
}

export function PaymentReceiptEmail({
  productName,
  amount,
  currency,
  receiptDate,
  stripeReceiptUrl,
  scanUrl,
}: PaymentReceiptEmailProps) {
  return (
    <EmailLayout preview={`Receipt: ${productName} — MarketingAlphaScan`}>
      <Preview>Receipt: {productName} — MarketingAlphaScan</Preview>
      <Heading style={h1}>Payment confirmed</Heading>

      {/* Receipt table */}
      <div style={table}>
        <Row style={tableRow}>
          <Column style={tableLabel}>Product</Column>
          <Column style={tableValue}>{productName}</Column>
        </Row>
        <Row style={tableRow}>
          <Column style={tableLabel}>Amount</Column>
          <Column style={tableValue}>
            {currency === 'usd' ? '$' : currency.toUpperCase() + ' '}{amount}
          </Column>
        </Row>
        <Row style={tableRow}>
          <Column style={tableLabel}>Date</Column>
          <Column style={tableValue}>{receiptDate}</Column>
        </Row>
      </div>

      <div style={{ textAlign: 'center' as const, margin: '32px 0' }}>
        <CTAButton href={stripeReceiptUrl}>View Receipt on Stripe</CTAButton>
      </div>

      {productName === 'Alpha Brief' && (
        <Text style={body}>
          Your report is being generated and will be ready shortly.
        </Text>
      )}

      {scanUrl && (
        <>
          <Divider />
          <div style={{ textAlign: 'center' as const }}>
            <SecondaryLink href={scanUrl}>View Scan Dashboard</SecondaryLink>
          </div>
        </>
      )}
    </EmailLayout>
  );
}

const h1 = {
  fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
  fontWeight: 800,
  fontSize: '28px',
  color: '#1A1A2E',
  lineHeight: '1.3',
  margin: '0 0 24px',
} as const;

const body = {
  fontSize: '16px',
  color: '#1A1A2E',
  lineHeight: '1.6',
  margin: '16px 0 0',
} as const;

const table = {
  border: '1px solid #E2E8F0',
  borderRadius: '8px',
  overflow: 'hidden' as const,
  margin: '0 0 8px',
} as const;

const tableRow = {
  borderBottom: '1px solid #E2E8F0',
} as const;

const tableLabel = {
  padding: '12px 16px',
  fontSize: '14px',
  color: '#64748B',
  verticalAlign: 'middle' as const,
} as const;

const tableValue = {
  padding: '12px 16px',
  fontSize: '14px',
  fontWeight: 600,
  color: '#1A1A2E',
  textAlign: 'right' as const,
  verticalAlign: 'middle' as const,
} as const;

export default PaymentReceiptEmail;
