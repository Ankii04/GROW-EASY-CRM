'use client';

import { useMemo, useRef, useState } from 'react';

const ROW_HEIGHT = 37; // px — keep in sync with the cell padding below
const OVERSCAN = 8;

interface DataTableProps {
  headers: string[];
  rows: string[][];
  /** Optional extra class per row, e.g. to tint skipped rows. */
  rowClassName?: (rowIndex: number) => string;
  maxHeight?: number;
  emptyMessage?: string;
}

/**
 * A dependency-free virtualized table:
 * only the rows inside the viewport (plus a small overscan) are mounted,
 * so a 50,000-row CSV scrolls as smoothly as a 50-row one.
 * Sticky header + horizontal and vertical scrolling per the assignment.
 */
export function DataTable({
  headers,
  rows,
  rowClassName,
  maxHeight = 480,
  emptyMessage = 'No rows to display',
}: DataTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const range = useMemo(() => {
    const visible = Math.ceil(maxHeight / ROW_HEIGHT);
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const end = Math.min(rows.length, start + visible + OVERSCAN * 2);
    return { start, end };
  }, [scrollTop, rows.length, maxHeight]);

  if (rows.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-neutral-300 text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
        {emptyMessage}
      </div>
    );
  }

  const topPad = range.start * ROW_HEIGHT;
  const bottomPad = (rows.length - range.end) * ROW_HEIGHT;

  return (
    <div
      ref={containerRef}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      className="overflow-auto rounded-xl border border-neutral-200 dark:border-neutral-800"
      style={{ maxHeight }}
    >
      <table className="w-full border-collapse text-left">
        <thead className="sticky top-0 z-10">
          <tr className="bg-neutral-50 dark:bg-neutral-900">
            <th className="table-cell-base w-12 border-b-2 !border-neutral-200 font-semibold uppercase tracking-wide text-neutral-400 dark:!border-neutral-700">
              #
            </th>
            {headers.map((header) => (
              <th
                key={header}
                className="table-cell-base border-b-2 !border-neutral-200 font-semibold uppercase tracking-wide text-neutral-500 dark:!border-neutral-700 dark:text-neutral-300"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {topPad > 0 && (
            <tr aria-hidden style={{ height: topPad }}>
              <td colSpan={headers.length + 1} className="p-0" />
            </tr>
          )}
          {rows.slice(range.start, range.end).map((cells, i) => {
            const rowIndex = range.start + i;
            return (
              <tr
                key={rowIndex}
                style={{ height: ROW_HEIGHT }}
                className={[
                  'hover:bg-brand-50/60 dark:hover:bg-brand-500/5',
                  rowClassName?.(rowIndex) ?? '',
                ].join(' ')}
              >
                <td className="table-cell-base text-neutral-400">{rowIndex + 1}</td>
                {cells.map((value, c) => (
                  <td key={c} className="table-cell-base max-w-[26rem] truncate" title={value}>
                    {value || <span className="text-neutral-300 dark:text-neutral-600">—</span>}
                  </td>
                ))}
              </tr>
            );
          })}
          {bottomPad > 0 && (
            <tr aria-hidden style={{ height: bottomPad }}>
              <td colSpan={headers.length + 1} className="p-0" />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
