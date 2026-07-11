import { describe, expect, it } from 'vitest';
import {
  asCleanString,
  escapeLineBreaks,
  finalizeRecord,
  isParseableDate,
  normalizeCountryCode,
  normalizeEnum,
  splitExtraEmails,
  splitExtraPhones,
  splitPhone,
} from '../normalize.js';
import { CRM_STATUSES } from '../../types/crm.js';

describe('escapeLineBreaks', () => {
  it('escapes every kind of line break so a record stays one CSV row', () => {
    expect(escapeLineBreaks('a\nb\r\nc\rd')).toBe('a\\nb\\nc\\nd');
  });
});

describe('asCleanString', () => {
  it('trims, stringifies and blanks null-ish placeholders', () => {
    expect(asCleanString('  hello ')).toBe('hello');
    expect(asCleanString(42)).toBe('42');
    expect(asCleanString(null)).toBe('');
    expect(asCleanString('N/A')).toBe('');
  });
});

describe('normalizeEnum', () => {
  it('accepts allowed values case-insensitively and blanks everything else', () => {
    expect(normalizeEnum('sale_done', CRM_STATUSES)).toBe('SALE_DONE');
    expect(normalizeEnum('HOT LEAD', CRM_STATUSES)).toBe('');
  });
});

describe('isParseableDate', () => {
  it('matches the JavaScript new Date() contract from the assignment', () => {
    expect(isParseableDate('2026-05-13 14:20:48')).toBe(true);
    expect(isParseableDate('13-45-2026')).toBe(false);
    expect(isParseableDate('')).toBe(false);
  });
});

describe('splitPhone / normalizeCountryCode', () => {
  it('splits international numbers into code + national number', () => {
    expect(splitPhone('+91 98765 43210')).toEqual({ countryCode: '+91', mobile: '9876543210' });
    expect(splitPhone('919876543210')).toEqual({ countryCode: '+91', mobile: '9876543210' });
  });
  it('drops trunk zeros and keeps bare numbers without inventing a code', () => {
    expect(splitPhone('09876543210')).toEqual({ countryCode: '', mobile: '9876543210' });
    expect(splitPhone('9876543210')).toEqual({ countryCode: '', mobile: '9876543210' });
  });
  it('normalizes country codes to +NN', () => {
    expect(normalizeCountryCode('91')).toBe('+91');
    expect(normalizeCountryCode('0091')).toBe('+91');
    expect(normalizeCountryCode('')).toBe('');
  });
});

describe('splitExtraEmails / splitExtraPhones (assignment rule 5)', () => {
  it('keeps the first email and returns the rest as extras', () => {
    expect(splitExtraEmails('john@example.com, backup@example.com')).toEqual({
      first: 'john@example.com',
      extras: ['backup@example.com'],
    });
    expect(splitExtraEmails('solo@example.com')).toEqual({
      first: 'solo@example.com',
      extras: [],
    });
  });

  it('keeps the first phone number and returns the rest as extras', () => {
    expect(splitExtraPhones('9876543210 / 9123456780')).toEqual({
      first: '9876543210',
      extras: ['9123456780'],
    });
    expect(splitExtraPhones('9876543210')).toEqual({
      first: '9876543210',
      extras: [],
    });
  });
});

describe('finalizeRecord', () => {
  it('imports a record that has valid contact information', () => {
    const result = finalizeRecord({
      name: 'John Doe',
      email: 'john@example.com',
      mobile_without_country_code: '+91 9876543210',
      crm_status: 'sale_done',
      created_at: '2026-05-13 14:20:48',
    });
    expect(result.record).toBeDefined();
    expect(result.record?.country_code).toBe('+91');
    expect(result.record?.mobile_without_country_code).toBe('9876543210');
    expect(result.record?.crm_status).toBe('SALE_DONE');
  });

  it('skips a record with neither email nor mobile (assignment rule 7)', () => {
    const result = finalizeRecord({ name: 'Ghost Lead', city: 'Mumbai' });
    expect(result.skipReason).toMatch(/neither/i);
  });

  it('moves an invalid email out of the email field instead of importing garbage', () => {
    const result = finalizeRecord({
      email: 'not-an-email',
      mobile_without_country_code: '9876543210',
    });
    expect(result.record?.email).toBe('');
    expect(result.record?.crm_note).toContain('not-an-email');
  });

  it('preserves unparseable dates in crm_note rather than breaking new Date()', () => {
    const result = finalizeRecord({
      email: 'a@b.com',
      created_at: 'sometime last week',
    });
    expect(result.record?.created_at).toBe('');
    expect(result.record?.crm_note).toContain('sometime last week');
  });

  it('blanks out-of-vocabulary data_source values', () => {
    const result = finalizeRecord({ email: 'a@b.com', data_source: 'Facebook Ads' });
    expect(result.record?.data_source).toBe('');
  });

  it('keeps the first email/phone and moves extras to crm_note even if the AI bunched them together (rule 5)', () => {
    const result = finalizeRecord({
      email: 'primary@example.com, secondary@example.com',
      mobile_without_country_code: '9876543210 / 9123456780',
    });
    expect(result.record?.email).toBe('primary@example.com');
    expect(result.record?.mobile_without_country_code).toBe('9876543210');
    expect(result.record?.crm_note).toContain('secondary@example.com');
    expect(result.record?.crm_note).toContain('9123456780');
  });
});
