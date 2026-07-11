'use client';

import { useCallback, useRef, useState } from 'react';
import { DataTable } from '@/components/DataTable';
import { Dropzone } from '@/components/Dropzone';
import { ImportProgress, type ProgressState } from '@/components/ImportProgress';
import { ResultsView } from '@/components/ResultsView';
import { Stepper, type Step } from '@/components/Stepper';
import { ThemeToggle } from '@/components/ThemeToggle';
import { formatBytes, parseCsvForPreview, streamImport } from '@/lib/api';
import type { CrmRecord, ImportSummary, ParsedCsv, SkippedRecord } from '@/lib/types';

const INITIAL_PROGRESS: ProgressState = {
  totalRows: 0,
  totalBatches: 0,
  batchesDone: 0,
  imported: 0,
  skipped: 0,
  batchErrors: [],
};

export default function Home() {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedCsv | null>(null);
  const [progress, setProgress] = useState<ProgressState>(INITIAL_PROGRESS);
  const [imported, setImported] = useState<CrmRecord[]>([]);
  const [skipped, setSkipped] = useState<SkippedRecord[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setStep('upload');
    setFile(null);
    setPreview(null);
    setProgress(INITIAL_PROGRESS);
    setImported([]);
    setSkipped([]);
    setSummary(null);
    setError(null);
  }, []);

  /** Step 1 → 2: parse locally and show the preview. No AI yet. */
  const handleFile = useCallback(async (selected: File) => {
    setError(null);
    try {
      const parsed = await parseCsvForPreview(selected);
      setFile(selected);
      setPreview(parsed);
      setStep('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read this file.');
    }
  }, []);

  /** Step 3: confirm — only now does the frontend call the backend. */
  const handleConfirm = useCallback(async () => {
    if (!file) return;
    setError(null);
    setStep('importing');
    setProgress(INITIAL_PROGRESS);
    setImported([]);
    setSkipped([]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamImport(
        file,
        (event) => {
          switch (event.type) {
            case 'meta':
              setProgress((p) => ({
                ...p,
                totalRows: event.totalRows,
                totalBatches: event.totalBatches,
              }));
              break;
            case 'batch':
              setImported((prev) => [...prev, ...event.result.imported]);
              setSkipped((prev) => [...prev, ...event.result.skipped]);
              setProgress((p) => ({
                ...p,
                batchesDone: p.batchesDone + 1,
                imported: p.imported + event.result.imported.length,
                skipped: p.skipped + event.result.skipped.length,
              }));
              break;
            case 'batch_error':
              setProgress((p) => ({ ...p, batchErrors: [...p.batchErrors, event.error] }));
              break;
            case 'done':
              setSummary(event.summary);
              setStep('results');
              break;
            case 'error':
              throw new Error(event.error);
          }
        },
        controller.signal,
      );
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(e instanceof Error ? e.message : 'Import failed unexpectedly.');
      setStep('preview');
    }
  }, [file]);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-brand-500">
            GrowEasy CRM
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">
            AI-powered CSV importer
          </h1>
          <p className="mt-2 max-w-xl text-sm text-neutral-500 dark:text-neutral-400">
            Upload any lead export — Facebook, Google Ads, another CRM, or a hand-made
            spreadsheet. The AI maps its columns into GrowEasy CRM fields automatically.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <div className="mb-6">
        <Stepper current={step} />
      </div>

      {error && (
        <p
          role="alert"
          className="mb-6 rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-medium text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
        >
          {error}
        </p>
      )}

      <section className="card p-5 sm:p-7">
        {step === 'upload' && <Dropzone onFile={handleFile} />}

        {step === 'preview' && preview && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold">Preview</h2>
                <p className="mt-0.5 font-mono text-xs text-neutral-500 dark:text-neutral-400">
                  {preview.fileName} · {formatBytes(preview.fileSize)} ·{' '}
                  {preview.rows.length.toLocaleString()} rows · {preview.headers.length} columns
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary" onClick={reset}>
                  Cancel
                </button>
                <button type="button" className="btn-primary" onClick={handleConfirm}>
                  Confirm import
                </button>
              </div>
            </div>
            <DataTable headers={preview.headers} rows={preview.rows} />
            <p className="text-xs text-neutral-400 dark:text-neutral-500">
              Nothing has been sent to the AI yet. Confirm the import to start mapping these rows
              into CRM fields.
            </p>
          </div>
        )}

        {step === 'importing' && <ImportProgress state={progress} />}

        {step === 'results' && summary && file && (
          <ResultsView
            summary={summary}
            imported={imported}
            skipped={skipped}
            fileName={file.name}
            onReset={reset}
          />
        )}
      </section>

      <footer className="mt-8 text-center font-mono text-xs text-neutral-400 dark:text-neutral-600">
        Fields extracted: created_at · name · email · phone · company · location · owner · status ·
        notes · source · possession · description
      </footer>
    </main>
  );
}
