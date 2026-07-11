'use client';

export type Step = 'upload' | 'preview' | 'importing' | 'results';

const STEPS: Array<{ id: Step; label: string }> = [
  { id: 'upload', label: 'Upload CSV' },
  { id: 'preview', label: 'Preview rows' },
  { id: 'importing', label: 'AI mapping' },
  { id: 'results', label: 'CRM records' },
];

/** The pipeline rail: encodes exactly where the user's data is right now. */
export function Stepper({ current }: { current: Step }) {
  const currentIndex = STEPS.findIndex((s) => s.id === current);

  return (
    <ol className="flex items-center gap-2 overflow-x-auto pb-1" aria-label="Import progress">
      {STEPS.map((step, i) => {
        const state = i < currentIndex ? 'done' : i === currentIndex ? 'active' : 'todo';
        return (
          <li key={step.id} className="flex shrink-0 items-center gap-2">
            <span
              aria-current={state === 'active' ? 'step' : undefined}
              className={[
                'flex h-7 w-7 items-center justify-center rounded-full font-mono text-xs font-semibold',
                state === 'done' && 'bg-brand-500 text-white',
                state === 'active' && 'bg-cta-500 text-white',
                state === 'todo' &&
                  'border border-neutral-300 text-neutral-400 dark:border-neutral-700',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {state === 'done' ? '✓' : i + 1}
            </span>
            <span
              className={[
                'text-sm',
                state === 'active' ? 'font-semibold' : 'text-neutral-500 dark:text-neutral-400',
              ].join(' ')}
            >
              {step.label}
            </span>
            {i < STEPS.length - 1 && (
              <span
                aria-hidden
                className={[
                  'mx-1 h-px w-8 sm:w-14',
                  i < currentIndex ? 'bg-brand-500' : 'bg-neutral-300 dark:bg-neutral-700',
                ].join(' ')}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
