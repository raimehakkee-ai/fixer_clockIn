# ClockIn — Aplikasi Absensi Perusahaan

Aplikasi absensi karyawan dengan validasi lokasi (geofencing), waktu server,
selfie kamera, deteksi mock location, serta dashboard Admin/HRD.

## Fitur

- **Mobile (Expo/React Native)**: login dengan pengikatan perangkat, pemilihan shift, Clock-In/Out dengan GPS + selfie, riwayat kehadiran, pengajuan izin/cuti, profil.
- **API (Express + Prisma + PostgreSQL)**: autentikasi JWT, absensi server-side (Haversine, akurasi, mock location, grace period Clock-Out, status `INCOMPLETE` otomatis), izin/cuti, CRUD karyawan/lokasi/shift, audit log.
- **Web Admin (Vite + React + Tailwind)**: dashboard kehadiran, monitoring + foto/koordinat, approval izin, pengelolaan karyawan/lokasi/shift, ekspor CSV/XLSX, dan audit log.

## Struktur

```
├── src/        Aplikasi Expo karyawan
├── server/     API Express + Prisma + PostgreSQL
├── admin/      Web Admin React + Tailwind
├── docs/       PRD, arsitektur, database, API, keamanan, test plan, keputusan
└── infra/      Nginx, systemd, dan skrip operasional
```

## Prasyarat

- Node.js 22.13+
- PostgreSQL 14+ **atau** Prisma local Postgres (`npx prisma dev`, tanpa Docker)

## Menjalankan

```bash
# 1. Backend
cd server
npm install
cp .env.example .env        # sesuaikan DATABASE_URL & JWT_ACCESS_SECRET
npx prisma dev --detach     # salin URL TCP ke DATABASE_URL
npx prisma generate         # wajib: generated client tidak di-commit
npx prisma migrate deploy
npm run db:seed
npm run dev                 # http://localhost:4000/api/v1

# 2. Aplikasi mobile (terminal lain)
cd ..
cp .env.example .env        # EXPO_PUBLIC_API_URL=http://localhost:4000
npx expo start              # a / i / w

# 3. Web Admin (terminal lain)
cd admin
npm install
npm run dev                 # http://localhost:5173
```

Detail backend: [`server/README.md`](./server/README.md)
Detail mobile: [`docs/MOBILE.md`](./docs/MOBILE.md)
Detail admin: [`docs/ADMIN.md`](./docs/ADMIN.md)

## Akun Demo (development)

| Peran | Email | Password |
| :--- | :--- | :--- |
| Admin | `admin@clockin.test` | `Admin123!` |
| Karyawan | `budi@clockin.test` | `Employee123!` |
| Karyawan | `siti@clockin.test` | `Employee123!` |
| Karyawan | `andi@clockin.test` | `Employee123!` |

## Pengujian

```bash
# Mobile
npm test          # unit test logika tanggal kerja & window absensi
npm run typecheck
npm run lint

# Backend (server harus berjalan untuk smoke)
cd server
npm test          # 94 unit test
npm run smoke     # 151 pemeriksaan integrasi (auth, admin, absensi, izin, laporan)
npm run smoke:security  # 41 pemeriksaan keamanan (jalankan pada server baru di-restart)

# Web Admin
cd ../admin
npm run build     # typecheck + vite build
```

Hasil terakhir: typecheck mobile & admin lulus, lint lulus, `expo-doctor` 20/20,
export web mobile berhasil, build admin berhasil, 9 unit test mobile + 94 unit test
backend + 151 smoke test + 41 security check lulus, audit dependensi server/admin
0 kerentanan, production smoke (simulasi lokal) 13/13 lulus.

## Deployment

Panduan lengkap: [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md).

Staging/UAT memakai database, service, domain, dan Admin terpisah. Seed demo
ditolak di staging; gunakan `npm run staging:bootstrap` lalu
`npm run admin:create` (lihat bagian 11 dokumen deployment).

Simulasi produksi lokal:

```bash
npm run admin:build
node infra/scripts/serve-static.mjs   # terminal 1 — http://localhost:8080
npm run production:smoke              # terminal 2
```

## Dokumentasi

- [docs/README.md](./docs/README.md) — indeks dokumen
- [docs/PRD.md](./docs/PRD.md) — kebutuhan produk & aturan bisnis
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — arsitektur & alur
- [docs/DATABASE.md](./docs/DATABASE.md) — skema & migrasi
- [docs/API.md](./docs/API.md) — kontrak `/api/v1`
- [docs/SECURITY.md](./docs/SECURITY.md) — keamanan & privasi
- [docs/SECURITY_AUDIT.md](./docs/SECURITY_AUDIT.md) — hasil audit & penguatan Fase 7
- [docs/BACKUP.md](./docs/BACKUP.md) — prosedur backup/restore (belum diuji di lingkungan ini)
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) — panduan deployment VPS/Nginx/TLS & simulasi lokal
- [docs/TEST_PLAN.md](./docs/TEST_PLAN.md) — rencana pengujian
- [docs/DECISIONS.md](./docs/DECISIONS.md) — catatan keputusan
- [docs/MOBILE.md](./docs/MOBILE.md) — panduan aplikasi mobile
- [docs/ADMIN.md](./docs/ADMIN.md) — panduan Web Admin
- [docs/HANDOVER.md](./docs/HANDOVER.md) — paket serah terima & status kesiapan
- [docs/USER_GUIDE_EMPLOYEE.md](./docs/USER_GUIDE_EMPLOYEE.md) — panduan karyawan
- [docs/USER_GUIDE_ADMIN.md](./docs/USER_GUIDE_ADMIN.md) — panduan Admin/HRD
- [docs/RUNBOOK.md](./docs/RUNBOOK.md) — runbook operasional
- [docs/REQUIREMENTS_TRACEABILITY.md](./docs/REQUIREMENTS_TRACEABILITY.md) — traceability kebutuhan

## Status

Fase 0–9 selesai: backend, mobile, Web Admin, pengujian/keamanan, simulasi deployment, dan paket serah terima.
Status rilis: **Release Candidate** — sign-off dan item P1 (uji perangkat, VPS/TLS, restore backup) belum dilakukan.

## Keterbatasan yang Diakui

- Deteksi mock location bergantung platform (Android/iOS). Browser tidak dapat melaporkannya; absensi web diblokir di produksi melalui `ALLOW_WEB_ATTENDANCE=false`.
- Selfie bukan verifikasi biometrik.
- Perangkat Android/iOS nyata belum diuji di lingkungan pengembangan ini.
- UI mobile dan Web Admin belum diuji visual di browser (tidak ada browser pada lingkungan ini); bundling/typecheck sudah divalidasi.
- Web Admin memakai `localStorage` untuk token; CSP ketat wajib di produksi.
- Reset perangkat oleh Admin mencabut sesi, tetapi perangkat yang sama masih dapat
  mendaftar ulang jika login lebih dulu; ini keputusan produk yang perlu ditinjau.
- Ringkasan “Belum Absen” bersifat perkiraan karena sistem tidak menyimpan
  penugasan shift per karyawan; angka ini tidak boleh dipakai untuk payroll.
- Dashboard harian memakai `work_date` (tanggal mulai shift), sehingga shift malam
  yang sedang berjalan setelah tengah malam tampil pada tanggal sebelumnya.
- Backup/restore belum diuji (lihat `docs/BACKUP.md`); `npm audit` root masih 12 moderate dari toolchain Expo.
- 12 advisory moderate Expo belum diperbaiki karena perbaikannya berupa perubahan major/downgrade.
