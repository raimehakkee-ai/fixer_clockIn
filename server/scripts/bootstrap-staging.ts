import { prisma } from '../src/db';
import { crossesMidnight } from '../src/lib/time';

const DEFAULT_OFFICE = {
  name: 'Ayam Geprek JnQ Tamamaung (Pettarani 8 No.29)',
  latitude: -5.1419048,
  longitude: 119.4452768,
  radiusMeters: 100,
  timezone: 'Asia/Makassar',
};

const SHIFTS = [
  { name: 'Shift 1', startTime: '08:00', endTime: '15:00', sortOrder: 1 },
  { name: 'Shift 2', startTime: '15:00', endTime: '22:00', sortOrder: 2 },
  { name: 'Shift 3', startTime: '22:00', endTime: '08:00', sortOrder: 3 },
];

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function main(): Promise<void> {
  const officeData = {
    name: process.env.STAGING_OFFICE_NAME ?? DEFAULT_OFFICE.name,
    latitude: envNumber('STAGING_OFFICE_LATITUDE', DEFAULT_OFFICE.latitude),
    longitude: envNumber('STAGING_OFFICE_LONGITUDE', DEFAULT_OFFICE.longitude),
    radiusMeters: envNumber(
      'STAGING_OFFICE_RADIUS_METERS',
      DEFAULT_OFFICE.radiusMeters,
    ),
    timezone: process.env.STAGING_OFFICE_TIMEZONE ?? DEFAULT_OFFICE.timezone,
    isActive: true,
  };

  const existingOffice = await prisma.officeLocation.findFirst({
    orderBy: { createdAt: 'asc' },
  });

  const office = existingOffice
    ? await prisma.officeLocation.update({
        where: { id: existingOffice.id },
        data: officeData,
      })
    : await prisma.officeLocation.create({ data: officeData });

  await prisma.officeLocation.updateMany({
    where: { isActive: true, NOT: { id: office.id } },
    data: { isActive: false },
  });

  for (const shift of SHIFTS) {
    const data = {
      startTime: shift.startTime,
      endTime: shift.endTime,
      crossesMidnight: crossesMidnight(shift.startTime, shift.endTime),
      toleranceMinutes: 15,
      earlyWindowMinutes: 120,
      isActive: true,
      sortOrder: shift.sortOrder,
    };

    await prisma.shift.upsert({
      where: { name: shift.name },
      update: data,
      create: { name: shift.name, ...data },
    });
  }

  console.log('Bootstrap staging selesai (tanpa akun demo).');
  console.log(
    `Kantor: ${office.name} (${Number(office.latitude)}, ${Number(office.longitude)}) ` +
      `radius ${office.radiusMeters} m, ${office.timezone}`,
  );
  console.log(`Shift : ${SHIFTS.map((shift) => shift.name).join(', ')}`);
}

main()
  .catch((error) => {
    console.error('Bootstrap staging gagal:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
