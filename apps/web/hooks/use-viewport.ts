'use client';

import { useState, useEffect } from 'react';

type ViewportClass = 'mobile' | 'desktop';

/**
 * Viewport detection hook.
 * Returns 'mobile' below 1024px, 'desktop' at 1024px+.
 * Uses matchMedia for performance (fires only at breakpoint, not every resize).
 * Default 'desktop' for SSR — scan page loading state masks the hydration swap.
 */
export function useViewport(): ViewportClass {
  const [viewport, setViewport] = useState<ViewportClass>(
    () => typeof window !== 'undefined' ? (window.innerWidth >= 1024 ? 'desktop' : 'mobile') : 'desktop',
  );

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      setViewport(e.matches ? 'desktop' : 'mobile');
    };
    handler(mql);
    mql.addEventListener('change', handler as (e: MediaQueryListEvent) => void);
    return () => mql.removeEventListener('change', handler as (e: MediaQueryListEvent) => void);
  }, []);

  return viewport;
}
