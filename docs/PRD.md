# PRD — Aplikasi Absensi Perusahaan

| Item | Keterangan |
| :--- | :--- |
| Versi | 1.0 (Fase 1) |
| Tanggal | 2026-11-01 |
| Status | Draft untuk ditinjau — aturan bisnis bertanda **OPEN** belum final |
| Pemilik produk | (diisi pemilik produk) |
| Dokumen terkait | [ARCHITECTURE](./ARCHITECTURE.md), [DATABASE](./DATABASE.md), [API](./API.md), [SECURITY](./SECURITY.md), [TEST_PLAN](./TEST_PLAN.md), [DECISIONS](./DECISIONS.md) |

---

## 1. Latar Belakang dan Tujuan

Perusahaan skala kecil membutuhkan pencatatan kehadiran yang akurat tanpa biaya besar. Sistem ini menggantikan absensi manual dengan aplikasi mobile karyawan dan dashboard web Admin/HRD.

**Tujuan produk**

1. Memvalidasi lokasi absensi memakai geofencing dan waktu server.
2. Mengurangi kecurangan melalui selfie kamera, pemeriksaan mock location, dan pengikatan perangkat.
3. Memangkas pekerjaan administrasi melalui rekapitulasi dan persetujuan digital.

**Metrik keberhasilan awal**

- ≥ 95% absensi karyawan tercatat tanpa koreksi manual.
- Rekap bulanan dapat diunduh dalam < 1 menit.
- Tidak ada absensi ganda untuk shift yang sama.

---

## 2. Ruang Lingkup

### Termasuk

- Login email/password, sesi JWT, pengikatan satu perangkat per akun.
- Clock-In dan Clock-Out dengan validasi geofence, akurasi GPS, dan mock location.
- Foto selfie wajib dari kamera aplikasi.
- Riwayat kehadiran karyawan.
- Pengajuan izin/cuti/sakit dengan lampiran dan persetujuan Admin.
- Dashboard statistik, monitoring kehadiran, konfigurasi lokasi & shift, ekspor CSV/XLSX.
- Audit log untuk aksi administratif.

### Tidak termasuk (rilis pertama)

- Face recognition / liveness detection.
- Payroll, lembur, saldo cuti, dan integrasi penggajian.
- Absensi offline.
- Aplikasi native iOS terpisah (Expo mendukung iOS, peluncuran iOS keputusan produk).
- Role Supervisor/Manager (lihat **OPEN-13**).
- Multi-lokasi (lihat **OPEN-07**).

---

## 3. Pengguna dan Role

| Role | Platform | Hak |
| :--- | :--- | :--- |
| **Karyawan** (`EMPLOYEE`) | Aplikasi Expo (Android utama, iOS & web untuk pengujian) | Clock-In/Out, riwayat, pengajuan izin, profil |
| **Admin/HRD** (`ADMIN`) | Web Dashboard (React + Tailwind) | Statistik, monitoring, karyawan, perangkat, lokasi, shift, approval, ekspor, audit log |

Role bersifat *additive-ready*; penambahan role baru tidak boleh merusak aturan otorisasi yang ada.

---

## 4. Alur Utama

### 4.1 Login dan registrasi perangkat (karyawan)

1. Karyawan memasukkan email & password.
2. Aplikasi membuat/membaca `deviceIdentifier` lokal (UUID tersimpan aman di perangkat).
3. Server memvalidasi kredensial dan status akun.
4. Jika akun belum memiliki perangkat aktif → perangkat didaftarkan otomatis dan dicatat di audit log (**PROPOSED**, lihat **D-009**).
5. Jika perangkat berbeda → ditolak `403 DEVICE_NOT_AUTHORIZED`; karyawan menghubungi Admin.
6. Admin dapat mereset perangkat; seluruh sesi akun dicabut dan aksi dicatat di audit log.

### 4.2 Clock-In

1. Aplikasi meminta izin lokasi dan kamera.
2. Aplikasi memperoleh koordinat + akurasi + flag `mocked`.
3. Kamera depan terbuka; foto diambil dari kamera aplikasi (tidak ada akses galeri).
4. Aplikasi mengirim multipart: `photo`, `latitude`, `longitude`, `accuracy`, `mocked`, `shiftId` (shift aktif yang dipilih karyawan).
5. Server memvalidasi: autentikasi, perangkat, shift, jendela waktu, radius, akurasi, mock location, duplikasi.
6. Server menetapkan `clock_in_at` dari waktu server dan menyimpan foto ke object storage privat.
7. Respons berisi status (`PRESENT`/`LATE`), menit keterlambatan, dan waktu server.

### 4.3 Clock-Out

1. Validasi sama seperti Clock-In, termasuk **radius kantor yang sama** (keputusan terkonfirmasi).
2. Server memastikan ada Clock-In sah pada shift yang sama dan belum ada Clock-Out. Clock-Out masih diterima selama grace period setelah jam selesai shift (default 240 menit).
3. `clock_out_at` dari waktu server; selisih pulang lebih awal dihitung untuk laporan.

### 4.4 Pengajuan izin/cuti/sakit

1. Karyawan memilih jenis, tanggal mulai/selesai, alasan, dan lampiran opsional.
2. Server memvalidasi tanggal, tumpang tindih, dan file.
3. Status awal `PENDING`; Admin menyetujui/menolak dengan catatan.
4. Keputusan menyimpan `reviewed_by`, `reviewed_at`, `review_note` dan audit log.
5. Karyawan dapat membatalkan pengajuan yang masih `PENDING` (`CANCELLED`).

### 4.5 Admin

- Melihat statistik harian yang dihitung backend.
- Memfilter monitoring berdasarkan tanggal, nama, status, shift.
- Melihat foto dan koordinat sesuai kewenangan.
- Mengubah lokasi/radius, shift, dan data karyawan.
- Mengekspor laporan periode tertentu.

---

## 5. Kebutuhan Fungsional

Prioritas: **W** = wajib, **S** = seharusnya, **B** = baik jika ada.

| ID | Kebutuhan | Prioritas |
| :--- | :--- | :--- |
| F-01 | Login email/password dengan bcrypt dan pesan error yang aman | W |
| F-02 | Access token + refresh token, logout mencabut sesi | W |
| F-03 | Satu akun aktif pada satu perangkat terverifikasi | W |
| F-04 | Admin dapat mereset perangkat + audit log | W |
| F-05 | Clock-In dengan validasi radius server-side (default 50 m) | W |
| F-06 | Clock-Out wajib pada radius yang sama | W |
| F-07 | Foto selfie wajib, hanya dari kamera aplikasi | W |
| F-08 | Penolakan jika mock location terdeteksi | W |
| F-09 | Penolakan jika akurasi GPS melebihi batas | W |
| F-10 | Waktu absensi sepenuhnya dari server | W |
| F-11 | Pencegahan absensi ganda per karyawan/shift/tanggal | W |
| F-12 | Dukungan 3 shift/24 jam dengan toleransi 15 menit | W |
| F-13 | Riwayat kehadiran karyawan (harian, per shift) | W |
| F-14 | Pengajuan izin/cuti/sakit + lampiran | W |
| F-15 | Approval/penolakan dengan catatan dan audit | W |
| F-16 | Dashboard statistik dari data backend | W |
| F-17 | Konfigurasi lokasi kantor & radius | W |
| F-18 | Konfigurasi shift (nama, jam, toleransi) melalui dashboard Admin | W |
| F-19 | Monitoring kehadiran + filter tanggal/nama/status | W |
| F-20 | Pratinjau foto & koordinat absensi | W |
| F-21 | Ekspor CSV dan XLSX dengan proteksi formula injection | W |
| F-22 | Audit log aksi administratif | S |
| F-23 | Pencarian & pagination pada tabel besar | S |
| F-24 | Indikator shift aktif berikutnya di aplikasi karyawan | B |

---

## 6. Aturan Bisnis

### Terkonfirmasi

| ID | Aturan |
| :--- | :--- |
| BR-01 | Jam kerja memakai **3 shift dalam 24 jam**; nama, jam mulai/selesai, dan toleransi setiap shift **dapat diatur Admin** melalui dashboard (D-016). |
| BR-02 | Toleransi keterlambatan **15 menit** setelah jam mulai shift. |
| BR-03 | Clock-Out wajib di dalam radius kantor yang sama dengan Clock-In. |
| BR-04 | Hanya **satu lokasi kantor aktif** pada rilis pertama. |
| BR-05 | Radius default 50 meter, dapat diubah Admin. |
| BR-06 | Tanggal kerja (`work_date`) mengikuti tanggal mulai shift pada zona waktu kantor. |
| BR-07 | Status `ABSENT` tidak disimpan sebagai baris absensi; dihitung di laporan untuk shift yang sudah berakhir tanpa absensi dan tanpa izin disetujui. |
| BR-08 | Karyawan **memilih shift saat Clock-In** dari daftar shift aktif; shift terpilih menentukan jendela absensi, perhitungan keterlambatan, dan kunci anti-duplikasi (D-017). |

### Belum final (OPEN)

| ID | Pertanyaan | Usulan |
| :--- | :--- | :--- |
| OPEN-01 | ~~Jam pasti 3 shift~~ **Dijawab (D-016)** | Shift 1 08:00–15:00, Shift 2 15:00–22:00, Shift 3 22:00–08:00 (lintas tengah malam) |
| OPEN-02 | ~~Penugasan shift~~ **Dijawab (D-017)** | Karyawan memilih shift saat Clock-In |
| OPEN-03 | Clock-In lebih awal | Diizinkan maksimal 120 menit sebelum shift |
| OPEN-04 | Hari libur nasional | Tabel hari libur dikelola Admin (rilis berikutnya) |
| OPEN-05 | Lembur | Tidak dihitung |
| OPEN-06 | Saldo & jenis cuti | Belum ada saldo; jenis: SAKIT, CUTI, IZIN, LAINNYA |
| OPEN-07 | Multi-lokasi | Satu lokasi aktif (arsitektur siap dikembangkan) |
| OPEN-08 | Kebijakan GPS buruk | Tolak jika akurasi > 100 m |
| OPEN-09 | Izin ditolak / kamera ditolak | Tidak ada absensi manual; tampilkan panduan |
| OPEN-10 | Absensi offline | Tidak diizinkan |
| OPEN-11 | Batas absensi shift malam | Clock-In shift malam lintas tengah malam mengikuti tanggal mulai shift |
| OPEN-12 | Retensi data | Foto 90 hari, record absensi 5 tahun (belum diotomasi) |
| OPEN-13 | Role Supervisor/Manager | Belum diimplementasikan |
| OPEN-14 | ~~Shift dipilih di aplikasi atau ditetapkan Admin~~ **Dijawab (D-017)** | Karyawan memilih shift saat Clock-In |
| OPEN-15 | Skala awal | < 100 karyawan, < 1.000 absensi/hari |

---

## 7. Kebutuhan Non-Fungsional

| Aspek | Target |
| :--- | :--- |
| Keamanan | bcrypt, JWT, HTTPS di produksi, least privilege, validasi server, rate limiting, audit log |
| Privasi | Lokasi diambil hanya saat absensi; foto privat; akses terbatas; retensi terdokumentasi |
| Kinerja | Respons API p95 < 500 ms untuk operasi normal; halaman tabel < 2 detik |
| Keandalan | Transaksi database untuk Clock-In/Out; idempotensi; backup harian teruji |
| Keterpeliharaan | Pemisahan modul, TypeScript strict, pengujian otomatis, dokumentasi |
| Kompatibilitas | Android (target utama), iOS via Expo, web modern (Chrome/Edge/Firefox/Safari terbaru) |
| Aksesibilitas | Kontras memadai, label form, target sentuh ≥ 44 px |

---

## 8. Kriteria Penerimaan Produk

1. Karyawan dapat login, melakukan Clock-In/Out sah, dan melihat riwayatnya.
2. Absensi di luar radius, dengan mock location, atau akurasi buruk selalu ditolak server.
3. Absensi ganda pada shift yang sama tidak pernah menghasilkan dua record.
4. Admin dapat mengubah lokasi/radius/shift dan perubahan langsung berlaku tanpa update aplikasi.
5. Statistik dashboard sama dengan hasil agregasi database.
6. Approval izin tersimpan lengkap dengan reviewer, waktu, catatan, dan audit log.
7. Ekspor CSV/XLSX dapat dibuka dan tidak rentan formula injection.
8. Endpoint privat menolak akses tanpa token atau dengan role salah.

---

## 9. Asumsi dan Ketergantungan

- Perangkat karyawan memiliki GPS dan kamera yang berfungsi.
- Karyawan memberi izin lokasi presisi dan kamera.
- Server produksi memakai HTTPS dan zona waktu kantor `Asia/Jakarta` (dapat diubah Admin).
- Object storage mendukung S3-compatible API untuk produksi.
- Batasan yang diakui: deteksi mock location bergantung pada platform dan tidak menjamin penangkalan seluruh bentuk spoofing; selfie bukan verifikasi biometrik.
