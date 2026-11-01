import { z } from 'zod';

import { parseHhMm } from './time';

export const emailSchema = z
  .string()
  .trim()
  .email('Format email tidak valid')
  .max(255)
  .transform((value) => value.toLowerCase());

export const passwordSchema = z
  .string()
  .min(8, 'Password minimal 8 karakter')
  .max(72, 'Password maksimal 72 karakter')
  .regex(/[A-Za-z]/, 'Password harus memuat huruf')
  .regex(/\d/, 'Password harus memuat angka');

export const hhmmSchema = z.string().refine(
  (value) => {
    try {
      parseHhMm(value);
      return true;
    } catch {
      return false;
    }
  },
  'Format jam harus HH:mm (00:00–23:59)',
);

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

export const timeZoneSchema = z
  .string()
  .min(1)
  .max(64)
  .refine(isValidTimeZone, 'Zona waktu IANA tidak valid');

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')
  .refine((value) => {
    const [yearPart, monthPart, dayPart] = value.split('-');
    if (!yearPart || !monthPart || !dayPart) {
      return false;
    }

    const year = Number(yearPart);
    const month = Number(monthPart);
    const day = Number(dayPart);
    const date = new Date(Date.UTC(year, month - 1, day));

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, 'Tanggal tidak valid');
