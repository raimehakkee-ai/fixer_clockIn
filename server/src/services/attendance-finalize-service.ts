import { prisma } from '../db';
import { env } from '../env';
import { isPastShiftEnd } from '../lib/time';

const BATCH_SIZE = 1_000;

/**
 * Menandai record yang sudah melewati jam selesai shift + grace period
 * tetapi belum Clock-Out sebagai INCOMPLETE.
 *
 * Clock-Out tetap dapat mengubah status kembali menjadi PRESENT/LATE
 * berdasarkan lateMinutes.
 */
export async function finalizeOpenAttendance(now = new Date()): Promise<number> {
  const rows = await prisma.attendanceRecord.findMany({
    where: {
      clockOutAt: null,
      status: { in: ['PRESENT', 'LATE'] },
    },
    include: { shift: true, officeLocation: true },
    orderBy: { clockInAt: 'asc' },
    take: BATCH_SIZE,
  });

  const dueIds: string[] = [];

  for (const record of rows) {
    const workDate = record.workDate.toISOString().slice(0, 10);

    if (
      isPastShiftEnd(
        now,
        workDate,
        record.shift,
        record.officeLocation.timezone,
        env.CLOCK_OUT_GRACE_MINUTES,
      )
    ) {
      dueIds.push(record.id);
    }
  }

  if (dueIds.length === 0) {
    return 0;
  }

  const updated = await prisma.attendanceRecord.updateMany({
    where: {
      id: { in: dueIds },
      clockOutAt: null,
    },
    data: { status: 'INCOMPLETE' },
  });

  return updated.count;
}
