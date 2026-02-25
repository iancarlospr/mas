'use client';

import { useState, useEffect } from 'react';

type Orientation = 'portrait' | 'landscape';

/**
 * Orientation detection hook.
 * Returns 'portrait' or 'landscape' via matchMedia.
 * Used inside MobileDashboard to toggle between summary and detail views.
 */
export function useOrientation(): Orientation {
  const [orientation, setOrientation] = useState<Orientation>('portrait');

  useEffect(() => {
    const mql = window.matchMedia('(orientation: landscape)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      setOrientation(e.matches ? 'landscape' : 'portrait');
    };
    handler(mql);
    mql.addEventListener('change', handler as (e: MediaQueryListEvent) => void);
    return () => mql.removeEventListener('change', handler as (e: MediaQueryListEvent) => void);
  }, []);

  return orientation;
}
