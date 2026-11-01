import { prisma } from '../db';
import { ApiError } from '../lib/errors';

async function requireEmployee(userId: string) {
  const employee = await prisma.employee.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!employee) {
    throw ApiError.notFound('Akun ini tidak memiliki data karyawan.');
  }

  return employee;
}

export async function listMyDevices(userId: string) {
  const employee = await requireEmployee(userId);

  return prisma.device.findMany({
    where: { employeeId: employee.id },
    orderBy: { registeredAt: 'desc' },
  });
}

export async function revokeMyDevice(userId: string, deviceId: string) {
  const employee = await requireEmployee(userId);

  const device = await prisma.device.findFirst({
    where: { id: deviceId, employeeId: employee.id },
  });

  if (!device) {
    throw ApiError.notFound('Perangkat tidak ditemukan.');
  }

  const [updated] = await prisma.$transaction([
    prisma.device.update({
      where: { id: device.id },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        revokedById: userId,
      },
    }),
    prisma.session.updateMany({
      where: { deviceId: device.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  return updated;
}
