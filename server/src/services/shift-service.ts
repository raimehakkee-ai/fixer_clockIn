import { prisma } from '../db';
import { ApiError } from '../lib/errors';
import { crossesMidnight } from '../lib/time';

export type CreateShiftInput = {
  name: string;
  startTime: string;
  endTime: string;
  toleranceMinutes: number;
  earlyWindowMinutes: number;
  isActive: boolean;
  sortOrder: number;
};

export type UpdateShiftInput = Partial<CreateShiftInput>;

export async function listShifts(includeInactive: boolean) {
  return prisma.shift.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
}

export async function getShiftById(id: string) {
  const shift = await prisma.shift.findUnique({ where: { id } });
  if (!shift) {
    throw ApiError.notFound('Shift tidak ditemukan.');
  }
  return shift;
}

export async function createShift(input: CreateShiftInput) {
  const existing = await prisma.shift.findUnique({ where: { name: input.name } });
  if (existing) {
    throw ApiError.conflict('SHIFT_NAME_TAKEN', 'Nama shift sudah digunakan.');
  }

  return prisma.shift.create({
    data: {
      ...input,
      crossesMidnight: crossesMidnight(input.startTime, input.endTime),
    },
  });
}

export async function updateShift(id: string, input: UpdateShiftInput) {
  const existing = await getShiftById(id);

  if (input.name && input.name !== existing.name) {
    const duplicate = await prisma.shift.findUnique({ where: { name: input.name } });
    if (duplicate) {
      throw ApiError.conflict('SHIFT_NAME_TAKEN', 'Nama shift sudah digunakan.');
    }
  }

  const timesChanged = input.startTime !== undefined || input.endTime !== undefined;
  const startTime = input.startTime ?? existing.startTime;
  const endTime = input.endTime ?? existing.endTime;

  return prisma.shift.update({
    where: { id },
    data: {
      ...input,
      ...(timesChanged ? { crossesMidnight: crossesMidnight(startTime, endTime) } : {}),
    },
  });
}
