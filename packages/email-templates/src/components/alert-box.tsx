import { Section, Text } from '@react-email/components';
import type { ReactNode } from 'react';

interface AlertBoxProps {
  type: 'info' | 'warning' | 'success';
  children: ReactNode;
}

const styles = {
  info: { borderColor: '#FFB2EF', backgroundColor: '#FFF5FC' },
  warning: { borderColor: '#FFD166', backgroundColor: '#FFFBF0' },
  success: { borderColor: '#06D6A0', backgroundColor: '#F0FFF4' },
} as const;

export function AlertBox({ type, children }: AlertBoxProps) {
  const s = styles[type];

  return (
    <Section
      style={{
        borderLeft: `4px solid ${s.borderColor}`,
        backgroundColor: s.backgroundColor,
        padding: '16px 20px',
        borderRadius: '0 8px 8px 0',
        margin: '16px 0',
      }}
    >
      <Text style={{ margin: 0, fontSize: '14px', color: '#1A1A2E', lineHeight: '1.6' }}>
        {children}
      </Text>
    </Section>
  );
}
