'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

const RB2B_ID = '961Y0HDVPJNG';

const win = globalThis as Record<string, any>; // RB2B attaches to window.reb2b

export function RB2BLoader() {
  const pathname = usePathname();

  useEffect(() => {
    if (win.reb2b) return;

    const script = document.createElement('script');
    script.id = 'rb2b-script';
    script.async = true;
    script.src = `https://ddwl4m2hdecbv.cloudfront.net/b/${RB2B_ID}/${RB2B_ID}.js.gz`;
    document.head.appendChild(script);

    win.reb2b = { loaded: true };
  }, []);

  // Re-fire on route changes for SPA navigation
  useEffect(() => {
    if (win.reb2b && typeof win.reb2b.page === 'function') {
      win.reb2b.page();
    }
  }, [pathname]);

  return null;
}
