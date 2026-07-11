import type { RawRow, SkippedRecord } from '../types/crm.js';
import { digitsOnly } from './normalize.js';

const EMAIL_SCAN_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_CANDIDATE_RE = /[+\d][\d\s\-().]{8,}\d/g;

/** Every email found anywhere in the row, lowercased. */
function emailKeys(row: RawRow): string[] {
  return Object.values(row).flatMap((v) => v.match(EMAIL_SCAN_RE) ?? []).map((e) => e.toLowerCase());
}

/**
 * Every phone found anywhere in the row, keyed by its last 10 digits so
 * "+91 98765 43210", "9876543210" and "09876543210" all collide.
 */
function phoneKeys(row: RawRow): string[] {
  return Object.values(row).flatMap((v) => {
    const candidates = v.match(PHONE_CANDIDATE_RE) ?? [];
    return candidates
      .map((c) => digitsOnly(c))
      .filter((d) => d.length >= 10)
      .map((d) => d.slice(-10));
  });
}

export interface DedupeResult {
  unique: Array<{ rowIndex: number; raw: RawRow }>;
  duplicates: SkippedRecord[];
}

/**
 * Detect duplicate leads BEFORE anything is sent to the AI: rows sharing an
 * email address or phone number with an earlier row are set aside. This keeps
 * the CRM clean and avoids spending AI quota on rows that would be redundant.
 * The first occurrence always wins.
 */
export function dedupeRows(rows: RawRow[]): DedupeResult {
  const seen = new Map<string, number>(); // contact key -> first row index
  const unique: DedupeResult['unique'] = [];
  const duplicates: SkippedRecord[] = [];

  rows.forEach((raw, rowIndex) => {
    const keys = [...emailKeys(raw), ...phoneKeys(raw)];
    const collision = keys.find((k) => seen.has(k));

    if (collision !== undefined) {
      const firstRow = seen.get(collision)!;
      duplicates.push({
        rowIndex,
        raw,
        reason: `Duplicate lead — same contact as row ${firstRow + 1}`,
      });
      return;
    }

    keys.forEach((k) => {
      if (!seen.has(k)) seen.set(k, rowIndex);
    });
    unique.push({ rowIndex, raw });
  });

  return { unique, duplicates };
}
