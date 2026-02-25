'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ChevronUp, ChevronDown, Download } from 'lucide-react';

interface DataTableColumn<T> {
  key: keyof T & string;
  header: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  pageSize?: number;
  selectable?: boolean;
  exportable?: boolean;
  compact?: boolean;
  stickyHeader?: boolean;
  className?: string;
}

type SortDir = 'asc' | 'desc' | null;

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  pageSize = 20,
  selectable = false,
  exportable = false,
  compact = false,
  stickyHeader = true,
  className,
}: DataTableProps<T>) {
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return data;
    const copy = [...data];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      const sa = String(av);
      const sb = String(bv);
      return sortDir === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
    return copy;
  }, [data, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const pageData = sorted.slice(page * pageSize, (page + 1) * pageSize);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : sortDir === 'desc' ? null : 'asc');
      if (sortDir === 'desc') setSortKey(null);
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function handleExportCSV() {
    const headers = columns.map((c) => c.header).join(',');
    const rows = sorted.map((row) =>
      columns.map((c) => JSON.stringify(String(row[c.key] ?? ''))).join(','),
    );
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'export.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={cn('w-full', className)}>
      {/* Toolbar */}
      {exportable && (
        <div className="flex justify-end mb-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-primary transition-colors px-2 py-1 rounded border border-gs-chrome hover:border-gs-chrome"
          >
            <Download className="w-3 h-3" />
            Export CSV
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gs-chrome">
        <table className="w-full text-sm">
          <thead>
            <tr
              className={cn(
                'bg-gs-paper',
                stickyHeader && 'sticky top-0 z-10',
              )}
            >
              {selectable && (
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.size === pageData.length && pageData.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelected(new Set(pageData.map((_, i) => page * pageSize + i)));
                      } else {
                        setSelected(new Set());
                      }
                    }}
                    className="rounded"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'font-system text-[11px] font-semibold text-gs-muted uppercase tracking-wide px-3',
                    compact ? 'py-1.5' : 'py-2',
                    col.align === 'center' && 'text-center',
                    col.align === 'right' && 'text-right',
                    col.sortable && 'cursor-pointer select-none hover:text-primary',
                  )}
                  style={{ width: col.width }}
                  onClick={() => col.sortable && toggleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && sortKey === col.key && (
                      sortDir === 'asc' ? (
                        <ChevronUp className="w-3 h-3 text-primary" />
                      ) : (
                        <ChevronDown className="w-3 h-3 text-primary" />
                      )
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map((row, ri) => {
              const globalIdx = page * pageSize + ri;
              const isSelected = selected.has(globalIdx);
              return (
                <tr
                  key={ri}
                  className={cn(
                    'border-t border-gs-chrome transition-colors',
                    ri % 2 === 0 ? 'bg-white' : 'bg-gs-paper',
                    isSelected && 'bg-gs-ink/[0.03]',
                    'hover:bg-gs-paper',
                  )}
                >
                  {selectable && (
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          const next = new Set(selected);
                          if (isSelected) next.delete(globalIdx);
                          else next.add(globalIdx);
                          setSelected(next);
                        }}
                        className="rounded"
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-3 text-secondary',
                        compact ? 'py-1.5 text-xs' : 'py-2 text-sm',
                        col.align === 'center' && 'text-center',
                        col.align === 'right' && 'text-right',
                        typeof row[col.key] === 'number' && 'font-mono',
                      )}
                    >
                      {col.render
                        ? col.render(row[col.key], row)
                        : String(row[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              );
            })}
            {pageData.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="text-center py-8 text-muted text-sm"
                >
                  No data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 text-xs text-muted">
          <span>
            Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, sorted.length)} of{' '}
            {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-2 py-1 rounded border border-gs-chrome hover:border-gs-chrome disabled:opacity-40"
            >
              Previous
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const p = totalPages <= 5 ? i : Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={cn(
                    'w-7 h-7 rounded text-xs',
                    p === page
                      ? 'bg-primary text-white'
                      : 'hover:bg-gs-chrome',
                  )}
                >
                  {p + 1}
                </button>
              );
            })}
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page === totalPages - 1}
              className="px-2 py-1 rounded border border-gs-chrome hover:border-gs-chrome disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
