'use client';

import { ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

interface ChartContainerProps {
  children: React.ReactElement;
  height?: number;
  aspect?: number;
  minHeight?: number;
  className?: string;
}

export function ChartContainer({
  children,
  height,
  aspect,
  minHeight = 200,
  className,
}: ChartContainerProps) {
  return (
    <div className={cn('w-full', className)} style={{ minHeight }}>
      <ResponsiveContainer
        width="100%"
        height={height}
        aspect={!height ? aspect : undefined}
        debounce={150}
      >
        {children}
      </ResponsiveContainer>
    </div>
  );
}
