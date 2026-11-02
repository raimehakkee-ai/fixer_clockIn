import { prisma } from '../src/db';
import { finalizeOpenAttendance } from '../src/services/attendance-finalize-service';

finalizeOpenAttendance()
  .then((count) => {
    console.log(`Selesai. ${count} record ditandai INCOMPLETE.`);
  })
  .catch((error) => {
    console.error('Gagal finalisasi absensi:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
