/** Mengubah "YYYY-MM-DD" menjadi Date pada 00:00 UTC (aman dari zona waktu). */
export function dateStringToUtcDate(value: string): Date {
  const [yearPart, monthPart, dayPart] = value.split('-');

  if (!yearPart || !monthPart || !dayPart) {
    throw new Error(`Tanggal tidak valid: ${value}`);
  }

  return new Date(
    Date.UTC(Number(yearPart), Number(monthPart) - 1, Number(dayPart)),
  );
}

/** Jumlah hari inklusif antara dua tanggal ISO (YYYY-MM-DD). */
export function inclusiveDays(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);

  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return 0;
  }

  return Math.round((end - start) / 86_400_000) + 1;
}
