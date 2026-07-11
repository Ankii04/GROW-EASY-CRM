import type { Request, Response } from 'express';
import { CsvParseError, parseCsv } from '../services/csv.service.js';
import { runImport } from '../services/extraction.service.js';
import type { BatchResult, ImportEvent, ImportSummary } from '../types/crm.js';

/**
 * POST /api/import
 * Accepts a multipart CSV upload and streams NDJSON progress events:
 *   {"type":"meta",...}  → once, before processing starts
 *   {"type":"batch",...} → after every processed batch
 *   {"type":"done",...}  → once, with the final summary
 * Clients that don't care about streaming can simply buffer the body and
 * read the last line.
 */
export async function importCsv(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded. Send a CSV file in the "file" field.' });
    return;
  }
  if (req.file.size === 0) {
    res.status(400).json({ error: 'The uploaded file is empty.' });
    return;
  }

  let rows;
  try {
    ({ rows } = parseCsv(req.file.buffer));
  } catch (error) {
    const message = error instanceof CsvParseError ? error.message : 'Failed to parse CSV file.';
    res.status(422).json({ error: message });
    return;
  }

  res.status(200);
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no'); // disable proxy buffering (nginx et al.)
  res.flushHeaders?.();

  const emit = (event: ImportEvent) => {
    if (!res.writableEnded) res.write(`${JSON.stringify(event)}\n`);
  };

  try {
    await runImport(rows, emit);
  } catch (error) {
    emit({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unexpected error during import.',
    });
  } finally {
    res.end();
  }
}

/**
 * POST /api/import/sync
 * Same pipeline, but buffers everything and answers with a single JSON body.
 * Useful for scripts, curl and automated tests.
 */
export async function importCsvSync(req: Request, res: Response): Promise<void> {
  if (!req.file || req.file.size === 0) {
    res.status(400).json({ error: 'No file uploaded. Send a CSV file in the "file" field.' });
    return;
  }

  let rows;
  try {
    ({ rows } = parseCsv(req.file.buffer));
  } catch (error) {
    const message = error instanceof CsvParseError ? error.message : 'Failed to parse CSV file.';
    res.status(422).json({ error: message });
    return;
  }

  const batches: BatchResult[] = [];
  let summary: ImportSummary | null = null;

  await runImport(rows, (event) => {
    if (event.type === 'batch') batches.push(event.result);
    if (event.type === 'done') summary = event.summary;
  });

  const imported = batches
    .flatMap((b) => b.imported)
    .sort((a, b) => a.rowIndex - b.rowIndex);
  const skipped = batches
    .flatMap((b) => b.skipped)
    .sort((a, b) => a.rowIndex - b.rowIndex);

  res.json({ summary, imported, skipped });
}
