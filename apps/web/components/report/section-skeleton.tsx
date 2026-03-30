'use client';

export function SectionSkeleton() {
  return (
    <div className="report-section bg-surface border border-border rounded-xl p-8 mb-6 animate-pulse">
      {/* Section header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-full bg-gray-200" />
        <div className="h-6 bg-gray-200 rounded w-48" />
      </div>
      {/* Body lines */}
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 rounded w-full" />
        <div className="h-4 bg-gray-200 rounded w-5/6" />
        <div className="h-4 bg-gray-200 rounded w-4/6" />
      </div>
      {/* Chart placeholder */}
      <div className="mt-6 h-48 bg-gray-100 rounded-lg" />
    </div>
  );
}
