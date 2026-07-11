'use client';

import { useMemo, useState } from 'react';
import { downloadRecordsAsCsv } from '@/lib/api';
import {
  CRM_FIELDS,
  LEAD_QUALITIES,
  type CrmRecord,
  type ImportSummary,
  type LeadQuality,
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

const QUALITY_BADGE: Record<LeadQuality, string> = {
  HOT: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  WARM: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  COLD: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
};

const QUALITY_DOT: Record<LeadQuality, string> = {
  HOT: 'bg-red-500',
  WARM: 'bg-amber-500',
  COLD: 'bg-sky-500',
};

function QualityBadge({ value }: { value: string }) {
  const quality = value.split(' — ')[0] as LeadQuality;
  if (!LEAD_QUALITIES.includes(quality)) {
    return <span className="text-neutral-300 dark:text-neutral-600">—</span>;
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${QUALITY_BADGE[quality]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${QUALITY_DOT[quality]}`} />
      {quality}
    </span>
  );
}

export function ResultsView({ summary, imported, skipped, fileName, onReset }: ResultsViewProps) {
  const [tab, setTab] = useState<'imported' | 'skipped'>('imported');

  const importedRows = useMemo(
    () =>
      [...imported]
        .sort((a, b) => a.rowIndex - b.rowIndex)
        .map((r) => [
          String(r.rowIndex + 1),
          r.lead_quality ? `${r.lead_quality}${r.quality_reason ? ` — ${r.quality_reason}` : ''}` : '',
          ...CRM_FIELDS.map((f) => r[f] ?? ''),
        ]),
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

  /** Pipeline insights: quality and status distribution of what was imported. */
  const insights = useMemo(() => {
    const quality = { HOT: 0, WARM: 0, COLD: 0 } as Record<LeadQuality, number>;
    const status = new Map<string, number>();
    for (const r of imported) {
      if (r.lead_quality) quality[r.lead_quality] += 1;
      const key = r.crm_status || 'UNMAPPED';
      status.set(key, (status.get(key) ?? 0) + 1);
    }
    return { quality, status: Array.from(status.entries()).sort((a, b) => b[1] - a[1]) };
  }, [imported]);

  const stats = [
    { label: 'Total rows', value: summary.totalRows, tone: '' },
    { label: 'Total imported', value: summary.imported, tone: 'text-brand-500' },
    { label: 'Total skipped', value: summary.skipped, tone: 'text-amber-600 dark:text-amber-400' },
    ...(summary.duplicates > 0
      ? [
          {
            label: 'Duplicates removed',
            value: summary.duplicates,
            tone: 'text-purple-600 dark:text-purple-400',
          },
        ]
      : []),
    { label: 'Time taken', value: `${(summary.durationMs / 1000).toFixed(1)}s`, tone: '' },
  ];

  return (
    <div className="space-y-6">
      <dl
        className={`grid grid-cols-2 gap-3 ${stats.length === 5 ? 'sm:grid-cols-5' : 'sm:grid-cols-4'}`}
      >
        {stats.map((stat) => (
          <div key={stat.label} className="card p-4">
            <dt className="text-xs uppercase tracking-wide text-neutral-400">{stat.label}</dt>
            <dd className={`mt-1 font-display text-2xl font-semibold ${stat.tone}`}>
              {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
            </dd>
          </div>
        ))}
      </dl>

      {imported.length > 0 && (
        <div className="card flex flex-wrap items-center gap-x-8 gap-y-3 p-4">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-neutral-400">Lead quality</span>
            {LEAD_QUALITIES.map((q) => (
              <span
                key={q}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${QUALITY_BADGE[q]}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${QUALITY_DOT[q]}`} />
                {q} · {insights.quality[q]}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-neutral-400">Status</span>
            {insights.status.map(([name, count]) => (
              <span
                key={name}
                className="rounded-full bg-neutral-100 px-2.5 py-1 font-mono text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
              >
                {name.toLowerCase().replace(/_/g, ' ')} · {count}
              </span>
            ))}
          </div>
        </div>
      )}

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
          headers={['row', 'quality', ...CRM_FIELDS]}
          rows={importedRows}
          renderCell={(value, colIndex) =>
            colIndex === 1 ? <QualityBadge value={value} /> : undefined
          }
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
