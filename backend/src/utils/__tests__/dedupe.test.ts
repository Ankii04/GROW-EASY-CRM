import { describe, expect, it } from 'vitest';
import { dedupeRows } from '../dedupe.js';

describe('dedupeRows', () => {
  it('flags a row repeating an earlier email, whatever the column is called', () => {
    const { unique, duplicates } = dedupeRows([
      { Name: 'John', 'E-mail': 'john@example.com' },
      { 'Lead Name': 'Johnny', Contact: 'john@example.com' },
    ]);
    expect(unique.map((u) => u.rowIndex)).toEqual([0]);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]?.rowIndex).toBe(1);
    expect(duplicates[0]?.reason).toContain('row 1');
  });

  it('matches phones by last 10 digits across formats', () => {
    const { duplicates } = dedupeRows([
      { Phone: '+91 98765 43210' },
      { Mobile: '09876543210' },
      { WhatsApp: '9876543210' },
    ]);
    expect(duplicates).toHaveLength(2);
  });

  it('keeps distinct leads untouched', () => {
    const { unique, duplicates } = dedupeRows([
      { Email: 'a@x.com', Phone: '9876543210' },
      { Email: 'b@x.com', Phone: '9123456780' },
    ]);
    expect(unique).toHaveLength(2);
    expect(duplicates).toHaveLength(0);
  });

  it('does not treat rows with no contact info as duplicates of each other', () => {
    const { unique, duplicates } = dedupeRows([
      { Name: 'Ghost 1', City: 'Pune' },
      { Name: 'Ghost 2', City: 'Delhi' },
    ]);
    expect(unique).toHaveLength(2);
    expect(duplicates).toHaveLength(0);
  });
});
