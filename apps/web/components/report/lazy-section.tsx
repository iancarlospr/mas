'use client';

import { useRef, useState, useEffect, Suspense } from 'react';

interface LazySectionProps {
  isPrintMode: boolean;
  fallback: React.ReactNode;
  children: React.ReactNode;
}

export function LazySection({ isPrintMode, fallback, children }: LazySectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(isPrintMode);

  useEffect(() => {
    if (isPrintMode || !ref.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [isPrintMode]);

  return (
    <div ref={ref}>
      {isVisible ? (
        <Suspense fallback={fallback}>
          {children}
        </Suspense>
      ) : (
        fallback
      )}
    </div>
  );
}
