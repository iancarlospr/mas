'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

const RB2B_ID = '961Y0HDVPJNG';

export function RB2BLoader() {
  const pathname = usePathname();

  useEffect(() => {
    if ((window as Record<string, unknown>).reb2b) return;

    const script = document.createElement('script');
    script.id = 'rb2b-script';
    script.async = true;
    script.src = `https://ddwl4m2hdecbv.cloudfront.net/b/${RB2B_ID}/${RB2B_ID}.js.gz`;
    document.head.appendChild(script);

    (window as Record<string, unknown>).reb2b = { loaded: true };
  }, []);

  // Re-fire on route changes for SPA navigation
  useEffect(() => {
    const reb2b = (window as Record<string, unknown>).reb2b;
    if (reb2b && typeof (reb2b as Record<string, unknown>).page === 'function') {
      (reb2b as { page: () => void }).page();
    }
  }, [pathname]);

  return null;
}
