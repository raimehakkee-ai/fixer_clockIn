import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock('../src/db', () => ({
  prisma: {
    attendanceRecord: {
      findMany: mocks.findMany,
      updateMany: mocks.updateMany,
    },
  },
}));

import {
  finalizeOpenAttendance,
  runAttendanceFinalizer,
} from '../src/services/attendance-finalize-service';

const TZ = 'Asia/Jakarta';
/** 20:00 WIB — shift 08:00-15:00 + grace 240 sudah lewat (batas 19:00). */
const NOW = new Date('2026-11-10T13:00:00Z');

type FakeRecord = {
  id: string;
  workDate: Date;
  shift: { startTime: string; endTime: string };
  officeLocation: { timezone: string };
};

function record(id: string, workDate = '2026-11-10'): FakeRecord {
  return {
    id,
    workDate: new Date(`${workDate}T00:00:00.000Z`),
    shift: { startTime: '08:00', endTime: '15:00' },
    officeLocation: { timezone: TZ },
  };
}

function batch(prefix: string, size: number): FakeRecord[] {
  return Array.from({ length: size }, (_, index) =>
    record(`${prefix}-${index}`),
  );
}

beforeEach(() => {
  mocks.findMany.mockReset();
  mocks.updateMany.mockReset();
});

describe('finalizeOpenAttendance', () => {
  it('memproses beberapa batch sampai tidak ada record tersisa', async () => {
    mocks.findMany
      .mockResolvedValueOnce(batch('a', 1_000))
      .mockResolvedValueOnce(batch('b', 1_000))
      .mockResolvedValueOnce([]);
    mocks.updateMany.mockResolvedValue({ count: 1_000 });

    await expect(finalizeOpenAttendance(NOW)).resolves.toBe(2_000);
    expect(mocks.findMany).toHaveBeenCalledTimes(3);
    expect(mocks.updateMany).toHaveBeenCalledTimes(2);
  });

  it('berhenti tanpa update bila batch tertua belum jatuh tempo', async () => {
    mocks.findMany.mockResolvedValueOnce([record('belum-jatuh-tempo')]);

    // 18:00 WIB — batas shift + grace baru pukul 19:00.
    const beforeShiftEnd = new Date('2026-11-10T11:00:00Z');

    await expect(finalizeOpenAttendance(beforeShiftEnd)).resolves.toBe(0);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it('hanya menandai record yang sudah melewati shift + grace', async () => {
    mocks.findMany.mockResolvedValueOnce([
      record('jatuh-tempo'),
      record('belum-jatuh-tempo', '2026-11-11'),
    ]);
    mocks.updateMany.mockResolvedValue({ count: 1 });

    await expect(finalizeOpenAttendance(NOW)).resolves.toBe(1);
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['jatuh-tempo'] }, clockOutAt: null },
      data: { status: 'INCOMPLETE' },
    });
  });
});

describe('runAttendanceFinalizer', () => {
  it('melewati putaran baru saat putaran sebelumnya masih berjalan', async () => {
    let release: (rows: FakeRecord[]) => void = () => undefined;

    mocks.findMany.mockImplementationOnce(
      () =>
        new Promise<FakeRecord[]>((resolve) => {
          release = resolve;
        }),
    );

    const firstRun = runAttendanceFinalizer(NOW);
    const skippedRun = await runAttendanceFinalizer(NOW);

    expect(skippedRun).toBeNull();
    expect(mocks.findMany).toHaveBeenCalledTimes(1);

    release([]);
    await expect(firstRun).resolves.toBe(0);
  });
});
