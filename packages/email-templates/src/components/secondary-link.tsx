import { Link } from '@react-email/components';
import type { ReactNode } from 'react';

interface SecondaryLinkProps {
  href: string;
  children: ReactNode;
}

export function SecondaryLink({ href, children }: SecondaryLinkProps) {
  return (
    <Link
      href={href}
      style={{
        color: '#FFB2EF',
        fontSize: '14px',
        fontWeight: 600,
        textDecoration: 'underline',
      }}
    >
      {children}
    </Link>
  );
}
