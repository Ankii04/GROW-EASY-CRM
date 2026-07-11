'use client';

export interface ProgressState {
  totalRows: number;
  totalBatches: number;
  batchesDone: number;
  imported: number;
  skipped: number;
  batchErrors: string[];
}

export function ImportProgress({ state }: { state: ProgressState }) {
  const percent =
    state.totalBatches > 0 ? Math.round((state.batchesDone / state.totalBatches) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Mapping {state.totalRows.toLocaleString()} rows in {state.totalBatches} batch
          {state.totalBatches === 1 ? '' : 'es'}…
        </p>
        <p className="font-mono text-sm font-semibold text-brand-500">{percent}%</p>
      </div>

      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="AI processing progress"
        className="h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
      >
        <div
          className="h-full rounded-full bg-brand-500 transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Batch pipeline: one cell per batch fills as results stream back. */}
      <div className="flex flex-wrap gap-1.5" aria-hidden>
        {Array.from({ length: state.totalBatches }, (_, i) => (
          <span
            key={i}
            className={[
              'h-3 w-6 rounded-sm transition-colors duration-300',
              i < state.batchesDone
                ? 'bg-brand-500'
                : 'animate-pulse bg-neutral-200 dark:bg-neutral-800',
            ].join(' ')}
          />
        ))}
      </div>

      <dl className="grid grid-cols-3 gap-3 font-mono text-sm">
        <div className="card p-3">
          <dt className="text-xs uppercase tracking-wide text-neutral-400">Batches</dt>
          <dd className="mt-1 font-semibold">
            {state.batchesDone}/{state.totalBatches}
          </dd>
        </div>
        <div className="card p-3">
          <dt className="text-xs uppercase tracking-wide text-neutral-400">Imported</dt>
          <dd className="mt-1 font-semibold text-brand-500">{state.imported.toLocaleString()}</dd>
        </div>
        <div className="card p-3">
          <dt className="text-xs uppercase tracking-wide text-neutral-400">Skipped</dt>
          <dd className="mt-1 font-semibold text-amber-600 dark:text-amber-400">
            {state.skipped.toLocaleString()}
          </dd>
        </div>
      </dl>

      {state.batchErrors.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
          <p className="font-semibold">
            {state.batchErrors.length} batch{state.batchErrors.length === 1 ? '' : 'es'} failed
            after retries — those rows will appear under Skipped.
          </p>
          <p className="mt-1 font-mono text-xs opacity-80">{state.batchErrors[0]}</p>
        </div>
      )}
    </div>
  );
}
