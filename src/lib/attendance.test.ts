import { describe, expect, it } from 'vitest';

import { findAttendanceRecord } from './attendance';
import {
  isWithinClockOutWindow,
  isWithinShiftWindow,
  resolveClockOutWorkDate,
  resolveWorkDate,
  type ShiftWindow,
} from './shift';

const TZ = 'Asia/Jakarta';

const morning: ShiftWindow = {
  startTime: '08:00',
  endTime: '15:00',
  toleranceMinutes: 15,
  earlyWindowMinutes: 120,
};

const night: ShiftWindow = {
  startTime: '22:00',
  endTime: '08:00',
  toleranceMinutes: 15,
  earlyWindowMinutes: 120,
};

const at = (iso: string) => new Date(iso);

type RecordLike = {
  id: string;
  shift: { id: string };
  workDate: string;
  clockOutAt: string | null;
};

describe('findAttendanceRecord', () => {
  const records: RecordLike[] = [
    { id: 'yesterday', shift: { id: 'shift-1' }, workDate: '2026-11-02', clockOutAt: '2026-11-02T08:00:00Z' },
    { id: 'today', shift: { id: 'shift-1' }, workDate: '2026-11-03', clockOutAt: null },
    { id: 'other-shift', shift: { id: 'shift-2' }, workDate: '2026-11-03', clockOutAt: null },
  ];

  it('memilih record hari ini, bukan record shift yang sama kemarin', () => {
    expect(findAttendanceRecord(records, 'shift-1', '2026-11-03')?.id).toBe('today');
  });

  it('tidak memakai record kemarin ketika belum ada absensi hari ini', () => {
    expect(findAttendanceRecord(records, 'shift-1', '2026-11-04')).toBeNull();
  });

  it('membedakan shift pada tanggal yang sama', () => {
    expect(findAttendanceRecord(records, 'shift-2', '2026-11-03')?.id).toBe('other-shift');
  });

  it('mengembalikan null bila shift atau tanggal belum diketahui', () => {
    expect(findAttendanceRecord(records, null, '2026-11-03')).toBeNull();
    expect(findAttendanceRecord(records, 'shift-1', null)).toBeNull();
  });
});

describe('resolusi tanggal kerja mobile', () => {
  it('Clock-Out tepat pukul 08:00 tetap memakai tanggal mulai shift malam', () => {
    expect(
      resolveClockOutWorkDate(at('2026-11-02T01:00:00Z'), night, TZ, 240),
    ).toBe('2026-11-01');
  });

  it('Clock-In sebelum tengah malam untuk shift 01:00 memakai tanggal berikutnya', () => {
    const earlyMorning: ShiftWindow = {
      startTime: '01:00',
      endTime: '09:00',
      toleranceMinutes: 15,
      earlyWindowMinutes: 120,
    };

    expect(resolveWorkDate(at('2026-11-01T16:30:00Z'), earlyMorning, TZ)).toBe(
      '2026-11-02',
    );
  });

  it('mengizinkan Clock-Out setelah shift berakhir selama grace period', () => {
    expect(
      isWithinClockOutWindow(at('2026-11-01T08:01:00Z'), morning, TZ, 240),
    ).toBe(true);
    expect(
      isWithinClockOutWindow(at('2026-11-01T12:00:00Z'), morning, TZ, 240),
    ).toBe(true);
    expect(
      isWithinClockOutWindow(at('2026-11-01T12:01:00Z'), morning, TZ, 240),
    ).toBe(false);
  });

  it('tetap menolak Clock-In setelah shift berakhir', () => {
    expect(isWithinShiftWindow(at('2026-11-01T08:01:00Z'), morning, TZ)).toBe(
      false,
    );
  });

  it('menerima Clock-Out shift malam tepat pada jam selesai', () => {
    expect(
      isWithinClockOutWindow(at('2026-11-02T01:00:00Z'), night, TZ, 240),
    ).toBe(true);
  });
});
