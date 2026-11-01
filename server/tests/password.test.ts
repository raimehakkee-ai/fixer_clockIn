import { describe, expect, it } from 'vitest';

import { comparePassword, hashPassword } from '../src/lib/password';

describe('password hashing', () => {
  it('menghasilkan hash bcrypt yang tidak sama dengan password asli', async () => {
    const hash = await hashPassword('Rahasia123!');

    expect(hash).not.toBe('Rahasia123!');
    expect(hash.startsWith('$2')).toBe(true);
  });

  it('memverifikasi password yang benar', async () => {
    const hash = await hashPassword('Rahasia123!');

    expect(await comparePassword('Rahasia123!', hash)).toBe(true);
  });

  it('menolak password yang salah', async () => {
    const hash = await hashPassword('Rahasia123!');

    expect(await comparePassword('Salah123!', hash)).toBe(false);
  });
});
