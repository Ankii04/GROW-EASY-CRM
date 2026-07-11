import Papa from 'papaparse';
import { CRM_FIELDS, type CrmRecord, type ImportEvent, type ParsedCsv } from './types';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080').replace(
  /\/$/,
  '',
);

export const MAX_FILE_SIZE_MB = 5;

/**
 * Upload the CSV and consume the backend's NDJSON progress stream,
 * invoking `onEvent` for every event as it arrives.
 */
export async function streamImport(
  file: File,
  onEvent: (event: ImportEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`${API_URL}/api/import`, { method: 'POST', body: form, signal });

  if (!res.ok) {
    let message = `Import failed (HTTP ${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }
  if (!res.body) throw new Error('The server did not return a response stream.');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const dispatch = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      onEvent(JSON.parse(trimmed) as ImportEvent);
    } catch {
      console.warn('Skipping malformed stream line:', trimmed);
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    lines.forEach(dispatch);
  }
  dispatch(buffer);
}

/** Parse the uploaded file locally for the preview step (no AI involved). */
export function parseCsvForPreview(file: File): Promise<ParsedCsv> {
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      skipEmptyLines: 'greedy',
      complete: ({ data }) => {
        if (data.length === 0) return reject(new Error('The CSV file is empty.'));
        if (data.length === 1)
          return reject(new Error('The CSV file has headers but no data rows.'));

        const headers = dedupeHeaders(data[0]);
        const width = headers.length;
        const rows = data
          .slice(1)
          .map((cells) =>
            Array.from({ length: Math.max(width, cells.length) }, (_, i) => cells[i] ?? ''),
          )
          .filter((cells) => cells.some((v) => v.trim() !== ''));

        resolve({ fileName: file.name, fileSize: file.size, headers, rows });
      },
      error: (error) => reject(new Error(`Could not read the file: ${error.message}`)),
    });
  });
}

function dedupeHeaders(headerRow: string[]): string[] {
  const seen = new Map<string, number>();
  return headerRow.map((raw, i) => {
    const base = (raw ?? '').trim() || `column_${i + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  });
}

/** Turn imported records back into a GrowEasy-format CSV and download it. */
export function downloadRecordsAsCsv(records: CrmRecord[], sourceFileName: string): void {
  const csv = Papa.unparse({
    fields: [...CRM_FIELDS],
    data: records.map((r) => CRM_FIELDS.map((f) => r[f] ?? '')),
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = sourceFileName.replace(/\.csv$/i, '') + '_groweasy_crm.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
