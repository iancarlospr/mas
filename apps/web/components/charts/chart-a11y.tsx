'use client';

// Section 9.2 — Generate alt text from chart data
export function generateChartAltText(
  chartType: string,
  title: string,
  data: Array<Record<string, unknown>>,
  config: { xKey: string; yKey: string; format?: (v: unknown) => string },
): string {
  const { xKey, yKey, format = String } = config;
  const summary = data.map((d) => `${d[xKey]}: ${format(d[yKey])}`).join(', ');
  return `${chartType} titled "${title}". Data points: ${summary}.`;
}

// Section 9.2 — Hidden data table for screen readers
export function ScreenReaderTable({
  data,
  columns,
  caption,
}: {
  data: Array<Record<string, unknown>>;
  columns: Array<{ key: string; header: string }>;
  caption?: string;
}) {
  return (
    <table className="sr-only">
      {caption && <caption>{caption}</caption>}
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key}>{c.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i}>
            {columns.map((c) => (
              <td key={c.key}>{String(row[c.key] ?? '')}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
