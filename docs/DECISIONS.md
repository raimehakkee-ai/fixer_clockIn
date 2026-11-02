# Catatan Keputusan (Decision Log)

Dokumen ini mencatat keputusan yang mengikat implementasi. Status:

- **CONFIRMED** — disetujui pemilik produk, boleh diimplementasikan.
- **PROPOSED** — usulan teknis Agent, berlaku sementara sampai dikonfirmasi.
- **OPEN** — belum diputuskan, tidak boleh dianggap final.

Tanggal baseline: **2026-11-01** (Fase 0–1).

---

## 1. Keputusan Arsitektur dan Stack

| ID | Topik | Keputusan | Status | Sumber |
| :--- | :--- | :--- | :--- | :--- |
| D-001 | Mobile | Memakai **Expo SDK 58 / React Native** yang sudah ada, bukan Flutter | CONFIRMED | Persetujuan pemilik produk, Fase 0 |
| D-002 | Web Admin | Aplikasi terpisah `admin/` — Vite + React 19 + Tailwind CSS v4 | CONFIRMED | Persetujuan pemilik produk, Fase 0 |
| D-003 | Database & ORM | PostgreSQL + Prisma 7, migrasi terversi | CONFIRMED | Persetujuan pemilik produk, Fase 0 |
| D-004 | Backend | Node.js + Express 5, REST API berprefiks `/api/v1` | CONFIRMED | AGENT.md §9 |
| D-005 | Struktur repo | `src/` (Expo), `admin/`, `server/`, `docs/`, `infra/`; tanpa npm workspaces | PROPOSED | ARCHITECTURE §6 |
| D-006 | Penyimpanan file | Interface driver: `local` (dev) + S3-compatible privat (produksi) | PROPOSED | ARCHITECTURE §3.5 |
| D-007 | Peta | Tidak memakai SDK peta; koordinat + jarak + tautan Google Maps | PROPOSED | PRD §4.5 |
| D-008 | Bahasa | UI dan dokumentasi produk berbahasa Indonesia; istilah teknis tetap Inggris | CONFIRMED | AGENT.md §1 |

---

## 2. Keputusan Aturan Bisnis

| ID | Topik | Keputusan | Status | Catatan |
| :--- | :--- | :--- | :--- | :--- |
| D-009 | Model shift | **3 shift dalam 24 jam** | CONFIRMED | Jawaban pemilik produk, Fase 0 |
| D-010 | Toleransi keterlambatan | **15 menit** setelah jam mulai shift | CONFIRMED | Jawaban pemilik produk, Fase 0 |
| D-011 | Clock-Out | Wajib di **radius kantor yang sama** dengan Clock-In | CONFIRMED | Jawaban pemilik produk, Fase 0 |
| D-012 | Jumlah lokasi | **Satu lokasi kantor aktif** pada rilis pertama | CONFIRMED | Jawaban pemilik produk, Fase 0 |
| D-013 | Radius geofence | Default **50 meter**, dapat diubah Admin (10–1000 m) | CONFIRMED | PRD awal + PRD §6 |
| D-014 | Tanggal kerja | `work_date` = tanggal **mulai** shift pada zona waktu kantor; shift malam tetap milik tanggal mulai | PROPOSED | DATABASE §5 |
| D-015 | Status `ABSENT` | Tidak disimpan; dihitung di laporan untuk shift berakhir tanpa absensi & tanpa izin. Karena penugasan shift belum disimpan, angka “Belum Absen” bersifat perkiraan | PROPOSED | DATABASE §5 |
| D-016 | Pengelolaan jam shift | Jam, nama, dan toleransi shift **dikelola Admin melalui dashboard**; seed: Shift 1 08:00–15:00, Shift 2 15:00–22:00, Shift 3 22:00–08:00 (lintas tengah malam) | CONFIRMED | Jawaban pemilik produk, Fase 1 |
| D-017 | Penugasan shift | Karyawan **memilih shift saat Clock-In** dari daftar shift aktif | CONFIRMED | Jawaban pemilik produk, Fase 1 |
| D-018 | Clock-In lebih awal | Maksimal 120 menit sebelum shift | **OPEN** | OPEN-03 |
| D-019 | Hari libur | Tabel hari libur dikelola Admin | **OPEN** | OPEN-04 |
| D-020 | Lembur | Tidak dihitung pada rilis pertama | **OPEN** | OPEN-05 |
| D-021 | Jenis & saldo cuti | SAKIT, CUTI, IZIN, LAINNYA; saldo cuti belum ada | **OPEN** | OPEN-06 |
| D-022 | Role Supervisor/Manager | Belum diimplementasikan | **OPEN** | OPEN-13 |
| D-023 | Absensi offline | Tidak diizinkan | PROPOSED | PRD §4.2 |
| D-024 | Retensi data | Foto 90 hari, record absensi 5 tahun | **OPEN** | OPEN-12 |
| D-025 | Skala awal | < 100 karyawan, < 1.000 absensi/hari | **OPEN** | OPEN-15 |

---

## 3. Keputusan Keamanan dan Sesi

| ID | Topik | Keputusan | Status |
| :--- | :--- | :--- | :--- |
| D-026 | Password | bcrypt cost 12, minimal 8 karakter (huruf + angka) | PROPOSED |
| D-027 | Token | Access JWT 15 menit; refresh 30 hari, rotasi, disimpan sebagai hash SHA-256 | PROPOSED |
| D-028 | Registrasi perangkat | Login pertama mengikat perangkat + audit `DEVICE_REGISTERED`; perangkat berbeda ditolak; Admin dapat reset + audit | CONFIRMED (Fase 2–3) |
| D-029 | Batas akurasi GPS | Tolak jika `accuracy > 100 m` | CONFIRMED (Fase 4) |
| D-030 | Mock location | Klien memblokir via `LocationObject.mocked`; server menolak `mocked=true` dan mencatat audit `CLOCK_IN_REJECTED`; `risk_flags` untuk anomali pada record yang diterima | CONFIRMED (Fase 4 + perbaikan) |
| D-031 | Idempotensi absensi | Unique `(employee_id, work_date, shift_id)` + `409`; Clock-Out memakai update kondisional. Header `Idempotency-Key` belum menyimpan respons | PROPOSED |
| D-032 | Ekspor | CSV **dan** XLSX; sel diformat agar tidak dieksekusi sebagai formula | CONFIRMED (kebutuhan) |
| D-033 | Audit log | Mencatat aksi admin, perangkat, approval, dan ekspor | CONFIRMED (kebutuhan) |
| D-034 | Penyimpanan token web | Token di penyimpanan browser; CSP wajib di produksi | PROPOSED |
| D-035 | Payload Clock-Out | Clock-Out wajib menyertakan `shiftId` yang sama dengan Clock-In | CONFIRMED (Fase 4) |
| D-036 | Penyimpanan foto | Driver `local` (dev) dan S3-compatible privat (produksi); akses hanya melalui API ber-otorisasi | CONFIRMED (Fase 4) |
| D-037 | Aturan izin/cuti | Satu pengajuan aktif per rentang tanggal; reject wajib catatan; hanya `PENDING` dapat dibatalkan; lampiran JPEG/PNG/PDF maks 5 MB | CONFIRMED (Fase 5a) |
| D-038 | Sesi mobile | Token di `expo-secure-store` (native) / `localStorage` (web); refresh otomatis sekali lalu logout bila gagal | CONFIRMED (Fase 5b) |
| D-039 | Identitas perangkat | UUID acak (`expo-crypto`) disimpan aman per instalasi; bukan bukti identitas absolut | CONFIRMED (Fase 5b) |
| D-040 | Default shift di aplikasi | Shift yang sedang berjalan dipilih otomatis, karyawan dapat mengganti sebelum absen | CONFIRMED (Fase 5b) |
| D-041 | Cakupan ekspor absensi | Satu baris per record absensi; rekap hadir/terlambat/izin/absen hanya di `/reports/summary` | CONFIRMED (Fase 6a) |
| D-042 | Keamanan ekspor | Batas 20.000 baris, rate limit 10/jam, CSV BOM + prefiks formula, XLSX sebagai teks, setiap unduhan diaudit | CONFIRMED (Fase 6a) |
| D-043 | Sesi Web Admin | Token di `localStorage`, refresh otomatis sekali, akses hanya role `ADMIN`; CSP wajib di produksi | CONFIRMED (Fase 6b) |
| D-044 | Media privat di web | Foto/lampiran diambil sebagai blob dengan Bearer token dan object URL sementara; tidak ada URL publik | CONFIRMED (Fase 6b) |
| D-045 | CSP Web Admin | CSP di-inject saat build + header Nginx; `script-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'` | CONFIRMED (Fase 7) |
| D-046 | Penulis XLSX | Menghapus `exceljs` (9 advisory moderate) dan memakai penulis XLSX minimal berbasis `fflate`; audit server menjadi 0 | CONFIRMED (Fase 7) |
| D-047 | Anti-enumerasi login | Bcrypt dummy untuk email tidak dikenal + limit login per IP 30/15 menit di samping limit per email | CONFIRMED (Fase 7) |
| D-048 | Health check | `/health` memverifikasi koneksi database; `503` bila DB gagal, `ok:true` + `db:"ok"` bila sehat | CONFIRMED (Fase 8) |
| D-049 | Trust proxy | `TRUST_PROXY` dapat dikonfigurasi; produksi memakai `1` karena API hanya diakses via Nginx | CONFIRMED (Fase 8) |
| D-050 | Bootstrap Admin produksi | Admin pertama dibuat via `npm run admin:create` (bukan seed demo); seed demo hanya untuk development | CONFIRMED (Fase 8) |
| D-051 | Mode web mobile | Web dibangun sebagai **SPA** (`web.output: "single"`), bukan SSR; seluruh layar berada di balik autentikasi sehingga SSR hanya memicu hydration mismatch | CONFIRMED (perbaikan) |
| D-052 | Grace period Clock-Out | Clock-Out diizinkan sampai `CLOCK_OUT_GRACE_MINUTES` (default 240 menit) setelah jam selesai shift; Clock-In tetap berakhir di jam selesai | CONFIRMED (perbaikan) |
| D-053 | Status `INCOMPLETE` | Finalizer periodik menandai record tanpa Clock-Out setelah shift + grace sebagai `INCOMPLETE`; Clock-Out dalam grace mengembalikan status `PRESENT`/`LATE` | CONFIRMED (perbaikan) |
| D-054 | Audit percobaan absensi | Percobaan Clock-In/Out yang ditolak dicatat sebagai `CLOCK_IN_REJECTED`/`CLOCK_OUT_REJECTED`; `risk_flags` tetap disediakan untuk anomali pada record yang diterima | CONFIRMED (perbaikan) |

---

## 4. Dampak dan Tindak Lanjut Keputusan Terbuka

Keputusan **OPEN** yang memblokir implementasi:

| ID | Memblokir | Diperlukan sebelum |
| :--- | :--- | :--- |
| D-018 | Validasi jendela Clock-In (default 120 menit) | Fase 4 |
| D-024 | Kebijakan retensi & pembersihan file | Fase 8 (produksi) |

**D-016 dan D-017 sudah terjawab:** shift dikelola Admin dan dipilih karyawan saat Clock-In, sehingga tidak ada lagi keputusan yang menahan Fase 2.

Tidak memblokir Fase 2 (dapat memakai nilai default yang terdokumentasi): D-019, D-020, D-021, D-022, D-023, D-025.

---

## 5. Cara Mengubah Keputusan

1. Ajukan perubahan dengan menyebut ID keputusan.
2. Catat dampak pada skema, API, UI, dan pengujian.
3. Perbarui status dan tanggal di dokumen ini.
4. Perbarui dokumen terkait (PRD/DATABASE/API/SECURITY/TEST_PLAN).
5. Jika perubahan memengaruhi data produksi, siapkan migrasi dan rencana rollback.

---

## 6. Riwayat Perubahan

| Tanggal | Perubahan | Oleh |
| :--- | :--- | :--- |
| 2026-11-01 | Dokumen dibuat; D-001–D-014 dicatat dari Fase 0; 8 keputusan masih OPEN | Agent |
| 2026-11-01 | D-016 & D-017 dikonfirmasi: shift dikelola Admin dan dipilih karyawan saat Clock-In; kolom `employees.shift_id` dihapus dari rancangan | Agent |
| 2026-11-01 | Fase 4: D-029, D-030, D-035, D-036 diimplementasikan (geofence, mock, payload Clock-Out, storage foto) | Agent |
| 2026-11-01 | Fase 5a: D-037 ditetapkan untuk aturan izin/cuti, tumpang tindih, dan pembatalan | Agent |
| 2026-11-01 | Fase 5b: D-038–D-040 ditetapkan untuk sesi mobile, identitas perangkat, dan default shift | Agent |
| 2026-11-01 | Fase 6a: D-041–D-042 ditetapkan untuk cakupan ekspor dan keamanan unduhan | Agent |
| 2026-11-01 | Fase 6b: D-043–D-044 ditetapkan untuk sesi Web Admin dan pengambilan media privat | Agent |
| 2026-11-01 | Fase 7: D-045–D-047 ditetapkan untuk CSP, penulis XLSX baru, dan anti-enumerasi login | Agent |
| 2026-11-01 | Fase 8: D-048–D-050 ditetapkan untuk health check database, trust proxy, dan bootstrap Admin | Agent |
| 2026-11-01 | Perbaikan hydration: web mobile diubah menjadi SPA (D-051); override `use-color-scheme` untuk SSR dihapus | Agent |
