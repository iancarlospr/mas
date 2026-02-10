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
        color: '#0F3460',
        fontSize: '14px',
        fontWeight: 600,
        textDecoration: 'underline',
      }}
    >
      {children}
    </Link>
  );
}
