function fromWorkDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatTime(iso: string, timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      ...(timeZone ? { timeZone } : {}),
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatDateTime(iso: string, timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
      ...(timeZone ? { timeZone } : {}),
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatWorkDate(value: string): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(fromWorkDate(value));
  } catch {
    return value;
  }
}

export function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function monthStart(value: string): string {
  return `${value.slice(0, 7)}-01`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('id-ID').format(value);
}
