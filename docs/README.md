# Dokumentasi — Aplikasi Absensi dfixer_clockIn

Indeks dokumen dan statusnya per **2026-11-01**.

| Dokumen | Isi | Status |
| :--- | :--- | :--- |
| [PRD.md](./PRD.md) | Tujuan produk, role, alur, kebutuhan fungsional, aturan bisnis, kriteria penerimaan | Draft Fase 1 |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Komponen, diagram, trust boundary, alur Clock-In, lingkungan, deployment | Draft Fase 1 |
| [DATABASE.md](./DATABASE.md) | Tabel, enum, constraint, indeks, semantik shift & zona waktu, migrasi, backup | Draft Fase 1 |
| [API.md](./API.md) | Konvensi `/api/v1`, autentikasi, endpoint, error, matriks akses, contoh cURL | Draft Fase 1 |
| [SECURITY.md](./SECURITY.md) | Model ancaman, kontrol, privasi, audit, checklist rilis, keterbatasan | Aktif |
| [SECURITY_AUDIT.md](./SECURITY_AUDIT.md) | Hasil audit Fase 7: pengujian, dependensi, temuan, risiko diterima | Aktif |
| [BACKUP.md](./BACKUP.md) | Prosedur backup/restore database & media, status uji | Aktif |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Topologi, langkah VPS/Nginx/TLS, update/rollback, simulasi produksi lokal | Aktif |
| [TEST_PLAN.md](./TEST_PLAN.md) | Tingkat tes, matriks kasus, target non-fungsional, exit criteria | Rencana — belum dieksekusi penuh |
| [MOBILE.md](./MOBILE.md) | Aplikasi Expo karyawan: layar, konfigurasi, alur, keterbatasan | Aktif |
| [ADMIN.md](./ADMIN.md) | Web Admin: halaman, autentikasi, media privat, keterbatasan | Aktif |
| [HANDOVER.md](./HANDOVER.md) | Paket serah terima: status, kesiapan, keputusan terbuka, sign-off | Aktif |
| [USER_GUIDE_EMPLOYEE.md](./USER_GUIDE_EMPLOYEE.md) | Panduan karyawan (login, absen, riwayat, izin) | Aktif |
| [USER_GUIDE_ADMIN.md](./USER_GUIDE_ADMIN.md) | Panduan Admin/HRD (monitoring, approval, karyawan, laporan) | Aktif |
| [RUNBOOK.md](./RUNBOOK.md) | Operasional: health, insiden, rotasi secret, update/rollback | Aktif |
| [REQUIREMENTS_TRACEABILITY.md](./REQUIREMENTS_TRACEABILITY.md) | Peta kebutuhan PRD/AGENT ke implementasi & bukti | Aktif |
| [DECISIONS.md](./DECISIONS.md) | Keputusan CONFIRMED/PROPOSED/OPEN beserta dampaknya | Aktif |

---

## Ringkasan Sistem

- **Mobile karyawan:** Expo SDK 58 / React Native (`src/`).
- **Web Admin:** Vite + React + Tailwind (`admin/`).
- **API:** Express + Prisma (`server/`), prefix `/api/v1`.
- **Database:** PostgreSQL.
- **Storage:** privat, driver lokal (dev) / S3-compatible (produksi).
- **Laporan:** ringkasan harian, ekspor CSV/XLSX, dan audit log (Admin).
- **Aturan terkonfirmasi:** 3 shift/24 jam, toleransi 15 menit, Clock-Out pada radius yang sama, satu lokasi aktif.

## Status Fase

| Fase | Status |
| :--- | :--- |
| 0 — Pemeriksaan & klarifikasi | Selesai |
| 1 — Dokumen desain | Selesai (menunggu tinjauan & keputusan shift) |
| 2 — Fondasi backend | Selesai — migrasi + seed, auth JWT/perangkat, 34 unit test, 18 smoke test |
| 3 — Modul karyawan & admin | Selesai — CRUD karyawan/akun, perangkat, lokasi, shift, otorisasi; 41 smoke test |
| 4 — Mesin absensi | Selesai — clock-in/out, geofence, mock GPS, foto privat, riwayat, monitoring; 31 smoke test |
| 5a — API izin/cuti | Selesai — pengajuan, lampiran, approval, pembatalan; 30 smoke test |
| 5 — Aplikasi mobile | Selesai (Fase 5b) — login/perangkat, absen + kamera, riwayat, izin, profil |
| 6a — API laporan & audit | Selesai — ringkasan harian, ekspor CSV/XLSX, audit log; 31 smoke test |
| 6 — Web Admin | Selesai (Fase 6b) — dashboard, monitoring + foto, approval, karyawan, lokasi/shift, laporan, audit |
| 7 — Pengujian & keamanan | Selesai (otomatis) — 94 unit backend + 9 unit mobile, 151 smoke API, 41 security check, audit dependensi; backup/restore belum diuji |
| 8 — Deployment | Selesai (simulasi lokal) — artefak Nginx/systemd, build statis + proxy, production smoke 13/13; VPS/TLS & restore belum dieksekusi |
| 9 — Serah terima | Selesai — paket dokumentasi, panduan, runbook, traceability; sign-off menunggu |

## Keputusan Terkini

- **D-016** — shift (nama, jam, toleransi) dikelola Admin melalui dashboard; seed: Shift 1 08:00–15:00, Shift 2 15:00–22:00, Shift 3 22:00–08:00.
- **D-017** — karyawan memilih shift saat Clock-In.

Tidak ada keputusan yang menahan Fase 2. Default lain terdokumentasi di [DECISIONS.md](./DECISIONS.md).
