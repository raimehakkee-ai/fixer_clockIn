import { describe, expect, it } from 'vitest';

import { summarizeAttendance } from '../src/lib/report';

describe('summarizeAttendance', () => {
  it('menghitung absen saat tidak ada data', () => {
    const summary = summarizeAttendance({
      totalEmployees: 5,
      records: [],
      approvedLeaveEmployeeIds: [],
    });

    expect(summary).toEqual({
      present: 0,
      late: 0,
      onLeave: 0,
      absent: 5,
      attendanceRecords: 0,
    });
  });

  it('menghitung karyawan unik meski punya beberapa shift', () => {
    const summary = summarizeAttendance({
      totalEmployees: 3,
      records: [
        { employeeId: 'a', status: 'PRESENT' },
        { employeeId: 'a', status: 'PRESENT' },
        { employeeId: 'b', status: 'PRESENT' },
      ],
      approvedLeaveEmployeeIds: [],
    });

    expect(summary.present).toBe(2);
    expect(summary.attendanceRecords).toBe(3);
    expect(summary.absent).toBe(1);
  });

  it('terlambat tidak dihitung dua kali sebagai hadir', () => {
    const summary = summarizeAttendance({
      totalEmployees: 2,
      records: [
        { employeeId: 'a', status: 'PRESENT' },
        { employeeId: 'a', status: 'LATE' },
        { employeeId: 'b', status: 'PRESENT' },
      ],
      approvedLeaveEmployeeIds: [],
    });

    expect(summary.late).toBe(1);
    expect(summary.present).toBe(1);
    expect(summary.absent).toBe(0);
  });

  it('karyawan yang hadir tidak dihitung sebagai izin', () => {
    const summary = summarizeAttendance({
      totalEmployees: 3,
      records: [{ employeeId: 'a', status: 'PRESENT' }],
      approvedLeaveEmployeeIds: ['a', 'b'],
    });

    expect(summary.present).toBe(1);
    expect(summary.onLeave).toBe(1);
    expect(summary.absent).toBe(1);
  });

  it('status INCOMPLETE tidak dihitung hadir', () => {
    const summary = summarizeAttendance({
      totalEmployees: 2,
      records: [{ employeeId: 'a', status: 'INCOMPLETE' }],
      approvedLeaveEmployeeIds: [],
    });

    expect(summary.present).toBe(0);
    expect(summary.late).toBe(0);
    expect(summary.absent).toBe(2);
    expect(summary.attendanceRecords).toBe(1);
  });

  it('absen tidak pernah negatif', () => {
    const summary = summarizeAttendance({
      totalEmployees: 1,
      records: [
        { employeeId: 'a', status: 'PRESENT' },
        { employeeId: 'b', status: 'PRESENT' },
      ],
      approvedLeaveEmployeeIds: [],
    });

    expect(summary.absent).toBe(0);
  });
});
