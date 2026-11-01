import { describe, expect, it } from 'vitest';

import {
  emailSchema,
  hhmmSchema,
  isValidTimeZone,
  passwordSchema,
} from '../src/lib/validation';

describe('passwordSchema', () => {
  it('menerima password dengan huruf dan angka', () => {
    expect(passwordSchema.safeParse('Employee123!').success).toBe(true);
  });

  it('menolak password kurang dari 8 karakter', () => {
    expect(passwordSchema.safeParse('Aa1').success).toBe(false);
  });

  it('menolak password tanpa angka', () => {
    expect(passwordSchema.safeParse('PasswordOnly').success).toBe(false);
  });

  it('menolak password tanpa huruf', () => {
    expect(passwordSchema.safeParse('12345678').success).toBe(false);
  });
});

describe('hhmmSchema', () => {
  it('menerima format HH:mm yang valid', () => {
    expect(hhmmSchema.safeParse('08:00').success).toBe(true);
    expect(hhmmSchema.safeParse('23:59').success).toBe(true);
    expect(hhmmSchema.safeParse('00:00').success).toBe(true);
  });

  it('menolak format yang salah', () => {
    expect(hhmmSchema.safeParse('8:00').success).toBe(false);
    expect(hhmmSchema.safeParse('24:00').success).toBe(false);
    expect(hhmmSchema.safeParse('08:60').success).toBe(false);
  });
});

describe('isValidTimeZone', () => {
  it('menerima zona waktu IANA', () => {
    expect(isValidTimeZone('Asia/Jakarta')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
  });

  it('menolak zona waktu fiktif', () => {
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });
});

describe('emailSchema', () => {
  it('menormalkan email menjadi huruf kecil', () => {
    expect(emailSchema.parse(' Budi@ClockIn.TEST ')).toBe('budi@clockin.test');
  });

  it('menolak email tidak valid', () => {
    expect(emailSchema.safeParse('bukan-email').success).toBe(false);
  });
});
