import { env } from '../config/env.js';
import { SYSTEM_PROMPT, buildUserPrompt } from '../prompts/extraction.prompt.js';
import type { BatchResult, ImportEvent, RawRow, SkippedRecord } from '../types/crm.js';
import { chunk, runPool, withRetry } from '../utils/batch.js';
import { asCleanString, finalizeRecord } from '../utils/normalize.js';
import { extractJson, getAiClient } from './ai/provider.js';

interface AiRowResult extends Record<string, unknown> {
  __row?: number;
  skip?: boolean;
  skip_reason?: string;
}

/**
 * Run one batch of raw rows through the model and validate every result.
 * If the model drops a row, that row is retried implicitly via the batch retry
 * and, as a last resort, reported as skipped rather than silently lost.
 */
async function processBatch(
  batchIndex: number,
  rows: Array<{ rowIndex: number; raw: RawRow }>,
): Promise<BatchResult> {
  const client = getAiClient();
  const payload = rows.map(({ rowIndex, raw }) => ({ ...raw, __row: rowIndex }));

  const { value: aiRecords, attempts } = await withRetry(
    async () => {
      const text = await client.complete(SYSTEM_PROMPT, buildUserPrompt(payload));
      const parsed = extractJson(text) as { records?: AiRowResult[] } | AiRowResult[];
      const records = Array.isArray(parsed) ? parsed : parsed.records;
      if (!Array.isArray(records)) {
        throw new Error('Model response is missing the "records" array');
      }
      return records;
    },
    {
      retries: env.MAX_RETRIES,
      onRetry: (attempt, error) =>
        console.warn(
          `[batch ${batchIndex}] attempt ${attempt} failed, retrying:`,
          error instanceof Error ? error.message : error,
        ),
    },
  );

  const byRow = new Map<number, AiRowResult>();
  for (const record of aiRecords) {
    const rowIndex = Number(record.__row);
    if (Number.isInteger(rowIndex)) byRow.set(rowIndex, record);
  }

  const result: BatchResult = { batchIndex, imported: [], skipped: [], attempts };

  for (const { rowIndex, raw } of rows) {
    const aiRecord = byRow.get(rowIndex);

    if (!aiRecord) {
      result.skipped.push({ rowIndex, raw, reason: 'The AI response did not include this row' });
      continue;
    }
    if (aiRecord.skip === true) {
      result.skipped.push({
        rowIndex,
        raw,
        reason: asCleanString(aiRecord.skip_reason) || 'Skipped by AI (no contact information)',
      });
      continue;
    }

    const finalized = finalizeRecord(aiRecord);
    if (finalized.record) {
      result.imported.push({ ...finalized.record, rowIndex });
    } else {
      result.skipped.push({ rowIndex, raw, reason: finalized.skipReason });
    }
  }

  return result;
}

/**
 * Process every row of an upload in concurrent, retried batches.
 * Emits an ImportEvent after every batch so callers can stream progress.
 */
export async function runImport(
  rows: RawRow[],
  emit: (event: ImportEvent) => void,
): Promise<void> {
  const startedAt = Date.now();
  const indexed = rows.map((raw, rowIndex) => ({ rowIndex, raw }));
  const batches = chunk(indexed, env.BATCH_SIZE);

  emit({
    type: 'meta',
    totalRows: rows.length,
    totalBatches: batches.length,
    batchSize: env.BATCH_SIZE,
  });

  let imported = 0;
  let skipped = 0;
  let failedBatches = 0;

  const tasks = batches.map((batch, i) => () => processBatch(i, batch));

  await runPool(tasks, env.MAX_CONCURRENT_BATCHES, (settled, batchIndex) => {
    if (settled.status === 'fulfilled') {
      imported += settled.value.imported.length;
      skipped += settled.value.skipped.length;
      emit({ type: 'batch', result: settled.value });
    } else {
      // Retries exhausted — surface the failure and keep the numbers honest
      // by marking every row of the batch as skipped.
      failedBatches += 1;
      const failedRows: SkippedRecord[] = batches[batchIndex].map(({ rowIndex, raw }) => ({
        rowIndex,
        raw,
        reason: 'AI processing failed for this batch after all retries',
      }));
      skipped += failedRows.length;
      const message =
        settled.reason instanceof Error ? settled.reason.message : String(settled.reason);
      emit({ type: 'batch_error', batchIndex, error: message });
      emit({
        type: 'batch',
        result: { batchIndex, imported: [], skipped: failedRows, attempts: env.MAX_RETRIES + 1 },
      });
    }
  });

  emit({
    type: 'done',
    summary: {
      totalRows: rows.length,
      imported,
      skipped,
      batches: batches.length,
      failedBatches,
      durationMs: Date.now() - startedAt,
    },
  });
}
