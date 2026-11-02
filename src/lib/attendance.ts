export type AttendanceRecordLike = {
  shift: { id: string };
  workDate: string;
};

/**
 * Memilih record absensi untuk shift dan tanggal kerja tertentu.
 * workDate wajib ikut dicocokkan agar record kemarin tidak dianggap
 * sebagai absensi hari ini.
 */
export function findAttendanceRecord<T extends AttendanceRecordLike>(
  records: readonly T[],
  shiftId: string | null,
  workDate: string | null,
): T | null {
  if (!shiftId || !workDate) {
    return null;
  }

  return (
    records.find(
      (record) =>
        record.shift.id === shiftId && record.workDate === workDate,
    ) ?? null
  );
}
