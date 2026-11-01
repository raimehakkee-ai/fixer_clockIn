import { prisma } from '../src/db';
import { hashPassword } from '../src/lib/password';

const email = (process.env.ADMIN_EMAIL ?? process.argv[2] ?? '')
  .trim()
  .toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? process.argv[3] ?? '';

if (!email || !password) {
  console.error(
    'Penggunaan: npm run admin:create -- <email> <password>\n' +
      'atau set ADMIN_EMAIL dan ADMIN_PASSWORD.',
  );
  process.exit(1);
}

if (
  password.length < 8 ||
  !/[A-Za-z]/.test(password) ||
  !/\d/.test(password)
) {
  console.error(
    'Password minimal 8 karakter dan harus memuat huruf serta angka.',
  );
  process.exit(1);
}

async function main() {
  const passwordHash = await hashPassword(password);
  const existing = await prisma.user.findUnique({ where: { email } });

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash, role: 'ADMIN', isActive: true },
      })
    : await prisma.user.create({
        data: { email, passwordHash, role: 'ADMIN' },
      });

  await prisma.auditLog.create({
    data: {
      actorUserId: null,
      action: 'ADMIN_BOOTSTRAPPED',
      entityType: 'user',
      entityId: user.id,
      metadata: { email, mode: existing ? 'updated' : 'created' },
    },
  });

  console.log(`Admin siap: ${email}`);
}

main()
  .catch((error) => {
    console.error('Gagal menyiapkan Admin:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
