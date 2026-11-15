import { prisma } from '../db';
import { env } from '../env';
import { isPastShiftEnd } from '../lib/time';

const BATCH_SIZE = 1_000;
/** Batas batch per putaran agar satu eksekusi tidak berjalan tanpa henti. */
const MAX_BATCHES_PER_RUN = 20;
const FINALIZE_INTERVAL_MS = 60_000;

let isRunning = false;

/**
 * Menandai record yang sudah melewati jam selesai shift + grace period
 * tetapi belum Clock-Out sebagai INCOMPLETE.
 *
 * Clock-Out tetap dapat mengubah status kembali menjadi PRESENT/LATE
 * berdasarkan lateMinutes.
 *
 * Record diproses per batch (1.000 baris) sampai tidak ada lagi yang jatuh
 * tempo, sehingga penumpukan lebih dari satu batch tetap tertangani.
 */
export async function finalizeOpenAttendance(now = new Date()): Promise<number> {
  let total = 0;

  for (let batch = 0; batch < MAX_BATCHES_PER_RUN; batch += 1) {
    const rows = await prisma.attendanceRecord.findMany({
      where: {
        clockOutAt: null,
        status: { in: ['PRESENT', 'LATE'] },
      },
      include: { shift: true, officeLocation: true },
      orderBy: { clockInAt: 'asc' },
      take: BATCH_SIZE,
    });

    if (rows.length === 0) {
      break;
    }

    const dueIds = rows
      .filter((record) =>
        isPastShiftEnd(
          now,
          record.workDate.toISOString().slice(0, 10),
          record.shift,
          record.officeLocation.timezone,
          env.CLOCK_OUT_GRACE_MINUTES,
        ),
      )
      .map((record) => record.id);

    // Batch diurutkan dari Clock-In paling lama; bila batch tertua tidak ada
    // yang jatuh tempo, batch berikutnya juga belum jatuh tempo.
    if (dueIds.length === 0) {
      break;
    }

    const updated = await prisma.attendanceRecord.updateMany({
      where: {
        id: { in: dueIds },
        clockOutAt: null,
      },
      data: { status: 'INCOMPLETE' },
    });

    total += updated.count;

    if (rows.length < BATCH_SIZE) {
      break;
    }
  }

  return total;
}

/**
 * Satu putaran finalisasi dengan penjaga tumpang tindih. Mengembalikan `null`
 * bila putaran sebelumnya belum selesai (dijadwalkan ulang pada tick berikut).
 */
export async function runAttendanceFinalizer(
  now = new Date(),
): Promise<number | null> {
  if (isRunning) {
    return null;
  }

  isRunning = true;

  try {
    return await finalizeOpenAttendance(now);
  } finally {
    isRunning = false;
  }
}

/**
 * Menjalankan finalizer saat startup lalu setiap `intervalMs`. Timer tidak
 * menahan proses tetap hidup (unref).
 */
export function startAttendanceFinalizer(
  intervalMs = FINALIZE_INTERVAL_MS,
): NodeJS.Timeout {
  const run = (): void => {
    void runAttendanceFinalizer().catch((error) => {
      console.error('[attendance] gagal finalisasi record terbuka', error);
    });
  };

  run();
  const timer = setInterval(run, intervalMs);
  timer.unref();

  return timer;
}
