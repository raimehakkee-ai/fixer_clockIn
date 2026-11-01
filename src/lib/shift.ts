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
    throw new Error(`Format jam tidak valid: ${value}`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

export function shiftDurationMinutes(
  shift: Pick<ShiftWindow, 'startTime' | 'endTime'>,
): number {
  const start = parseHhMm(shift.startTime);
  const end = parseHhMm(shift.endTime);
  return end > start ? end - start : end + 1440 - start;
}

export function crossesMidnight(startTime: string, endTime: string): boolean {
  return parseHhMm(endTime) <= parseHhMm(startTime);
}

function officeParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes, fallback: number) => {
    const value = parts.find((part) => part.type === type)?.value;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  return {
    year: read('year', date.getUTCFullYear()),
    month: read('month', date.getUTCMonth() + 1),
    day: read('day', date.getUTCDate()),
    hour: read('hour', 0),
    minute: read('minute', 0),
  };
}

export function officeDateString(date: Date, timeZone: string): string {
  const { year, month, day } = officeParts(date, timeZone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function officeMinutesOfDay(date: Date, timeZone: string): number {
  const { hour, minute } = officeParts(date, timeZone);
  return hour * 60 + minute;
}

export function addDaysToDateString(dateString: string, days: number): string {
  const [yearPart, monthPart, dayPart] = dateString.split('-');
  const date = new Date(
    Date.UTC(Number(yearPart), Number(monthPart) - 1, Number(dayPart)),
  );
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function minutesSinceShiftStart(
  at: Date,
  shift: Pick<ShiftWindow, 'startTime'>,
  timeZone: string,
): number {
  const local = officeMinutesOfDay(at, timeZone);
  const start = parseHhMm(shift.startTime);
  return (((local - start) % 1440) + 1440) % 1440;
}

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

  return localMinutes < endMinutes
    ? addDaysToDateString(localDate, -1)
    : localDate;
}

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

export function isShiftActiveNow(
  at: Date,
  shift: ShiftWindow,
  timeZone: string,
): boolean {
  const relative = minutesSinceShiftStart(at, shift, timeZone);
  return relative <= shiftDurationMinutes(shift);
}
