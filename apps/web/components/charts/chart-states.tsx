'use client';

interface EmptyChartProps {
  chartType?: 'bar' | 'line' | 'pie' | 'table' | 'checklist' | 'gauge' | 'flow';
  message?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyChart({ message = 'No data available', action }: EmptyChartProps) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center py-8"
      style={{
        backgroundColor: '#FAFBFC',
        border: '1px dashed #E2E8F0',
        borderRadius: 8,
        minHeight: 120,
      }}
    >
      <svg width={32} height={32} viewBox="0 0 24 24" fill="none" className="mb-3">
        <path
          d="M3 3v18h18M7 16l4-8 4 4 4-8"
          stroke="#94A3B8"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line x1="2" y1="2" x2="22" y2="22" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <p style={{ fontSize: 14, color: '#94A3B8', fontFamily: '"Inter", sans-serif' }}>{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-3 px-3 py-1.5 text-sm font-medium rounded-lg border border-[#E2E8F0] hover:bg-[#F1F5F9] transition-colors"
          style={{ color: '#1A1A2E' }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

interface ChartErrorProps {
  moduleId?: string;
  message: string;
  retryable?: boolean;
  onRetry?: () => void;
}

export function ChartError({ message, retryable = false, onRetry }: ChartErrorProps) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center py-8"
      style={{
        backgroundColor: 'rgba(239, 71, 111, 0.03)',
        borderRadius: 8,
        minHeight: 120,
      }}
    >
      <svg width={28} height={28} viewBox="0 0 24 24" fill="none" className="mb-2">
        <path
          d="M12 9v4m0 4h.01M10.29 3.86l-8.69 15A2 2 0 003.34 22h17.32a2 2 0 001.74-2.86l-8.69-15a2 2 0 00-3.42 0z"
          stroke="#EF476F"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <p style={{ fontSize: 13, color: '#64748B', fontFamily: '"Inter", sans-serif' }}>{message}</p>
      {retryable && onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors"
          style={{ borderColor: '#EF476F', color: '#EF476F' }}
        >
          Retry
        </button>
      )}
    </div>
  );
}
