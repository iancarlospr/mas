import { Button } from '@react-email/components';
import type { ReactNode } from 'react';

interface CTAButtonProps {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary';
}

export function CTAButton({ href, children, variant = 'primary' }: CTAButtonProps) {
  const isPrimary = variant === 'primary';

  return (
    <Button
      href={href}
      style={{
        backgroundColor: isPrimary ? '#FFB2EF' : '#1A1A2E',
        color: isPrimary ? '#080808' : '#FFFFFF',
        fontSize: '16px',
        fontWeight: 700,
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        padding: '14px 32px',
        borderRadius: '8px',
        textDecoration: 'none',
        textAlign: 'center' as const,
        display: 'inline-block',
        minWidth: '200px',
      }}
    >
      {children}
    </Button>
  );
}
