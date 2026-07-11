/** Types shared with the backend API contract. */

export const CRM_FIELDS = [
  'created_at',
  'name',
  'email',
  'country_code',
  'mobile_without_country_code',
  'company',
  'city',
  'state',
  'country',
  'lead_owner',
  'crm_status',
  'crm_note',
  'data_source',
  'possession_time',
  'description',
] as const;

export type CrmField = (typeof CRM_FIELDS)[number];

export const LEAD_QUALITIES = ['HOT', 'WARM', 'COLD'] as const;
export type LeadQuality = (typeof LEAD_QUALITIES)[number];

export type CrmRecord = Record<CrmField, string> & {
  rowIndex: number;
  lead_quality: LeadQuality | '';
  quality_reason: string;
};

export type RawRow = Record<string, string>;

export interface SkippedRecord {
  rowIndex: number;
  reason: string;
  raw: RawRow;
}

export interface BatchResult {
  batchIndex: number;
  imported: CrmRecord[];
  skipped: SkippedRecord[];
  attempts: number;
}

export interface ImportSummary {
  totalRows: number;
  imported: number;
  skipped: number;
  duplicates: number;
  batches: number;
  failedBatches: number;
  durationMs: number;
}

export type ImportEvent =
  | { type: 'meta'; totalRows: number; totalBatches: number; batchSize: number }
  | { type: 'duplicates'; skipped: SkippedRecord[] }
  | { type: 'batch'; result: BatchResult }
  | { type: 'batch_error'; batchIndex: number; error: string }
  | { type: 'done'; summary: ImportSummary }
  | { type: 'error'; error: string };

/** Client-side parse of the uploaded file, used for the preview step. */
export interface ParsedCsv {
  fileName: string;
  fileSize: number;
  headers: string[];
  rows: string[][];
}
