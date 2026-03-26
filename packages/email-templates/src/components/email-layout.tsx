import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Img,
  Text,
  Link,
  Hr,
  Font,
} from '@react-email/components';
import type { ReactNode } from 'react';

interface EmailLayoutProps {
  children: ReactNode;
  preview?: string;
  showUnsubscribe?: boolean;
  unsubscribeUrl?: string;
  showAddress?: boolean;
}

export function EmailLayout({
  children,
  preview,
  showUnsubscribe = false,
  unsubscribeUrl,
  showAddress = false,
}: EmailLayoutProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head>
        <Font
          fontFamily="Plus Jakarta Sans"
          fallbackFontFamily={['Helvetica', 'Arial', 'sans-serif']}
          webFont={{
            url: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800&display=swap',
            format: 'woff2',
          }}
          fontWeight={800}
          fontStyle="normal"
        />
        <Font
          fontFamily="Inter"
          fallbackFontFamily={['Helvetica', 'Arial', 'sans-serif']}
          webFont={{
            url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap',
            format: 'woff2',
          }}
          fontWeight={400}
          fontStyle="normal"
        />
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
        {preview && <title>{preview}</title>}
      </Head>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Img
              src="cid:logo-header"
              width="480"
              height="95"
              alt="MarketingAlphaScan"
              style={{ display: 'block' }}
            />
          </Section>

          {/* Content Card */}
          <Section style={contentCard}>
            {children}
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Img
              src="cid:logo-footer"
              width="40"
              height="40"
              alt=""
              style={{ display: 'block', margin: '0 auto 12px' }}
            />
            <Text style={footerText}>
              &copy; {new Date().getFullYear()} MarketingAlphaScan
            </Text>
            {showUnsubscribe && unsubscribeUrl && (
              <>
                <Hr style={footerDivider} />
                <Text style={footerText}>
                  You&apos;re receiving this because you signed up for MarketingAlphaScan.
                </Text>
                <Link href={unsubscribeUrl} style={unsubscribeLink}>
                  Unsubscribe
                </Link>
              </>
            )}
            {showAddress && (
              <Text style={footerText}>
                MarketingAlphaScan
              </Text>
            )}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: '#FAFBFC',
  fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
  margin: '0',
  padding: '0',
} as const;

const container = {
  maxWidth: '600px',
  margin: '0 auto',
  padding: '20px 0',
} as const;

const header = {
  backgroundColor: '#080808',
  padding: '24px 32px',
  borderRadius: '12px 12px 0 0',
} as const;

const contentCard = {
  backgroundColor: '#FFFFFF',
  padding: '32px',
  borderRadius: '0 0 12px 12px',
  marginTop: '-1px',
  border: '1px solid #E2E8F0',
  borderTop: 'none',
} as const;

const footer = {
  padding: '24px 32px',
  textAlign: 'center' as const,
} as const;

const footerText = {
  color: '#64748B',
  fontSize: '12px',
  lineHeight: '1.5',
  margin: '4px 0',
} as const;

const footerDivider = {
  borderColor: '#E2E8F0',
  margin: '16px 0',
} as const;

const unsubscribeLink = {
  color: '#64748B',
  fontSize: '12px',
  textDecoration: 'underline',
} as const;
