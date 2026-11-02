import { describe, expect, it } from 'vitest';

import {
  addDaysToDateString,
  computeLateMinutes,
  crossesMidnight,
  formatHhMm,
  isPastShiftEnd,
  isWithinClockOutWindow,
  isWithinShiftWindow,
  minutesSinceShiftStart,
  officeDateString,
  officeMinutesOfDay,
  parseHhMm,
  resolveShiftOccurrence,
  resolveWorkDate,
  shiftDurationMinutes,
  type ShiftWindow,
} from '../src/lib/time';

const TZ = 'Asia/Jakarta';

const shift1: ShiftWindow = {
  startTime: '08:00',
  endTime: '15:00',
  toleranceMinutes: 15,
  earlyWindowMinutes: 120,
};

const shift3: ShiftWindow = {
  startTime: '22:00',
  endTime: '08:00',
  toleranceMinutes: 15,
  earlyWindowMinutes: 120,
};

// 2026-11-01T01:10:00Z = 08:10 waktu Jakarta
const at = (iso: string) => new Date(iso);

describe('parseHhMm / formatHhMm', () => {
  it('mengubah HH:mm menjadi menit', () => {
    expect(parseHhMm('08:00')).toBe(480);
    expect(parseHhMm('15:30')).toBe(930);
    expect(parseHhMm('00:00')).toBe(0);
  });

  it('menolak format yang tidak valid', () => {
    expect(() => parseHhMm('8:00')).toThrow();
    expect(() => parseHhMm('24:00')).toThrow();
    expect(() => parseHhMm('08:60')).toThrow();
  });

  it('memformat menit kembali ke HH:mm', () => {
    expect(formatHhMm(480)).toBe('08:00');
    expect(formatHhMm(1440)).toBe('00:00');
    expect(formatHhMm(-60)).toBe('23:00');
  });
});

describe('crossesMidnight / shiftDurationMinutes', () => {
  it('mendeteksi shift malam', () => {
    expect(crossesMidnight('22:00', '08:00')).toBe(true);
    expect(crossesMidnight('08:00', '15:00')).toBe(false);
    expect(crossesMidnight('15:00', '15:00')).toBe(true);
  });

  it('menghitung durasi shift termasuk lintas tengah malam', () => {
    expect(shiftDurationMinutes(shift1)).toBe(420);
    expect(shiftDurationMinutes(shift3)).toBe(600);
  });
});

describe('zona waktu kantor', () => {
  it('menghitung tanggal kantor melewati batas hari UTC', () => {
    expect(officeDateString(at('2026-10-31T17:30:00Z'), TZ)).toBe('2026-11-01');
    expect(officeMinutesOfDay(at('2026-10-31T17:30:00Z'), TZ)).toBe(30);
  });

  it('menambah/mengurangi hari pada string tanggal', () => {
    expect(addDaysToDateString('2026-11-01', -1)).toBe('2026-10-31');
    expect(addDaysToDateString('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToDateString('2026-02-28', 1)).toBe('2026-03-01');
  });
});

describe('resolveWorkDate pada shift malam', () => {
  it('Clock-In pukul 22:30 memakai tanggal hari itu', () => {
    expect(resolveWorkDate(at('2026-11-01T15:30:00Z'), shift3, TZ)).toBe('2026-11-01');
  });

  it('Clock-In pukul 02:00 tanggal berikutnya tetap milik tanggal mulai shift', () => {
    expect(resolveWorkDate(at('2026-11-01T19:00:00Z'), shift3, TZ)).toBe('2026-11-01');
  });

  it('shift pagi tidak menggeser tanggal', () => {
    expect(resolveWorkDate(at('2026-11-02T01:00:00Z'), shift1, TZ)).toBe('2026-11-02');
  });

  it('Clock-Out tepat pukul 08:00 tetap milik tanggal mulai shift malam', () => {
    expect(resolveWorkDate(at('2026-11-02T01:00:00Z'), shift3, TZ)).toBe('2026-11-01');
  });

  it('Clock-In sebelum tengah malam untuk shift yang mulai setelah 00:00 memakai tanggal shift berikutnya', () => {
    const earlyMorningShift: ShiftWindow = {
      startTime: '01:00',
      endTime: '09:00',
      toleranceMinutes: 15,
      earlyWindowMinutes: 120,
    };

    expect(
      resolveWorkDate(at('2026-11-01T16:30:00Z'), earlyMorningShift, TZ),
    ).toBe('2026-11-02');
  });

  it('shift lintas hari yang mulai setelah tengah malam juga memakai tanggal mulai yang benar', () => {
    const lateMorningShift: ShiftWindow = {
      startTime: '00:30',
      endTime: '08:30',
      toleranceMinutes: 15,
      earlyWindowMinutes: 120,
    };

    expect(
      resolveWorkDate(at('2026-11-01T16:30:00Z'), lateMorningShift, TZ),
    ).toBe('2026-11-02');
  });
});

describe('minutesSinceShiftStart', () => {
  it('menormalkan selisih ke 0..1439', () => {
    expect(minutesSinceShiftStart(at('2026-11-01T02:00:00Z'), shift1, TZ)).toBe(60);
    expect(minutesSinceShiftStart(at('2026-11-01T19:00:00Z'), shift3, TZ)).toBe(240);
  });
});

describe('isWithinShiftWindow', () => {
  it('menerima Clock-In tepat 120 menit sebelum shift', () => {
    expect(isWithinShiftWindow(at('2026-10-31T23:00:00Z'), shift1, TZ)).toBe(true);
  });

  it('menolak Clock-In lebih dari 120 menit sebelum shift', () => {
    expect(isWithinShiftWindow(at('2026-10-31T22:59:00Z'), shift1, TZ)).toBe(false);
  });

  it('menerima Clock-In sampai akhir shift', () => {
    expect(isWithinShiftWindow(at('2026-11-01T08:00:00Z'), shift1, TZ)).toBe(true);
  });

  it('menolak Clock-In setelah shift berakhir', () => {
    expect(isWithinShiftWindow(at('2026-11-01T08:01:00Z'), shift1, TZ)).toBe(false);
  });

  it('menangani jendela shift malam', () => {
    expect(isWithinShiftWindow(at('2026-11-01T14:00:00Z'), shift3, TZ)).toBe(true);
    expect(isWithinShiftWindow(at('2026-11-01T12:59:00Z'), shift3, TZ)).toBe(false);
    expect(isWithinShiftWindow(at('2026-11-01T19:00:00Z'), shift3, TZ)).toBe(true);
    expect(isWithinShiftWindow(at('2026-11-02T01:30:00Z'), shift3, TZ)).toBe(false);
  });
});

describe('isWithinClockOutWindow', () => {
  it('mengizinkan Clock-Out setelah shift berakhir selama grace period', () => {
    // Shift 08:00–15:00. 15:01 dan 19:00 masih dalam grace 240 menit.
    expect(isWithinClockOutWindow(at('2026-11-01T08:01:00Z'), shift1, TZ, 240)).toBe(true);
    expect(isWithinClockOutWindow(at('2026-11-01T12:00:00Z'), shift1, TZ, 240)).toBe(true);
  });

  it('menolak Clock-Out setelah grace period habis', () => {
    expect(isWithinClockOutWindow(at('2026-11-01T12:01:00Z'), shift1, TZ, 240)).toBe(false);
  });

  it('menolak Clock-Out setelah shift berakhir bila grace 0', () => {
    expect(isWithinClockOutWindow(at('2026-11-01T08:01:00Z'), shift1, TZ, 0)).toBe(false);
  });

  it('mengizinkan Clock-Out shift malam tepat pada jam selesai', () => {
    expect(isWithinClockOutWindow(at('2026-11-02T01:00:00Z'), shift3, TZ, 240)).toBe(true);
  });

  it('tetap menolak Clock-In setelah shift berakhir', () => {
    expect(isWithinShiftWindow(at('2026-11-01T08:01:00Z'), shift1, TZ)).toBe(false);
  });
});

describe('isPastShiftEnd', () => {
  it('belum melewati batas pada akhir grace period', () => {
    // Shift 08:00–15:00, grace 240 -> batas 19:00 waktu Jakarta.
    expect(
      isPastShiftEnd(at('2026-11-01T12:00:00Z'), '2026-11-01', shift1, TZ, 240),
    ).toBe(false);
  });

  it('melewati batas satu menit setelah grace period', () => {
    expect(
      isPastShiftEnd(at('2026-11-01T12:01:00Z'), '2026-11-01', shift1, TZ, 240),
    ).toBe(true);
  });

  it('menghitung shift malam sampai hari berikutnya', () => {
    // Shift 22:00–08:00 + grace 240 -> batas 12:00 tanggal berikutnya.
    expect(
      isPastShiftEnd(at('2026-11-02T05:00:00Z'), '2026-11-01', shift3, TZ, 240),
    ).toBe(false);
    expect(
      isPastShiftEnd(at('2026-11-02T05:01:00Z'), '2026-11-01', shift3, TZ, 240),
    ).toBe(true);
  });
});

describe('resolveShiftOccurrence', () => {
  it('memilih kemunculan shift yang paling dekat', () => {
    const occurrence = resolveShiftOccurrence(
      at('2026-11-01T00:30:00Z'),
      shift1,
      TZ,
    );

    expect(occurrence?.workDate).toBe('2026-11-01');
    expect(occurrence?.relativeMinutes).toBe(-30);
  });

  it('menghitung menit relatif setelah shift berakhir', () => {
    const occurrence = resolveShiftOccurrence(
      at('2026-11-01T08:30:00Z'),
      shift1,
      TZ,
      { graceMinutes: 240 },
    );

    expect(occurrence?.workDate).toBe('2026-11-01');
    expect(occurrence?.relativeMinutes).toBe(450);
  });
});

describe('computeLateMinutes', () => {
  it('tidak menghitung terlambat dalam toleransi 15 menit', () => {
    expect(computeLateMinutes(at('2026-11-01T01:10:00Z'), shift1, TZ)).toBe(0);
    expect(computeLateMinutes(at('2026-11-01T01:15:00Z'), shift1, TZ)).toBe(0);
  });

  it('menghitung keterlambatan setelah toleransi', () => {
    expect(computeLateMinutes(at('2026-11-01T01:30:00Z'), shift1, TZ)).toBe(15);
    expect(computeLateMinutes(at('2026-11-01T02:00:00Z'), shift1, TZ)).toBe(45);
  });

  it('Clock-In lebih awal selalu 0', () => {
    expect(computeLateMinutes(at('2026-11-01T00:30:00Z'), shift1, TZ)).toBe(0);
  });

  it('menghitung keterlambatan shift malam setelah tengah malam', () => {
    expect(computeLateMinutes(at('2026-11-01T19:00:00Z'), shift3, TZ)).toBe(225);
  });
});
