import { parse } from 'csv-parse/sync';
import type { RawRow } from '../types/crm.js';

export class CsvParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CsvParseError';
  }
}

/**
 * Parse an uploaded CSV buffer into header-keyed rows.
 * No assumptions about column names — headers are taken as-is, and blank or
 * duplicate headers are made unique so no data is silently dropped.
 */
export function parseCsv(buffer: Buffer): { headers: string[]; rows: RawRow[] } {
  let rawRows: string[][];
  try {
    rawRows = parse(buffer, {
      bom: true,
      relax_column_count: true,
      relax_quotes: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (error) {
    throw new CsvParseError(
      `The file could not be parsed as CSV: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (rawRows.length === 0) throw new CsvParseError('The CSV file is empty');
  if (rawRows.length === 1) throw new CsvParseError('The CSV file has headers but no data rows');

  const headers = dedupeHeaders(rawRows[0]);
  const rows: RawRow[] = rawRows.slice(1).map((cells) => {
    const row: RawRow = {};
    headers.forEach((header, i) => {
      row[header] = cells[i] ?? '';
    });
    // Rows longer than the header line still keep their extra data.
    for (let i = headers.length; i < cells.length; i++) {
      row[`extra_column_${i + 1}`] = cells[i];
    }
    return row;
  });

  return { headers, rows: rows.filter((row) => Object.values(row).some((v) => v !== '')) };
}

function dedupeHeaders(headerRow: string[]): string[] {
  const seen = new Map<string, number>();
  return headerRow.map((raw, i) => {
    const base = raw.trim() || `column_${i + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  });
}
