function dateFromWorkDate(workDate: string): Date {
  return new Date(`${workDate}T00:00:00.000Z`);
}

export function formatTime(iso: string, timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      ...(timeZone ? { timeZone } : {}),
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toISOString().slice(11, 16);
  }
}

export function formatDateTime(iso: string, timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      ...(timeZone ? { timeZone } : {}),
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatWorkDate(workDate: string): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(dateFromWorkDate(workDate));
  } catch {
    return workDate;
  }
}

export function formatMonth(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function monthRange(monthDate: Date): { from: string; to: string } {
  const year = monthDate.getUTCFullYear();
  const month = monthDate.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));

  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

export function shiftLabel(shift: { startTime: string; endTime: string }): string {
  return `${shift.startTime}–${shift.endTime}`;
}
