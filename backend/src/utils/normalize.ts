import {
  CRM_FIELDS,
  CRM_STATUSES,
  DATA_SOURCES,
  type CrmRecord,
  type CrmStatus,
  type DataSource,
} from '../types/crm.js';

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

/**
 * The AI is instructed to return clean data, but models are probabilistic.
 * Everything here is a deterministic safety net so a bad model response can
 * never put malformed data into the CRM.
 */

/** Escape literal line breaks so every record stays a single CSV row. */
export function escapeLineBreaks(value: string): string {
  return value.replace(/\r\n|\r|\n/g, '\\n');
}

/** Coerce any AI-returned value into a trimmed, single-line string. */
export function asCleanString(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'string' ? value : String(value);
  const trimmed = s.trim();
  if (['null', 'undefined', 'n/a', 'na', '-', '--'].includes(trimmed.toLowerCase())) return '';
  return escapeLineBreaks(trimmed);
}

/** Keep only an allowed enum value; anything else becomes blank. */
export function normalizeEnum<T extends string>(value: string, allowed: readonly T[]): T | '' {
  const upper = value.trim();
  const match = allowed.find((v) => v.toLowerCase() === upper.toLowerCase());
  return match ?? '';
}

/** Valid if JavaScript's `new Date(value)` produces a real date. */
export function isParseableDate(value: string): boolean {
  if (!value) return false;
  return !Number.isNaN(new Date(value).getTime());
}

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value);
}

/** Strip everything but digits from a phone value. */
export function digitsOnly(value: string): string {
  return value.replace(/\D+/g, '');
}

/**
 * Normalize a country code to `+NN` form. Accepts "91", "+91", "0091".
 * Returns '' when there is nothing usable.
 */
export function normalizeCountryCode(value: string): string {
  const digits = digitsOnly(value).replace(/^00/, '');
  if (!digits || digits.length > 4) return '';
  return `+${digits}`;
}

/**
 * Split a raw phone into { countryCode, mobile }.
 * Handles values like "+91 98765 43210", "919876543210", "09876543210".
 */
export function splitPhone(raw: string, fallbackCountryCode = ''): {
  countryCode: string;
  mobile: string;
} {
  const hasPlus = raw.trim().startsWith('+') || raw.trim().startsWith('00');
  let digits = digitsOnly(raw).replace(/^00/, '');
  let countryCode = fallbackCountryCode;

  if (hasPlus && digits.length > 10) {
    countryCode = `+${digits.slice(0, digits.length - 10)}`;
    digits = digits.slice(-10);
  } else if (digits.length > 10) {
    // e.g. "919876543210" or leading trunk zero "09876543210"
    if (digits.startsWith('0') && digits.length === 11) {
      digits = digits.slice(1);
    } else {
      countryCode = `+${digits.slice(0, digits.length - 10)}`;
      digits = digits.slice(-10);
    }
  }

  return { countryCode: normalizeCountryCode(countryCode), mobile: digits };
}

/**
 * Build a validated CrmRecord from whatever object the AI returned.
 * Returns { record } on success or { skipReason } when the row must be skipped.
 */
export function finalizeRecord(
  candidate: Record<string, unknown>,
): { record: CrmRecord; skipReason?: undefined } | { record?: undefined; skipReason: string } {
  const record = Object.fromEntries(
    CRM_FIELDS.map((f) => [f, asCleanString(candidate[f])]),
  ) as CrmRecord;

  // Enum enforcement — never let an out-of-vocabulary value through.
  record.crm_status = normalizeEnum<CrmStatus>(record.crm_status, CRM_STATUSES);
  record.data_source = normalizeEnum<DataSource>(record.data_source, DATA_SOURCES);

  // Phone hygiene: keep country code and number in their own fields.
  if (record.mobile_without_country_code) {
    const { countryCode, mobile } = splitPhone(
      record.mobile_without_country_code,
      record.country_code,
    );
    record.mobile_without_country_code = mobile;
    if (countryCode) record.country_code = countryCode;
  }
  record.country_code = normalizeCountryCode(record.country_code);

  // Email hygiene: a non-email value in the email field is worse than a blank.
  if (record.email && !isValidEmail(record.email)) {
    record.crm_note = [record.crm_note, `Unverified contact value: ${record.email}`]
      .filter(Boolean)
      .join(' | ');
    record.email = '';
  }

  // Date must be convertible with `new Date(created_at)`.
  if (record.created_at && !isParseableDate(record.created_at)) {
    record.crm_note = [record.crm_note, `Original date: ${record.created_at}`]
      .filter(Boolean)
      .join(' | ');
    record.created_at = '';
  }

  // Hard rule from the assignment: no email AND no mobile → skip.
  if (!record.email && !record.mobile_without_country_code) {
    return { skipReason: 'Record has neither an email address nor a mobile number' };
  }

  return { record };
}
