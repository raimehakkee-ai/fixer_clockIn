import { prisma } from '../db';
import { ApiError } from '../lib/errors';
import { skipFor } from '../lib/pagination';
import { hashPassword } from '../lib/password';
import type { Prisma } from '../generated/prisma/client';

const employeeInclude = {
  user: true,
  officeLocation: true,
  devices: { orderBy: { registeredAt: 'desc' } },
} satisfies Prisma.EmployeeInclude;

export type ListEmployeesInput = {
  q?: string;
  page: number;
  limit: number;
  includeInactive: boolean;
};

export type CreateEmployeeInput = {
  email: string;
  password: string;
  employeeNumber: string;
  fullName: string;
  department?: string | null;
  position?: string | null;
  officeLocationId?: string | null;
};

export type UpdateEmployeeInput = {
  fullName?: string;
  department?: string | null;
  position?: string | null;
  officeLocationId?: string | null;
};

async function assertOfficeExists(officeLocationId: string): Promise<void> {
  const office = await prisma.officeLocation.findUnique({
    where: { id: officeLocationId },
    select: { id: true },
  });

  if (!office) {
    throw ApiError.badRequest('officeLocationId tidak ditemukan.');
  }
}

export async function listEmployees(input: ListEmployeesInput) {
  const where: Prisma.EmployeeWhereInput = {};

  if (!input.includeInactive) {
    where.isActive = true;
  }

  if (input.q) {
    where.OR = [
      { fullName: { contains: input.q, mode: 'insensitive' } },
      { employeeNumber: { contains: input.q, mode: 'insensitive' } },
      { user: { email: { contains: input.q, mode: 'insensitive' } } },
    ];
  }

  const [rows, total] = await prisma.$transaction([
    prisma.employee.findMany({
      where,
      include: employeeInclude,
      orderBy: { createdAt: 'desc' },
      skip: skipFor(input),
      take: input.limit,
    }),
    prisma.employee.count({ where }),
  ]);

  return { rows, total };
}

export async function getEmployeeById(id: string) {
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: employeeInclude,
  });

  if (!employee) {
    throw ApiError.notFound('Karyawan tidak ditemukan.');
  }

  return employee;
}

export async function getEmployeeByUserId(userId: string) {
  const employee = await prisma.employee.findUnique({
    where: { userId },
    include: employeeInclude,
  });

  if (!employee) {
    throw ApiError.notFound('Akun ini tidak memiliki data karyawan.');
  }

  return employee;
}

export async function createEmployee(input: CreateEmployeeInput) {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (existingUser) {
    throw ApiError.conflict('EMAIL_TAKEN', 'Email sudah digunakan.');
  }

  const existingNumber = await prisma.employee.findUnique({
    where: { employeeNumber: input.employeeNumber },
    select: { id: true },
  });
  if (existingNumber) {
    throw ApiError.conflict('EMPLOYEE_NUMBER_TAKEN', 'Nomor karyawan sudah digunakan.');
  }

  if (input.officeLocationId) {
    await assertOfficeExists(input.officeLocationId);
  }

  const passwordHash = await hashPassword(input.password);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: input.email,
        passwordHash,
        role: 'EMPLOYEE',
      },
    });

    return tx.employee.create({
      data: {
        userId: user.id,
        employeeNumber: input.employeeNumber,
        fullName: input.fullName,
        department: input.department ?? null,
        position: input.position ?? null,
        officeLocationId: input.officeLocationId ?? null,
      },
      include: employeeInclude,
    });
  });
}

export async function updateEmployee(id: string, input: UpdateEmployeeInput) {
  await getEmployeeById(id);

  if (input.officeLocationId) {
    await assertOfficeExists(input.officeLocationId);
  }

  const data: Prisma.EmployeeUpdateInput = {};

  if (input.fullName !== undefined) data.fullName = input.fullName;
  if (input.department !== undefined) data.department = input.department;
  if (input.position !== undefined) data.position = input.position;
  if (input.officeLocationId !== undefined) {
    data.officeLocation = input.officeLocationId
      ? { connect: { id: input.officeLocationId } }
      : { disconnect: true };
  }

  return prisma.employee.update({
    where: { id },
    data,
    include: employeeInclude,
  });
}

export async function setEmployeeStatus(id: string, isActive: boolean) {
  const employee = await getEmployeeById(id);

  return prisma.$transaction(async (tx) => {
    await tx.employee.update({ where: { id }, data: { isActive } });
    await tx.user.update({ where: { id: employee.userId }, data: { isActive } });

    if (!isActive) {
      await tx.session.updateMany({
        where: { userId: employee.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return tx.employee.findUniqueOrThrow({
      where: { id },
      include: employeeInclude,
    });
  });
}

export async function resetEmployeePassword(id: string, newPassword: string) {
  const employee = await getEmployeeById(id);
  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: employee.userId },
      data: { passwordHash },
    }),
    prisma.session.updateMany({
      where: { userId: employee.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}

export async function resetEmployeeDevice(id: string, actorUserId: string) {
  const employee = await getEmployeeById(id);

  const [revoked] = await prisma.$transaction([
    prisma.device.updateMany({
      where: { employeeId: employee.id, status: 'ACTIVE' },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        revokedById: actorUserId,
      },
    }),
    prisma.session.updateMany({
      where: { userId: employee.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  return revoked.count;
}
