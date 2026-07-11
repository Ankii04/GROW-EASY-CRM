'use client';

import { useMemo, useState } from 'react';
import { downloadRecordsAsCsv } from '@/lib/api';
import {
  CRM_FIELDS,
  type CrmRecord,
  type ImportSummary,
  type SkippedRecord,
} from '@/lib/types';
import { DataTable } from './DataTable';

interface ResultsViewProps {
  summary: ImportSummary;
  imported: CrmRecord[];
  skipped: SkippedRecord[];
  fileName: string;
  onReset: () => void;
}

export function ResultsView({ summary, imported, skipped, fileName, onReset }: ResultsViewProps) {
  const [tab, setTab] = useState<'imported' | 'skipped'>('imported');

  const importedRows = useMemo(
    () =>
      [...imported]
        .sort((a, b) => a.rowIndex - b.rowIndex)
        .map((r) => [String(r.rowIndex + 1), ...CRM_FIELDS.map((f) => r[f] ?? '')]),
    [imported],
  );

  const skippedRows = useMemo(
    () =>
      [...skipped]
        .sort((a, b) => a.rowIndex - b.rowIndex)
        .map((r) => [
          String(r.rowIndex + 1),
          r.reason,
          Object.entries(r.raw)
            .filter(([, v]) => v)
            .map(([k, v]) => `${k}: ${v}`)
            .join(' · '),
        ]),
    [skipped],
  );

  const stats = [
    { label: 'Total rows', value: summary.totalRows, tone: '' },
    { label: 'Total imported', value: summary.imported, tone: 'text-brand-500' },
    { label: 'Total skipped', value: summary.skipped, tone: 'text-amber-600 dark:text-amber-400' },
    { label: 'Time taken', value: `${(summary.durationMs / 1000).toFixed(1)}s`, tone: '' },
  ];

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="card p-4">
            <dt className="text-xs uppercase tracking-wide text-neutral-400">{stat.label}</dt>
            <dd className={`mt-1 font-display text-2xl font-semibold ${stat.tone}`}>
              {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
            </dd>
          </div>
        ))}
      </dl>

      {summary.failedBatches > 0 && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
          {summary.failedBatches} batch{summary.failedBatches === 1 ? '' : 'es'} could not be
          processed after retries. Their rows are listed under Skipped — try importing them again.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Import results" className="flex gap-1 rounded-xl border border-neutral-200 p-1 dark:border-neutral-800">
          {(
            [
              ['imported', `Imported (${imported.length})`],
              ['skipped', `Skipped (${skipped.length})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={[
                'rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
                tab === id
                  ? 'bg-brand-500 text-white'
                  : 'text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => downloadRecordsAsCsv(imported, fileName)}
            disabled={imported.length === 0}
          >
            Download CRM CSV
          </button>
          <button type="button" className="btn-primary" onClick={onReset}>
            Import another file
          </button>
        </div>
      </div>

      {tab === 'imported' ? (
        <DataTable
          headers={['row', ...CRM_FIELDS]}
          rows={importedRows}
          emptyMessage="No records were imported"
        />
      ) : (
        <DataTable
          headers={['row', 'reason', 'original data']}
          rows={skippedRows}
          emptyMessage="Nothing was skipped — every row was imported"
        />
      )}
    </div>
  );
}
