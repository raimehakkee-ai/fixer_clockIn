# Server API — ClockIn

Backend Express 5 + Prisma 7 + PostgreSQL untuk aplikasi absensi.
Dokumen desain lengkap ada di [`../docs`](../docs/README.md).

## Status Fase 2–3

Fondasi (Fase 2):

- Konfigurasi environment tervalidasi (Zod).
- Skema database lengkap + migrasi `20261101165303_init`.
- Seed: 1 kantor, 3 shift, 1 Admin, 3 karyawan.
- Autentikasi JWT: `login`, `refresh` (rotasi + hash), `logout`, `me`.
- Pengikatan perangkat (registrasi login pertama, aktivasi ulang setelah reset).
- Audit log untuk login, kegagalan login, registrasi/revoke/reset perangkat.
- Error handler terpusat, `requestId`, rate limit login, CORS allow-list, helmet.

Modul Admin (Fase 3):

- CRUD karyawan dan akun: buat, detail, ubah, aktif/nonaktif, reset password, reset perangkat.
- Manajemen lokasi kantor: satu lokasi aktif, validasi koordinat, radius 10–1000 m, zona waktu IANA.
- Manajemen shift: nama, jam mulai/selesai, toleransi, jendela Clock-In lebih awal; `crossesMidnight` dihitung server.
- Endpoint perangkat karyawan: `GET /devices/me`, `POST /devices/revoke`.
- Otorisasi role: seluruh endpoint admin memakai `requireRole('ADMIN')`; karyawan hanya data miliknya.

Mesin absensi (Fase 4):

- `POST /attendance/clock-in` dan `clock-out` (multipart, foto wajib JPEG/PNG, magic bytes, maks 5 MB).
- Validasi server-side: shift aktif, jendela Clock-In, grace period Clock-Out, Haversine radius kantor, batas akurasi `ACCURACY_LIMIT_M` (default 100 m), penolakan mock location.
- Waktu server; `work_date` sadar shift malam (22:00–08:00); anti-duplikasi per (karyawan, tanggal kerja, shift).
- Riwayat karyawan, monitoring admin, detail, dan foto ber-otorisasi (pemilik/Admin).
- Storage driver: lokal (`uploads/`, di-gitignore) atau S3-compatible privat.

Modul izin/cuti (Fase 5a):

- `POST /leave-requests` multipart dengan lampiran opsional (JPEG/PNG/PDF, magic bytes, maks 5 MB).
- Validasi tanggal, alasan minimal 10 karakter, dan tumpang tindih dengan pengajuan `PENDING`/`APPROVED`.
- Riwayat karyawan, monitoring admin, detail, dan unduhan lampiran ber-otorisasi.
- Approve/reject oleh Admin (reject wajib catatan); pembatalan hanya untuk `PENDING`.
- Audit `LEAVE_CREATED`, `LEAVE_APPROVED`, `LEAVE_REJECTED`, `LEAVE_CANCELLED`.

Laporan & audit (Fase 6a):

- `GET /reports/summary?date=` — statistik harian (hadir, terlambat, izin, absen, pengajuan menunggu).
- `GET /reports/attendance/export` — CSV/XLSX per periode dengan filter karyawan, shift, status.
- `GET /reports/leave/export` — CSV/XLSX pengajuan izin per periode.
- CSV memakai BOM UTF-8 dan prefiks `'` untuk sel berbahaya (formula injection); XLSX ditulis sebagai teks.
- Batas 20.000 baris per ekspor; rate limit 10 unduhan/jam per Admin; setiap unduhan diaudit.
- `GET /audit-logs` — filter action, actor, entity, periode, pagination.

- Grace period Clock-Out (`CLOCK_OUT_GRACE_MINUTES`, default 240 menit) dan
  finalizer otomatis yang menandai record tanpa Clock-Out sebagai `INCOMPLETE`.
- Audit `CLOCK_IN_REJECTED`/`CLOCK_OUT_REJECTED` untuk percobaan yang ditolak.
- Constraint database untuk radius, jam shift, tanggal izin, dan satu perangkat aktif.

Total pengujian: 94 unit test backend + 9 unit test mobile, 18 smoke auth, 41 smoke admin, 31 smoke absensi, 30 smoke izin, 31 smoke laporan, 41 security check.
Audit dependensi produksi: **0 kerentanan** (setelah `exceljs` diganti penulis XLSX berbasis `fflate`).

Belum tersedia (fase berikutnya): deployment produksi (Nginx, HTTPS, backup teruji).

## Prasyarat

- Node.js 22.13+ (diuji pada 22.22.1)
- PostgreSQL 14+ **atau** Prisma local Postgres (`npx prisma dev`) tanpa Docker

## Setup

```bash
cd server
npm install
cp .env.example .env
```

### Opsi A — Prisma local Postgres (tanpa Docker)

```bash
npx prisma dev --detach        # menyalakan Postgres lokal
npx prisma dev ls              # lihat URL TCP, contoh:
                               # postgres://postgres:postgres@localhost:51214/template1?sslmode=disable
```

Salin URL TCP tersebut ke `DATABASE_URL` di `.env`. Jika ingin database
terpisah (disarankan), buat dulu:

```bash
DATABASE_URL='postgres://postgres:postgres@localhost:51214/template1?sslmode=disable' \
node --input-type=module -e "import pg from 'pg'; const c=new pg.Client({connectionString:process.env.DATABASE_URL}); await c.connect(); await c.query('CREATE DATABASE clockin'); await c.end();"
```

lalu gunakan `.../clockin?sslmode=disable`.

### Opsi B — PostgreSQL biasa / Docker

```bash
# Gunakan PostgreSQL lokal yang sudah berjalan, lalu set DATABASE_URL:
# DATABASE_URL="postgresql://clockin:clockin@localhost:5432/clockin"
```

### Migrasi dan seed

```bash
npx prisma generate            # wajib: generated client tidak di-commit
npx prisma migrate deploy      # atau: npx prisma migrate dev
npm run db:seed
npm run dev                    # http://localhost:4000/api/v1
```

## Perintah

| Perintah | Fungsi |
| :--- | :--- |
| `npm run dev` | Server dengan watch mode |
| `npm start` | Server sekali jalan |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit test (Vitest) |
| `npm run db:migrate` | Buat/terapkan migrasi (dev) |
| `npm run db:deploy` | Terapkan migrasi (produksi/staging) |
| `npm run db:seed` | Seed data demo |
| `npm run admin:create -- <email> <password>` | Buat/ubah Admin produksi (tanpa data demo) |
| `npm run db:studio` | Prisma Studio |
| `npm run db:local` | `prisma dev --detach` |

Smoke test (server harus berjalan):

```bash
node scripts/smoke-auth.mjs        # 18 pemeriksaan autentikasi/perangkat
node scripts/smoke-admin.mjs       # 41 pemeriksaan karyawan/lokasi/shift/otorisasi
node scripts/smoke-attendance.mjs  # 29 pemeriksaan clock-in/out, geofence, foto, riwayat
node scripts/smoke-leave.mjs       # 30 pemeriksaan pengajuan, lampiran, approval, pembatalan
node scripts/smoke-reports.mjs     # 31 pemeriksaan ringkasan, ekspor CSV/XLSX, audit
node scripts/smoke-security.mjs    # 41 pemeriksaan otorisasi, header, CORS, rate limit, sesi
```

> `smoke-security` menguji rate limit login; jalankan pada server yang baru di-restart
> atau setelah 15 menit agar limit sebelumnya tidak mengganggu.

## Kredensial demo (hanya development)

| Peran | Email | Password |
| :--- | :--- | :--- |
| Admin | `admin@clockin.test` | `Admin123!` |
| Karyawan | `budi@clockin.test` | `Employee123!` |
| Karyawan | `siti@clockin.test` | `Employee123!` |
| Karyawan | `andi@clockin.test` | `Employee123!` |

## Environment

Lihat `.env.example` (development) dan `.env.production.example` (produksi).
Variabel wajib: `DATABASE_URL`, `JWT_ACCESS_SECRET` (minimal 32 karakter).
`TRUST_PROXY` menentukan jumlah hop reverse proxy (`1` di belakang Nginx,
`false` bila API diakses langsung). `NODE_ENV` di shell dapat menimpa `.env`;
jalankan development dengan `NODE_ENV=development`.

Health check `GET /api/v1/health` kini memverifikasi database dan mengembalikan
`503` bila koneksi DB gagal.

Panduan deployment lengkap: [`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md).

## Troubleshooting

- **`npm install` gagal `ENOENT ... rename ... _cacache`** — cache npm rusak:
  `npm install --no-cache --no-audit --no-fund`.
- **DevDependencies tidak terpasang** — shell memakai `NODE_ENV=production`.
  Jalankan `NODE_ENV=development npm install --include=dev`.
- **`prisma dev` mengganti port** — perbarui `DATABASE_URL` dengan URL TCP
  terbaru dari `npx prisma dev ls`.
- **Port 4000 dipakai** — ubah `PORT` di `.env`.

## Keamanan

Password di-hash bcrypt (cost 12), refresh token disimpan sebagai hash SHA-256
dan dirotasi, sesi dicabut saat logout, perangkat karyawan terikat satu akun,
semua input divalidasi Zod, dan audit log tidak memuat token/password.
Keterbatasan: deteksi mock location dan validasi geofence baru diimplementasikan
pada Fase 4; lihat [`../docs/SECURITY.md`](../docs/SECURITY.md).
