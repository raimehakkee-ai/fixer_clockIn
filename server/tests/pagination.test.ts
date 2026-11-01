import { describe, expect, it } from 'vitest';

import { paginated, skipFor } from '../src/lib/pagination';

describe('skipFor', () => {
  it('menghitung offset dari halaman dan limit', () => {
    expect(skipFor({ page: 1, limit: 20 })).toBe(0);
    expect(skipFor({ page: 3, limit: 10 })).toBe(20);
    expect(skipFor({ page: 5, limit: 100 })).toBe(400);
  });
});

describe('paginated', () => {
  it('menghitung totalPages dengan pembulatan ke atas', () => {
    const result = paginated([1, 2, 3], 41, { page: 2, limit: 20 });

    expect(result.meta).toEqual({
      page: 2,
      limit: 20,
      total: 41,
      totalPages: 3,
    });
  });

  it('mengembalikan totalPages 0 saat tidak ada data', () => {
    const result = paginated([], 0, { page: 1, limit: 20 });
    expect(result.meta.totalPages).toBe(0);
    expect(result.data).toEqual([]);
  });

  it('membulatkan tepat pada kelipatan limit', () => {
    expect(paginated([], 40, { page: 1, limit: 20 }).meta.totalPages).toBe(2);
  });
});
