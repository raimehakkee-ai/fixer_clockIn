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

/**
 * Tanggal kerja untuk shift yang mungkin melewati tengah malam.
 * Shift 22:00–08:00 yang dimulai pada 1 Nov: Clock-In pukul 02:00 tanggal 2 Nov
 * tetap milik work_date 1 Nov.
 */
export function resolveWorkDate(
  at: Date,
  shift: Pick<ShiftWindow, 'startTime' | 'endTime'>,
  timeZone: string,
): string {
  const localDate = officeDateString(at, timeZone);
  if (!crossesMidnight(shift.startTime, shift.endTime)) {
    return localDate;
  }

  const endMinutes = parseHhMm(shift.endTime);
  const localMinutes = officeMinutesOfDay(at, timeZone);
  return localMinutes < endMinutes ? addDaysToDateString(localDate, -1) : localDate;
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
  const relative = minutesSinceShiftStart(at, shift, timeZone);
  const duration = shiftDurationMinutes(shift);
  if (relative <= duration) {
    return true;
  }
  return relative >= 1440 - shift.earlyWindowMinutes;
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
