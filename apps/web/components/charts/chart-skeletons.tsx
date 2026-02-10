'use client';

export function BarChartSkeleton({ bars = 5, height = 200 }: { bars?: number; height?: number }) {
  return (
    <div className="animate-pulse" style={{ height }}>
      <div className="flex items-end gap-3 h-full px-4 pb-4">
        {Array.from({ length: bars }).map((_, i) => (
          <div
            key={i}
            className="flex-1 bg-slate-100 rounded-t"
            style={{ height: `${30 + Math.random() * 60}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function LineChartSkeleton({ height = 200 }: { height?: number }) {
  return (
    <div className="animate-pulse" style={{ height }}>
      <svg width="100%" height="100%" viewBox="0 0 400 200">
        <path
          d="M 20 150 Q 100 80 200 120 T 380 60"
          fill="none"
          stroke="#F1F5F9"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export function DonutSkeleton({ size = 200 }: { size?: number }) {
  return (
    <div className="animate-pulse flex items-center justify-center" style={{ width: size, height: size }}>
      <div
        className="rounded-full border-8 border-slate-100"
        style={{ width: size * 0.8, height: size * 0.8 }}
      />
    </div>
  );
}

export function GaugeSkeleton({ size = 200 }: { size?: number }) {
  return (
    <div className="animate-pulse flex flex-col items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 200 200">
        <circle
          cx="100" cy="100" r="80"
          fill="none"
          stroke="#F1F5F9"
          strokeWidth="12"
          strokeDasharray="377"
          strokeDashoffset="126"
          strokeLinecap="round"
          transform="rotate(150 100 100)"
        />
      </svg>
      <div className="w-12 h-8 bg-slate-100 rounded mt-[-90px]" />
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="animate-pulse space-y-2">
      <div className="flex gap-4 pb-2 border-b border-slate-100">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-3 bg-slate-100 rounded flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 py-2">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="h-3 bg-slate-50 rounded flex-1" style={{ width: `${50 + Math.random() * 50}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}
