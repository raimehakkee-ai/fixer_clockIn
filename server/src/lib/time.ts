export type ShiftWindow = {
  startTime: string;
  endTime: string;
  toleranceMinutes: number;
  earlyWindowMinutes: number;
};

const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseHhMm(value: string): number {
  const match = HH_MM.exec(value);
  if (!match) {
    throw new Error(`Format jam tidak valid: "${value}" (harus HH:mm)`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatHhMm(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function crossesMidnight(startTime: string, endTime: string): boolean {
  return parseHhMm(endTime) <= parseHhMm(startTime);
}

export function shiftDurationMinutes(shift: Pick<ShiftWindow, 'startTime' | 'endTime'>): number {
  const start = parseHhMm(shift.startTime);
  const end = parseHhMm(shift.endTime);
  return end > start ? end - start : end + 1440 - start;
}

type OfficeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function officeParts(date: Date, timeZone: string): OfficeParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value;
    if (value === undefined) {
      throw new Error(`Zona waktu tidak valid: ${timeZone}`);
    }
    return Number(value);
  };

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  };
}

/** Tanggal kalender pada zona waktu kantor, format YYYY-MM-DD. */
export function officeDateString(date: Date, timeZone: string): string {
  const { year, month, day } = officeParts(date, timeZone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function officeMinutesOfDay(date: Date, timeZone: string): number {
  const { hour, minute } = officeParts(date, timeZone);
  return hour * 60 + minute;
}

export function addDaysToDateString(dateString: string, days: number): string {
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) {
    throw new Error(`Tanggal tidak valid: ${dateString}`);
  }
  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export function dateStringToEpochDay(dateString: string): number {
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) {
    throw new Error(`Tanggal tidak valid: ${dateString}`);
  }

  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

/** Menit berlalu sejak jam mulai shift, dinormalisasi ke 0..1439. */
export function minutesSinceShiftStart(
  at: Date,
  shift: Pick<ShiftWindow, 'startTime'>,
  timeZone: string,
): number {
  const local = officeMinutesOfDay(at, timeZone);
  const start = parseHhMm(shift.startTime);
  return (((local - start) % 1440) + 1440) % 1440;
}

export type ShiftOccurrence = {
  workDate: string;
  /** Selisih menit dari jam mulai shift pada tanggal kerja tersebut. */
  relativeMinutes: number;
};

export type ShiftOccurrenceOptions = {
  /** Menit tambahan setelah jam selesai shift (khusus Clock-Out). */
  graceMinutes?: number;
  /**
   * Izinkan waktu sebelum jam mulai shift selama earlyWindowMinutes.
   * Default true agar perilaku Clock-In yang sudah ada tidak berubah.
   */
  allowEarly?: boolean;
};

/**
 * Mencari kemunculan shift yang paling dekat dengan waktu `at`.
 *
 * Pendekatan ini menggantikan perhitungan modulo sederhana yang bermasalah
 * pada dua kasus: Clock-Out tepat di jam selesai shift malam, dan Clock-In
 * lebih awal sebelum tengah malam untuk shift yang mulai setelah 00:00.
 */
export function resolveShiftOccurrence(
  at: Date,
  shift: Pick<
    ShiftWindow,
    'startTime' | 'endTime' | 'earlyWindowMinutes'
  >,
  timeZone: string,
  options: ShiftOccurrenceOptions = {},
): ShiftOccurrence | null {
  const localDate = officeDateString(at, timeZone);
  const localMinutes = officeMinutesOfDay(at, timeZone);
  const atMinutes = dateStringToEpochDay(localDate) * 1440 + localMinutes;
  const startMinutes = parseHhMm(shift.startTime);
  const duration = shiftDurationMinutes(shift);
  const grace = Math.max(0, options.graceMinutes ?? 0);
  const allowEarly = options.allowEarly ?? true;
  const early = allowEarly ? shift.earlyWindowMinutes : 0;
  const maxLate = duration + grace;

  let best: (ShiftOccurrence & { score: number }) | null = null;

  for (const dayOffset of [-1, 0, 1]) {
    const workDate = addDaysToDateString(localDate, dayOffset);
    const start =
      dateStringToEpochDay(workDate) * 1440 + startMinutes;
    const relativeMinutes = atMinutes - start;

    if (relativeMinutes < -early || relativeMinutes > maxLate) {
      continue;
    }

    const score = Math.abs(relativeMinutes);
    if (
      !best ||
      score < best.score ||
      (score === best.score && relativeMinutes >= 0)
    ) {
      best = { workDate, relativeMinutes, score };
    }
  }

  if (!best) {
    return null;
  }

  return {
    workDate: best.workDate,
    relativeMinutes: best.relativeMinutes,
  };
}

/**
 * Tanggal kerja untuk Clock-In, termasuk shift yang melewati tengah malam.
 * Shift 22:00–08:00 yang dimulai pada 1 Nov: Clock-In pukul 02:00 tanggal
 * 2 Nov tetap milik work_date 1 Nov.
 */
export function resolveWorkDate(
  at: Date,
  shift: Pick<
    ShiftWindow,
    'startTime' | 'endTime' | 'earlyWindowMinutes'
  >,
  timeZone: string,
): string {
  return (
    resolveShiftOccurrence(at, shift, timeZone)?.workDate ??
    officeDateString(at, timeZone)
  );
}

/** Tanggal kerja untuk Clock-Out, termasuk grace period setelah shift. */
export function resolveClockOutWorkDate(
  at: Date,
  shift: Pick<
    ShiftWindow,
    'startTime' | 'endTime' | 'earlyWindowMinutes'
  >,
  timeZone: string,
  graceMinutes: number,
): string {
  return (
    resolveShiftOccurrence(at, shift, timeZone, { graceMinutes })?.workDate ??
    officeDateString(at, timeZone)
  );
}

/**
 * Clock-In hanya boleh dalam jendela [start - earlyWindow, end].
 * Mengembalikan true bila masih di dalam jendela shift.
 */
export function isWithinShiftWindow(
  at: Date,
  shift: ShiftWindow,
  timeZone: string,
): boolean {
  return resolveShiftOccurrence(at, shift, timeZone) !== null;
}

/**
 * Clock-Out boleh dilakukan setelah shift berakhir selama grace period,
 * agar karyawan tidak kehilangan absensi pulang karena terlambat beberapa menit.
 */
export function isWithinClockOutWindow(
  at: Date,
  shift: ShiftWindow,
  timeZone: string,
  graceMinutes: number,
): boolean {
  return (
    resolveShiftOccurrence(at, shift, timeZone, { graceMinutes }) !== null
  );
}

/**
 * Apakah `at` sudah melewati jam selesai shift + grace untuk workDate tertentu.
 * Dipakai finalizer untuk menandai record tanpa Clock-Out sebagai INCOMPLETE.
 */
export function isPastShiftEnd(
  at: Date,
  workDate: string,
  shift: Pick<ShiftWindow, 'startTime' | 'endTime'>,
  timeZone: string,
  graceMinutes = 0,
): boolean {
  const endMinutes =
    parseHhMm(shift.startTime) + shiftDurationMinutes(shift) + graceMinutes;
  const endWall = dateStringToEpochDay(workDate) * 1440 + endMinutes;
  const nowWall =
    dateStringToEpochDay(officeDateString(at, timeZone)) * 1440 +
    officeMinutesOfDay(at, timeZone);

  return nowWall > endWall;
}

/** Keterlambatan setelah toleransi. Clock-In lebih awal selalu 0. */
export function computeLateMinutes(
  at: Date,
  shift: ShiftWindow,
  timeZone: string,
): number {
  const relative = minutesSinceShiftStart(at, shift, timeZone);
  if (relative >= 1440 - shift.earlyWindowMinutes) {
    return 0;
  }
  if (relative > shiftDurationMinutes(shift)) {
    return 0;
  }
  return Math.max(0, relative - shift.toleranceMinutes);
}
