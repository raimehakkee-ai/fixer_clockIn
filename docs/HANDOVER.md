# Serah Terima (Handover) — ClockIn

| Item | Keterangan |
| :--- | :--- |
| Versi dokumen | 1.0 |
| Tanggal | 2026-11-01 |
| Status rilis | **Release Candidate** — belum disetujui untuk produksi |
| Lingkup | Backend, mobile karyawan, Web Admin, deployment artifacts, pengujian |

> **Pernyataan jujur:** sistem belum boleh disebut "siap produksi". Beberapa item
> kritis belum dapat dieksekusi di lingkungan pengembangan ini: uji perangkat
> Android/iOS, uji UI browser, restore backup, serta deployment VPS/TLS nyata.
> Lihat matriks kesiapan di bawah.

---

## 1. Ringkasan Produk

Aplikasi absensi karyawan dengan:

- Geofencing + waktu server + selfie kamera + deteksi mock location.
- 3 shift/24 jam yang dapat dikelola Admin, toleransi 15 menit.
- Satu akun terikat satu perangkat; reset oleh Admin.
- Pengajuan izin/cuti/sakit dengan lampiran dan approval.
- Dashboard Admin, monitoring + foto/koordinat, ekspor CSV/XLSX, audit log.

Stack: Expo SDK 58 (mobile), Express 5 + Prisma 7 + PostgreSQL (API), Vite +
React 19 + Tailwind 4 (admin). Detail: `docs/ARCHITECTURE.md`.

---

## 2. Peta Deliverable

| Area | Lokasi | Status |
| :--- | :--- | :--- |
| Mobile karyawan | `src/` | Selesai (belum uji perangkat) |
| API | `server/` | Selesai, 94 unit backend + 9 unit mobile + 151 smoke + 41 security |
| Web Admin | `admin/` | Selesai, build produksi lulus |
| Dokumentasi | `docs/` | Lengkap |
| Infrastruktur | `infra/` | Artefak siap, belum dieksekusi di VPS |
| CI | `.github/workflows/ci.yml` | Disiapkan, belum dijalankan |

---

## 3. Menjalankan Cepat

```bash
# Backend
cd server && npm install
cp .env.example .env
npx prisma dev --detach
npx prisma migrate deploy
npm run db:seed
npm run dev

# Mobile
cd .. && cp .env.example .env
npx expo start

# Web Admin
cd admin && npm install && npm run dev
```

Akun demo: `admin@clockin.test / Admin123!`, `budi@clockin.test / Employee123!`.
**Jangan memakai seed demo di produksi** — gunakan `npm run admin:create`.

---

## 4. Bukti Pengujian (hasil aktual)

| Pemeriksaan | Hasil |
| :--- | :--- |
| Mobile `tsc --noEmit` | Lulus |
| Mobile `expo lint` | Lulus (0 masalah) |
| `expo-doctor` | 20/20 lulus |
| Mobile `expo export --platform web` | Berhasil (semua route) |
| Server `tsc --noEmit` | Lulus |
| Server unit test | **94/94 lulus** |
| Mobile unit test | **9/9 lulus** |
| Smoke API | **151/151 lulus** |
| Security smoke | **41/41 lulus** |
| Admin `tsc --noEmit` + build | Lulus |
| Production smoke (simulasi lokal) | **13/13 lulus** |
| Health tanpa DB | `503 {ok:false, db:"error"}` |
| Audit dependensi produksi | server 0, admin 0, root 13 moderate (Expo) |

---

## 5. Matriks Kesiapan

| Item | Status | Catatan |
| :--- | :--- | :--- |
| Fitur karyawan (login, absen, riwayat, izin) | ✅ | Kode & API teruji |
| Fitur Admin (dashboard, monitoring, approval, CRUD, laporan, audit) | ✅ | Build lulus |
| Keamanan dasar (JWT, role, device, upload, geofence, mock) | ✅ | Ada risiko diterima |
| Reset perangkat | ⚠️ | Perangkat lama masih dapat mendaftar ulang jika login lebih dulu; perlu keputusan produk |
| Akurasi ringkasan “Belum Absen” | ⚠️ | Perkiraan karena penugasan shift per karyawan belum disimpan |
| Shift malam di dashboard harian | ⚠️ | Record memakai tanggal mulai shift, sehingga shift yang berjalan setelah tengah malam tampil pada tanggal sebelumnya |
| Pengujian perangkat Android/iOS nyata | ❌ | Kamera/GPS/mock asli belum diuji |
| Pengujian UI browser (visual/interaksi) | ❌ | Tidak ada browser/agent-browser |
| Backup + restore teruji | ❌ | `pg_dump`/`psql` tidak tersedia |
| Deployment VPS, Nginx, TLS nyata | ❌ | Artefak + simulasi lokal saja |
| CI GitHub Actions dieksekusi | ❌ | Workflow disediakan |
| Uji beban/performance | ❌ | Target p95 belum diukur |
| Retensi foto/data disetujui | ❌ | OPEN-12 |
| Hari libur, lembur, saldo cuti | ❌ | Belum dirilis |

---

## 6. Keputusan yang Masih Dibutuhkan Pemilik Produk

| ID | Pertanyaan |
| :--- | :--- |
| OPEN-03 | Batas Clock-In lebih awal (usulan 120 menit) |
| OPEN-04 | Kalender hari libur |
| OPEN-05 | Perhitungan lembur |
| OPEN-06 | Saldo dan jenis cuti final |
| OPEN-09 | Prosedur bila kamera/lokasi ditolak permanen |
| OPEN-12 | Retensi foto (usulan 90 hari) dan data absensi (5 tahun) |
| OPEN-13 | Role Supervisor/Manager |
| OPEN-15 | Target skala & performa |

Nilai saat ini terdokumentasi di `docs/DECISIONS.md` dan `docs/PRD.md`.

---

## 7. Pekerjaan Lanjutan (Prioritas)

**P1 — wajib sebelum produksi**

1. Uji perangkat Android nyata: kamera, GPS, mock location, shift malam, jaringan buruk.
2. Jalankan Nginx + TLS + systemd di staging; verifikasi CSP/HSTS.
3. Uji restore backup dari salinan off-site.
4. Putuskan retensi data & kebijakan privasi.
5. Tinjau risiko `localStorage` Admin; pertimbangkan cookie HttpOnly.

**P2 — penguatan**

6. Play Integrity / App Attest.
7. Rate limit berbasis Redis untuk multi-instance.
8. UI automation browser (Playwright/agent-browser) + CI.
9. Code-splitting admin (bundle 637 kB).
10. Hari libur, saldo cuti, koreksi absensi.
11. Uji beban ringan dan monitoring produksi.

---

## 8. Checklist Serah Terima

- [ ] Akses repository diberikan ke tim penerima.
- [ ] Secret produksi diserahkan **di luar repository** (password manager).
- [ ] Domain, VPS, dan bucket S3 disiapkan.
- [ ] Database produksi + migrasi diterapkan.
- [ ] Admin pertama dibuat via `npm run admin:create`.
- [ ] Nginx/TLS aktif dan header terverifikasi.
- [ ] Backup harian + restore test terjadwal.
- [ ] Monitoring/alert aktif.
- [ ] Panduan karyawan & Admin dibagikan.
- [ ] Pemilik produk menyetujui daftar keterbatasan.

---

## 9. Sign-off

| Peran | Nama | Tanggal | Tanda tangan |
| :--- | :--- | :--- | :--- |
| Pemilik produk | | | |
| Tech lead | | | |
| Admin/HRD | | | |
| Keamanan/IT | | | |

## 10. Kontak Dukungan

| Peran | Kontak |
| :--- | :--- |
| Pemilik produk | (diisi) |
| Pengelola server | (diisi) |
| Dukungan Admin | (diisi) |

## 11. Dokumen Terkait

- [README](./README.md) — indeks
- [PRD](./PRD.md), [ARCHITECTURE](./ARCHITECTURE.md), [DATABASE](./DATABASE.md), [API](./API.md)
- [SECURITY](./SECURITY.md), [SECURITY_AUDIT](./SECURITY_AUDIT.md)
- [DEPLOYMENT](./DEPLOYMENT.md), [BACKUP](./BACKUP.md)
- [MOBILE](./MOBILE.md), [ADMIN](./ADMIN.md)
- [Panduan Karyawan](./USER_GUIDE_EMPLOYEE.md), [Panduan Admin](./USER_GUIDE_ADMIN.md), [Runbook](./RUNBOOK.md)
- [Traceability](./REQUIREMENTS_TRACEABILITY.md)
