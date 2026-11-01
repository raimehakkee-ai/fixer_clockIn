export type SummaryRecordStatus = 'PRESENT' | 'LATE' | 'INCOMPLETE';

export type SummaryRecord = {
  employeeId: string;
  status: SummaryRecordStatus;
};

export type AttendanceSummary = {
  present: number;
  late: number;
  onLeave: number;
  absent: number;
  attendanceRecords: number;
};

/**
 * Menghitung ringkasan harian yang saling eksklusif:
 * karyawan terlambat tidak dihitung dua kali sebagai hadir, dan karyawan
 * yang sudah absen tidak dihitung sebagai izin.
 */
export function summarizeAttendance(params: {
  totalEmployees: number;
  records: SummaryRecord[];
  approvedLeaveEmployeeIds: string[];
}): AttendanceSummary {
  const late = new Set<string>();
  const present = new Set<string>();

  for (const record of params.records) {
    if (record.status === 'LATE') {
      late.add(record.employeeId);
    } else if (record.status === 'PRESENT') {
      present.add(record.employeeId);
    }
  }

  for (const employeeId of late) {
    present.delete(employeeId);
  }

  const attended = new Set([...present, ...late]);

  const onLeave = new Set(
    params.approvedLeaveEmployeeIds.filter(
      (employeeId) => !attended.has(employeeId),
    ),
  );

  const accounted = new Set([...attended, ...onLeave]);

  return {
    present: present.size,
    late: late.size,
    onLeave: onLeave.size,
    absent: Math.max(0, params.totalEmployees - accounted.size),
    attendanceRecords: params.records.length,
  };
}
