# Traceability Requirement → Implementasi

Status: ✅ terpenuhi · ⚠️ sebagian · ❌ belum / di luar rilis

---

## 1. Kebutuhan Fungsional PRD

| ID | Kebutuhan | Implementasi | Bukti / Catatan | Status |
| :--- | :--- | :--- | :--- | :--- |
| F-01 | Login email/password + bcrypt | `routes/auth.ts`, `lib/password.ts` | Smoke auth; password test | ✅ |
| F-02 | Access + refresh token, logout | JWT 15 mnt, refresh 30 hari rotasi, hash di DB | Smoke auth (refresh/reuse/logout) | ✅ |
| F-03 | Satu akun satu perangkat | `devices`, login binding | Smoke auth & security | ✅ |
| F-04 | Admin reset perangkat + audit | `POST /employees/:id/reset-device` | Smoke admin/security, audit | ✅ |
| F-05 | Clock-In geofence server-side | `attendance-service`, Haversine | Smoke absensi (dalam/luar radius) | ✅ |
| F-06 | Clock-Out radius sama | `clockOut` memakai office record | Smoke absensi | ✅ |
| F-07 | Selfie hanya dari kamera | `CameraView`, tanpa galeri | Kode mobile; uji perangkat belum | ⚠️ |
| F-08 | Tolak mock location | `LocationObject.mocked` + server | Smoke server; uji perangkat belum | ⚠️ |
| F-09 | Batas akurasi GPS | `ACCURACY_LIMIT_M` (default 100 m) | Smoke absensi | ✅ |
| F-10 | Waktu server | Semua timestamp dari `new Date()` server | Smoke & unit time | ✅ |
| F-11 | Cegah absensi ganda | Unique `(employee, workDate, shift)` | Smoke absensi 409 | ✅ |
| F-12 | 3 shift/24 jam + toleransi 15 mnt | Tabel `shifts` + seed | Smoke admin; UI lokasi/shift | ✅ |
| F-13 | Riwayat karyawan | `GET /attendance/me`, tab Riwayat | Smoke & UI | ✅ |
| F-14 | Pengajuan izin + lampiran | `leave-requests`, upload PDF/gambar | Smoke izin | ✅ |
| F-15 | Approval + audit | `decideLeave`, audit log | Smoke izin | ✅ |
| F-16 | Dashboard dari backend | `/reports/summary` + UI | Smoke laporan; production smoke | ✅ |
| F-17 | Konfigurasi lokasi & radius | `/office-locations` + UI | Smoke admin | ✅ |
| F-18 | Konfigurasi shift | `/shifts` + UI | Smoke admin | ✅ |
| F-19 | Monitoring + filter | `/attendance` + UI | Smoke & build | ✅ |
| F-20 | Foto & koordinat | Endpoint foto auth + detail admin | Smoke absensi/security | ✅ |
| F-21 | Ekspor CSV/XLSX + anti-injection | `lib/export.ts`, `/reports/*/export` | Unit test XLSX/CSV, smoke laporan | ✅ |
| F-22 | Audit log | `audit_logs`, `/audit-logs` | Smoke laporan/security | ✅ |
| F-23 | Pencarian & pagination | Query admin + pagination | Smoke admin | ✅ |
| F-24 | Indikator shift berikutnya | Daftar shift ditampilkan; tidak ada hitung mundur | — | ⚠️ |

---

## 2. Kebutuhan Non-Fungsional

| Area | Kebutuhan | Status | Catatan |
| :--- | :--- | :--- | :--- |
| Keamanan | JWT, bcrypt, role, device, rate limit, upload validation | ✅ | 41 security check |
| Privasi | Lokasi hanya saat absensi, media privat | ✅ | Endpoint auth; kebijakan retensi OPEN |
| Keandalan | Transaksi, unique constraint, health DB | ✅ | Backup/restore belum diuji |
| Performa | p95 < 500 ms | ❌ | Belum diuji beban |
| Aksesibilitas | Kontras, label | ⚠️ | Desain mendukung; audit aksesibilitas belum |
| Dokumentasi | Instalasi, API, keamanan, backup, panduan | ✅ | `docs/` lengkap |
| CI/CD | Build & test otomatis | ⚠️ | Workflow ada, belum dijalankan |

---

## 3. Deliverable AGENT.md

| Deliverable | Lokasi | Status |
| :--- | :--- | :--- |
| Dokumentasi instalasi/konfigurasi | `server/README.md`, `docs/DEPLOYMENT.md` | ✅ |
| Dokumentasi API | `docs/API.md` | ✅ |
| Dokumentasi backup/restore | `docs/BACKUP.md` | ✅ (belum dieksekusi) |
| Panduan Admin | `docs/USER_GUIDE_ADMIN.md` | ✅ |
| Panduan karyawan | `docs/USER_GUIDE_EMPLOYEE.md` | ✅ |
| Daftar keterbatasan & lanjutan | `docs/HANDOVER.md` | ✅ |
| Audit log & keputusan | `docs/DECISIONS.md` | ✅ |

---

## 4. Di Luar Cakupan Rilis

- Face recognition/liveness.
- Payroll, lembur, saldo cuti, kalender hari libur.
- Absensi offline.
- Multi-lokasi kantor.
- Role Supervisor/Manager.
- Play Integrity/App Attest.
- Deployment VPS/TLS nyata dan restore backup teruji.
