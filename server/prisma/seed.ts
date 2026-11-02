import { prisma } from '../src/db';
import { hashPassword } from '../src/lib/password';
import { crossesMidnight } from '../src/lib/time';

if (
  process.env.NODE_ENV !== 'development' &&
  process.env.ALLOW_DEMO_SEED !== 'true'
) {
  console.error(
    'Seed demo hanya boleh dijalankan pada NODE_ENV=development ' +
      'atau dengan ALLOW_DEMO_SEED=true. Untuk staging/produksi gunakan ' +
      '`npm run staging:bootstrap` dan `npm run admin:create`.',
  );
  process.exit(1);
}

const ADMIN_EMAIL = 'admin@clockin.test';
const ADMIN_PASSWORD = 'Admin123!';
const EMPLOYEE_PASSWORD = 'Employee123!';

type Role = 'EMPLOYEE' | 'ADMIN';

async function ensureUser(email: string, password: string, role: Role) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return existing;
  }

  return prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      role,
    },
  });
}

async function main(): Promise<void> {
  const officeName = 'Ayam Geprek JnQ Tamamaung (Pettarani 8 No.29)';
  const existingOffice = await prisma.officeLocation.findFirst({
    orderBy: { createdAt: 'asc' },
  });

  const officeData = {
    name: officeName,
    latitude: -5.1419048,
    longitude: 119.4452768,
    radiusMeters: 100,
    timezone: 'Asia/Makassar',
    isActive: true,
  };

  const office = existingOffice
    ? await prisma.officeLocation.update({
        where: { id: existingOffice.id },
        data: officeData,
      })
    : await prisma.officeLocation.create({ data: officeData });

  // Seed harus meninggalkan tepat satu lokasi aktif.
  await prisma.officeLocation.updateMany({
    where: { isActive: true, NOT: { id: office.id } },
    data: { isActive: false },
  });

  const shiftSeeds = [
    { name: 'Shift 1', startTime: '08:00', endTime: '15:00', sortOrder: 1 },
    { name: 'Shift 2', startTime: '15:00', endTime: '22:00', sortOrder: 2 },
    { name: 'Shift 3', startTime: '22:00', endTime: '08:00', sortOrder: 3 },
  ];

  for (const shift of shiftSeeds) {
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

  await ensureUser(ADMIN_EMAIL, ADMIN_PASSWORD, 'ADMIN');

  const employeeSeeds = [
    {
      email: 'budi@clockin.test',
      employeeNumber: 'EMP-001',
      fullName: 'Budi Santoso',
      department: 'Operasional',
      position: 'Staf Operasional',
    },
    {
      email: 'siti@clockin.test',
      employeeNumber: 'EMP-002',
      fullName: 'Siti Rahmawati',
      department: 'Keuangan',
      position: 'Staf Keuangan',
    },
    {
      email: 'andi@clockin.test',
      employeeNumber: 'EMP-003',
      fullName: 'Andi Pratama',
      department: 'Operasional',
      position: 'Staf Operasional',
    },
  ];

  for (const seed of employeeSeeds) {
    const user = await ensureUser(seed.email, EMPLOYEE_PASSWORD, 'EMPLOYEE');

    await prisma.employee.upsert({
      where: { employeeNumber: seed.employeeNumber },
      update: {
        userId: user.id,
        fullName: seed.fullName,
        department: seed.department,
        position: seed.position,
        officeLocationId: office.id,
        isActive: true,
      },
      create: {
        userId: user.id,
        employeeNumber: seed.employeeNumber,
        fullName: seed.fullName,
        department: seed.department,
        position: seed.position,
        officeLocationId: office.id,
      },
    });
  }

  console.log('Seed selesai.');
  console.log(`Admin   : ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`Karyawan: budi@clockin.test, siti@clockin.test, andi@clockin.test / ${EMPLOYEE_PASSWORD}`);
  console.log(`Kantor  : ${office.name} (${office.latitude}, ${office.longitude}) radius ${office.radiusMeters} m`);
}

main()
  .catch((error) => {
    console.error('Seed gagal:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
