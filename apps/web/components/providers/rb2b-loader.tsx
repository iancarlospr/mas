'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

const RB2B_ID = '961Y0HDVPJNG';

export function RB2BLoader() {
  const pathname = usePathname();

  useEffect(() => {
    const existing = document.getElementById('rb2b-script');
    if (existing) existing.remove();

    const script = document.createElement('script');
    script.id = 'rb2b-script';
    script.async = true;
    script.src = `https://ddwl4m2hdecbv.cloudfront.net/b/${RB2B_ID}/${RB2B_ID}.js.gz`;
    document.body.appendChild(script);
  }, [pathname]);

  return null;
}
