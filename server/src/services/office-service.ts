import { prisma } from '../db';
import { ApiError } from '../lib/errors';

export type CreateOfficeInput = {
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  timezone: string;
  isActive: boolean;
};

export type UpdateOfficeInput = Partial<CreateOfficeInput>;

export async function listOffices() {
  return prisma.officeLocation.findMany({ orderBy: { createdAt: 'asc' } });
}

export async function getOfficeById(id: string) {
  const office = await prisma.officeLocation.findUnique({ where: { id } });
  if (!office) {
    throw ApiError.notFound('Lokasi kantor tidak ditemukan.');
  }
  return office;
}

export async function createOffice(input: CreateOfficeInput) {
  return prisma.$transaction(async (tx) => {
    if (input.isActive) {
      await tx.officeLocation.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
    }

    return tx.officeLocation.create({ data: input });
  });
}

export async function updateOffice(id: string, input: UpdateOfficeInput) {
  await getOfficeById(id);

  return prisma.$transaction(async (tx) => {
    if (input.isActive === true) {
      await tx.officeLocation.updateMany({
        where: { isActive: true, NOT: { id } },
        data: { isActive: false },
      });
    }

    return tx.officeLocation.update({ where: { id }, data: input });
  });
}

export async function activateOffice(id: string) {
  await getOfficeById(id);

  return prisma.$transaction(async (tx) => {
    await tx.officeLocation.updateMany({
      where: { isActive: true, NOT: { id } },
      data: { isActive: false },
    });

    return tx.officeLocation.update({ where: { id }, data: { isActive: true } });
  });
}
