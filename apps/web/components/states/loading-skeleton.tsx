import { cn } from '@/lib/utils';

/**
 * GhostScan OS — Loading Skeletons
 * ═══════════════════════════════════════
 *
 * WHAT: Skeleton loading placeholders with retro bevel styling.
 * WHY:  Even loading states should feel like the OS is booting
 *       (Plan Section 17).
 * HOW:  Bevel-raised skeleton bars with pulse animation, gs-light fill.
 */

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn('bevel-sunken bg-gs-mid-light/30 animate-pulse', className)} />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-gs-6 animate-pulse p-gs-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-[28px] w-[200px] mb-gs-2" />
          <Skeleton className="h-[16px] w-[120px]" />
        </div>
        <Skeleton className="h-[80px] w-[80px]" />
      </div>

      {/* Category tabs */}
      <div className="flex gap-gs-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-[48px] flex-1" />
        ))}
      </div>

      {/* Module cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gs-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-[140px]" />
        ))}
      </div>
    </div>
  );
}
