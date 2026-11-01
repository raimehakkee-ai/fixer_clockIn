import { describe, expect, it } from 'vitest';

import { dateStringToUtcDate, inclusiveDays } from '../src/lib/date-range';

describe('dateStringToUtcDate', () => {
  it('menghasilkan tengah malam UTC', () => {
    expect(dateStringToUtcDate('2026-11-01').toISOString()).toBe(
      '2026-11-01T00:00:00.000Z',
    );
  });

  it('menolak format yang tidak lengkap', () => {
    expect(() => dateStringToUtcDate('2026-11')).toThrow();
  });
});

describe('inclusiveDays', () => {
  it('menghitung satu hari', () => {
    expect(inclusiveDays('2026-11-01', '2026-11-01')).toBe(1);
  });

  it('menghitung rentang inklusif', () => {
    expect(inclusiveDays('2026-11-01', '2026-11-03')).toBe(3);
    expect(inclusiveDays('2026-02-28', '2026-03-01')).toBe(2);
    expect(inclusiveDays('2026-12-31', '2027-01-01')).toBe(2);
  });

  it('mengembalikan 0 untuk rentang terbalik atau tidak valid', () => {
    expect(inclusiveDays('2026-11-03', '2026-11-01')).toBe(0);
    expect(inclusiveDays('bukan-tanggal', '2026-11-01')).toBe(0);
  });
});
