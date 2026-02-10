'use client';

import { Suspense, lazy, useRef, useMemo, useCallback } from 'react';
import { useInView } from 'framer-motion';

/**
 * Section 10.1 — Lazy loading wrapper for charts below the fold.
 * Renders fallback (skeleton) until near viewport, then lazy-loads the chart.
 */
interface LazyChartWrapperProps {
  fallback: React.ReactNode;
  children: React.ReactNode;
  rootMargin?: string;
}

export function LazyChartWrapper({
  fallback,
  children,
  rootMargin = '200px',
}: LazyChartWrapperProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: rootMargin as `${number}px` });

  return (
    <div ref={ref}>
      {isInView ? (
        <Suspense fallback={fallback}>{children}</Suspense>
      ) : (
        fallback
      )}
    </div>
  );
}

/**
 * Section 10.2 — Memoize transformed chart data.
 * Avoids re-computing data transforms on every render.
 */
export function useChartData<T, R>(
  rawData: T[] | undefined,
  transform: (data: T[]) => R[],
  deps: unknown[] = [],
): R[] {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => {
    if (!rawData?.length) return [];
    return transform(rawData);
  }, [rawData, ...deps]);
}

/**
 * Memoized Intl formatters to avoid repeated allocations.
 */
export function useFormatters() {
  return useMemo(
    () => ({
      currency: new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }),
      number: new Intl.NumberFormat('en-US'),
      percent: new Intl.NumberFormat('en-US', {
        style: 'percent',
        minimumFractionDigits: 1,
      }),
    }),
    [],
  );
}
