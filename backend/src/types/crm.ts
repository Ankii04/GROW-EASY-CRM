/**
 * GrowEasy CRM domain types.
 * These mirror the target import format defined in the assignment.
 */

export const CRM_STATUSES = [
  'GOOD_LEAD_FOLLOW_UP',
  'DID_NOT_CONNECT',
  'BAD_LEAD',
  'SALE_DONE',
] as const;

export const DATA_SOURCES = [
  'leads_on_demand',
  'meridian_tower',
  'eden_park',
  'varah_swamy',
  'sarjapur_plots',
] as const;

export type CrmStatus = (typeof CRM_STATUSES)[number];
export type DataSource = (typeof DATA_SOURCES)[number];

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

/** A fully-mapped CRM lead record. Unknown values are empty strings. */
export type CrmRecord = Record<CrmField, string>;

/** Raw CSV row keyed by original (arbitrary) column headers. */
export type RawRow = Record<string, string>;

/** A record the pipeline decided not to import, with the reason why. */
export interface SkippedRecord {
  rowIndex: number; // 0-based index into the original data rows
  reason: string;
  raw: RawRow;
}

/** Result of processing one batch of rows. */
export interface BatchResult {
  batchIndex: number;
  imported: Array<CrmRecord & { rowIndex: number }>;
  skipped: SkippedRecord[];
  attempts: number;
}

/** Final import summary sent to the client. */
export interface ImportSummary {
  totalRows: number;
  imported: number;
  skipped: number;
  batches: number;
  failedBatches: number;
  durationMs: number;
}

/** NDJSON stream events emitted while an import is in progress. */
export type ImportEvent =
  | { type: 'meta'; totalRows: number; totalBatches: number; batchSize: number }
  | { type: 'batch'; result: BatchResult }
  | { type: 'batch_error'; batchIndex: number; error: string }
  | { type: 'done'; summary: ImportSummary }
  | { type: 'error'; error: string };
