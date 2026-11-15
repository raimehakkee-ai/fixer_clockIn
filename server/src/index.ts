import { createApp } from './app';
import { prisma } from './db';
import { env } from './env';
import { startAttendanceFinalizer } from './services/attendance-finalize-service';

const app = createApp();
const server = app.listen(env.PORT, () => {
  console.log(
    `ClockIn API berjalan di http://localhost:${env.PORT}/api/v1 (${env.NODE_ENV})`,
  );

  if (env.NODE_ENV === 'production' && env.STORAGE_DRIVER === 'local') {
    console.warn(
      '[startup] STORAGE_DRIVER=local pada produksi: pastikan direktori uploads persisten dan di-backup.',
    );
  }

  if (
    env.NODE_ENV === 'production' &&
    env.corsOrigins.some((origin) => origin.includes('localhost'))
  ) {
    console.warn(
      '[startup] CORS_ORIGIN masih memuat localhost pada produksi.',
    );
  }
});

const finalizeTimer = startAttendanceFinalizer();

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`Menerima ${signal}. Menutup server...`);
  clearInterval(finalizeTimer);

  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });

  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
