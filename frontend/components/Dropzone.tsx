'use client';

import { useCallback, useRef, useState } from 'react';
import { MAX_FILE_SIZE_MB } from '@/lib/api';

interface DropzoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
}

export function Dropzone({ onFile, disabled }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = useCallback(
    (file: File | undefined | null) => {
      setError(null);
      if (!file) return;
      if (!file.name.toLowerCase().endsWith('.csv')) {
        setError('Only .csv files are supported.');
        return;
      }
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setError(`File is too large. Maximum size is ${MAX_FILE_SIZE_MB} MB.`);
        return;
      }
      if (file.size === 0) {
        setError('This file is empty.');
        return;
      }
      onFile(file);
    },
    [onFile],
  );

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a CSV file"
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) accept(e.dataTransfer.files?.[0]);
        }}
        className={[
          'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors',
          dragging
            ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
            : 'border-neutral-300 hover:border-brand-500 hover:bg-brand-50/50 dark:border-neutral-700 dark:hover:bg-brand-500/5',
          disabled && 'pointer-events-none opacity-50',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-night-card">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-brand-500" aria-hidden>
            <path d="M12 16V4m0 0-4 4m4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" strokeLinecap="round" />
          </svg>
        </span>
        <div>
          <p className="font-display text-base font-semibold">Drop your CSV file here</p>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            or click to browse files
          </p>
        </div>
        <p className="rounded-full border border-neutral-200 px-3 py-1 font-mono text-xs text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
          .csv · max {MAX_FILE_SIZE_MB} MB · any column layout
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          accept(e.target.files?.[0]);
          e.target.value = ''; // allow re-selecting the same file
        }}
      />

      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
