# Audit & Penguatan Keamanan (Fase 7)

| Item | Keterangan |
| :--- | :--- |
| Tanggal | 2026-11-01 |
| Lingkup | API, database, ekspor, Web Admin, mobile (statis), dependensi, deployment artifacts |
| Status | Pengujian otomatis selesai; uji perangkat & restore backup belum dapat dieksekusi |

---

## 1. Ringkasan Hasil

| Pemeriksaan | Hasil |
| :--- | :--- |
| Unit test backend | **94/94 lulus** (11 file) |
| Unit test mobile | **9/9 lulus** (logika tanggal kerja & window) |
| Smoke API (auth/admin/absensi/izin/laporan) | **151/151 lulus** |
| Security smoke | **41/41 lulus** |
| Web Admin build + CSP meta | **Lulus** |
| Mobile typecheck/lint/doctor/export | Lulus (Fase 5b; kode mobile tidak berubah) |
| `npm audit` produksi — server | **0 kerentanan** |
| `npm audit` produksi — admin | **0 kerentanan** |
| `npm audit` produksi — root (Expo) | 13 moderate, 0 high/critical |

---

## 2. Audit Dependensi

| Proyek | Sebelum | Sesudah | Catatan |
| :--- | :--- | :--- | :--- |
| `server/` | 9 moderate (semua dari `exceljs` → archiver/glob/minimatch/uuid) | **0** | `exceljs` diganti penulis XLSX minimal berbasis `fflate` |
| `admin/` | 0 | **0** | — |
| root (Expo) | 13 moderate | 13 moderate | Sebagian besar toolchain Expo/CLI; perbaikan yang ditawarkan berupa perubahan major/downgrade yang berisiko. Dipantau melalui upgrade SDK. |

Tidak ada kerentanan **high** atau **critical** pada ketiga proyek.

---

## 3. Temuan dan Perbaikan

| # | Temuan | Dampak | Perbaikan |
| :--- | :--- | :--- | :--- |
| 1 | Body JSON > 1 MB menghasilkan `500` | Kebingungan/indikasi error internal | Error handler memetakan `413` ke `VALIDATION_ERROR` |
| 2 | Waktu respons login berbeda untuk email tidak dikenal | Enumerasi akun | Bcrypt dummy dijalankan untuk email tidak dikenal |
| 3 | Rate limit login hanya per email | Rotasi email dapat mengakali limit | Ditambah limit per IP 30/15 menit |
| 4 | `exceljs` membawa 9 advisory moderate | Risiko rantai pasok | Diganti penulis XLSX minimal (`fflate`), nilai inline string/angka, tanpa parser eksternal |
| 5 | Web Admin belum memiliki CSP | Risiko XSS pada token localStorage | CSP di-inject saat build + snippet header Nginx |
| 6 | Belum ada artefak deployment/backup | Risiko operasional | `infra/nginx`, `infra/systemd`, skrip backup/restore, CI |
| 7 | XLSX belum diuji struktur | Kemungkinan file rusak | Unit test membuka ZIP dan memeriksa worksheet + tipe sel |

---

## 4. Kontrol yang Diverifikasi (41 security smoke)

- **Otorisasi**: 5 endpoint admin diuji tanpa token (401), dengan token karyawan (403), dengan token admin (bukan 401/403); 3 endpoint admin POST menolak karyawan; 3 endpoint karyawan menolak admin.
- **JWT**: token yang dimodifikasi → 401.
- **Sesi perangkat**: reset perangkat oleh Admin mencabut token lama → 401.
- **Header**: `X-Content-Type-Options: nosniff`, CSP helmet, `X-Frame-Options`.
- **CORS**: origin diizinkan mendapat header; origin asing → 403.
- **Body**: JSON rusak → 400; > 1 MB → 413.
- **Audit immutability**: `DELETE /audit-logs/:id` → 404.
- **SQL injection**: filter pencarian dengan payload → 200 (Prisma parameterized).
- **Kebocoran hash**: respons karyawan tidak memuat `passwordHash`.
- **Rate limit**: login ke-11 per email → 429; absensi ke-21 per jam → 429.
- **Upload & geofence** sudah diuji di smoke absensi: MIME palsu, > 5 MB, mock location, luar radius, akurasi buruk, IDOR foto.
- **Ekspor**: CSV injection dinetralkan; unduhan diaudit; akses non-admin ditolak.

---

## 5. Risiko yang Diterima / Belum Tertangani

| Risiko | Status | Catatan |
| :--- | :--- | :--- |
| Token Admin di `localStorage` | Diterima sementara | CSP ketat (`connect-src 'self'`) + sanitasi wajib; pertimbangkan cookie HttpOnly pada Fase 8 |
| Mock location hanya dari klien | Diterima | Tidak ada Play Integrity/App Attest; server menolak dan mencatat `CLOCK_IN_REJECTED`/`CLOCK_OUT_REJECTED` di audit log. `risk_flags` disediakan untuk anomali pada record yang diterima. |
| Rate limiter in-memory | Diterima | Multi-instance memerlukan Redis |
| `trust proxy = 1` | Konfigurasi | API **harus** di belakang Nginx; paparan langsung memungkinkan spoof `X-Forwarded-For` |
| 13 advisory moderate Expo | Diterima | Toolchain; pantau upgrade SDK |
| Uji UI browser | Belum | Tidak ada browser/agent-browser; build & route tervalidasi |
| Uji perangkat Android/iOS | Belum | Kamera/GPS/mock asli tidak dapat diuji di sini |
| Backup & restore | **Belum diuji** | `pg_dump`/`psql` tidak tersedia; jangan klaim berhasil |
| XLSX dibuka di Excel/LibreOffice | Belum | Struktur ZIP/XML diuji; validasi aplikasi spreadsheet belum |
| CI GitHub Actions | Belum dijalankan | Workflow disediakan, belum dieksekusi di runner |

---

## 6. Checklist Rilis (dari SECURITY.md)

| Item | Status |
| :--- | :--- |
| Secret hanya di environment | ✅ `.env` di-gitignore; `.env.example` placeholder |
| HTTPS + HSTS | ⏳ konfigurasi Nginx disediakan |
| Database tidak terekspos | ⏳ topologi deployment |
| Bucket privat + versioning | ⏳ konfigurasi produksi |
| Rate limit & CORS terverifikasi | ✅ |
| Endpoint privat diuji tanpa token/role salah | ✅ |
| Upload berbahaya diuji | ✅ |
| IDOR diuji | ✅ |
| CSV injection diuji | ✅ |
| Backup + uji restore | ❌ belum dieksekusi |
| Log bebas token/password | ✅ (desain + audit) |
| Prosedur reset perangkat | ✅ |
| `npm audit` | ✅ server/admin 0; root 13 moderate |
| Retensi data disetujui | ❌ OPEN-12 |

---

## 7. Perbaikan Pasca-Review (2026-11-03)

| Area | Perbaikan |
| :--- | :--- |
| Pemilihan record mobile | Record dicocokkan dengan `workDate`, bukan hanya `shiftId` |
| Clock-Out | Grace period `CLOCK_OUT_GRACE_MINUTES` (default 240) dan update kondisional anti-duplikasi |
| Shift malam | Resolusi tanggal kerja diperbaiki untuk pukul 08:00 tepat dan Clock-In sebelum tengah malam |
| Admin | Tanggal default mengikuti zona waktu kantor dari `/reports/summary` |
| Status absensi | Finalizer menandai `INCOMPLETE` setelah shift + grace; ringkasan memiliki kategori `incomplete` |
| Audit | Percobaan Clock-In/Out yang ditolak dicatat sebagai `*_REJECTED` |
| Rate limit | Batas login/refresh per IP dapat dikonfigurasi untuk lonjakan pergantian shift |
| CSP | `connect-src` dipersempit menjadi `'self'` |
| Database | CHECK constraint dan partial unique index untuk satu lokasi/perangkat aktif |
| Seed | Ditolak pada `NODE_ENV=production` |
| Setup | `prisma generate` masuk dokumentasi dan script dev/seed |
| Rilis | `bundleIdentifier`, `android.package`, dan `eas.json` ditambahkan |

## 8. Rekomendasi Fase 8

1. Uji restore backup di staging dan catat hasilnya.
2. Terapkan Nginx/systemd dan ukur header/CSP di produksi.
3. Ganti token Admin ke cookie HttpOnly + CSRF, atau pertahankan CSP ketat.
4. Tambahkan Play Integrity/App Attest untuk penguatan perangkat.
5. Pindahkan rate limit ke Redis bila API multi-instance.
6. Jalankan CI dan tambahkan UI test browser.
7. Tinjau advisory Expo pada setiap upgrade SDK.
