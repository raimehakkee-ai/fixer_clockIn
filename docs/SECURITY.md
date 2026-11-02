# Keamanan dan Privasi

| Item | Keterangan |
| :--- | :--- |
| Versi | 1.0 (Fase 1) |
| Status | Rancangan — kontrol baru berlaku setelah diimplementasikan dan diuji |
| Terkait | [API](./API.md), [DATABASE](./DATABASE.md), [TEST_PLAN](./TEST_PLAN.md) |

---

## 1. Klasifikasi Data

| Data | Sensitivitas | Penyimpanan | Akses |
| :--- | :--- | :--- | :--- |
| Password | Kritis | Hanya hash bcrypt | Tidak pernah dibaca/dikirim |
| Refresh token | Kritis | Hash SHA-256 di DB | Tidak pernah dikembalikan lagi |
| JWT secret | Kritis | Environment variable | Proses server saja |
| Foto selfie absensi | Pribadi | Object storage privat | Pemilik + Admin |
| Koordinat absensi | Pribadi | DB | Pemilik + Admin |
| Lampiran izin | Pribadi | Object storage privat | Pemilik + Admin |
| Data kehadiran | Internal | DB | Pemilik + Admin |
| Audit log | Internal | DB | Admin |

---

## 2. Model Ancaman dan Kontrol

| Ancaman | Dampak | Kontrol |
| :--- | :--- | :--- |
| Fake GPS / mock location | Absensi dari lokasi palsu | `LocationObject.mocked` di klien + penolakan server + audit `CLOCK_IN_REJECTED`/`CLOCK_OUT_REJECTED`; `risk_flags` untuk anomali pada record yang diterima |
| Replay request absensi | Absensi ganda | Unique `(employee, work_date, shift)` + validasi status + idempotency key |
| Manipulasi waktu perangkat | Jam absensi palsu | Timestamp hanya dari server; waktu klien diabaikan |
| Manipulasi koordinat/jarak | Absensi di luar radius | Server menghitung Haversine dari konfigurasi kantor |
| Pencurian token | Akses tidak sah | Access 15 menit, refresh rotasi, hash di DB, pencabutan sesi, HTTPS |
| IDOR (akses data orang lain) | Kebocoran data | Filter `employee_id` dari token, cek kepemilikan, 404 untuk resource asing |
| Credential stuffing | Pengambilalihan akun | bcrypt, rate limit login, pesan error seragam, audit kegagalan |
| Upload berbahaya | RCE / XSS / penyimpanan ilegal | Allow-list MIME, magic bytes, batas 5 MB, nama file UUID, tidak dieksekusi, disajikan dengan `Content-Disposition`/tipe aman |
| CSV/XLSX formula injection | Eksekusi formula di spreadsheet | Prefix `'` untuk sel berawalan `= + - @ TAB CR` |
| Akses file langsung | Foto publik | Bucket privat; endpoint ber-otorisasi; tidak ada static serve direktori upload |
| Eskalasi role | Admin palsu | Role dari DB/token, `requireRole`, tidak menerima role dari body |
| Log bocor | Data pribadi terekspos | Redaksi token/password/koordinat; log terstruktur |
| Insider Admin | Penyalahgunaan akses | Least privilege, audit log, tidak ada akses langsung DB dari internet |
| Serangan brute force sesi | Beban server | Rate limit endpoint sensitif, timeout, monitoring |

---

## 3. Autentikasi dan Sesi

- Password: bcrypt cost 12; minimal 8 karakter dengan huruf dan angka (validasi).
- Access token JWT 15 menit; refresh 30 hari dengan rotasi setiap pemakaian.
- Refresh token disimpan sebagai hash SHA-256; token lama langsung dicabut saat rotasi.
- Logout mencabut sesi; reset perangkat mencabut semua sesi akun.
- Akun nonaktif (`is_active = false`) ditolak pada login dan pada `auth` middleware.
- Pesan login gagal seragam: "Email atau password salah" (tidak membocorkan keberadaan akun).
- Token tidak disimpan di log, URL, atau query string.
- Mobile menyimpan token di `expo-secure-store`; web memakai penyimpanan browser dengan catatan risiko XSS (CSP diperlukan di produksi).

---

## 4. Pengikatan Perangkat

- Identifier perangkat dibuat acak dan disimpan aman di perangkat; server menyimpan hash-nya.
- Maksimal satu perangkat `ACTIVE` per karyawan (unique index parsial).
- Login pertama mendaftarkan perangkat dan menulis audit `DEVICE_REGISTERED` (PROPOSED, D-009).
- Perangkat berbeda → `403 DEVICE_NOT_AUTHORIZED`.
- Admin mereset perangkat → audit `DEVICE_RESET` + seluruh sesi dicabut.
- **Keterbatasan yang diakui:** identifier dapat berubah saat reinstall/OS reset dan dapat dipalsukan pada perangkat yang di-root. Ini bukan bukti identitas absolut. Play Integrity/App Attest adalah penguatan masa depan, bukan bagian rilis ini.

---

## 5. Validasi Absensi

1. Autentikasi + role + status akun + perangkat aktif.
2. Validasi skema (Zod) untuk semua field.
3. Tolak `mocked = true` → `422 MOCK_LOCATION`.
4. Tolak `accuracy > ACCURACY_LIMIT_M` (default 100 m) → `422 LOW_ACCURACY` (nilai final menunggu OPEN-08).
5. Hitung jarak dengan Haversine; tolak di luar radius → `422 OUT_OF_RANGE`.
6. Validasi jendela shift; tolak di luar jendela.
7. Simpan foto setelah validasi; hapus bila transaksi gagal.
8. Semua field audit (koordinat, akurasi, jarak, flag mock, IP) disimpan untuk pemeriksaan.
9. Unique constraint mencegah duplikasi; retry menghasilkan `409`, bukan record baru.

> Deteksi mock location tidak menangkap seluruh metode spoofing (mis. manipulasi level sistem pada perangkat yang di-root). False positive ditangani dengan prosedur eskalasi ke Admin, bukan dengan mematikan pemeriksaan.

---

## 6. File dan Object Storage

- Bucket privat; tidak ada ACL publik.
- Kunci objek: `<prefix>/<uuid>.<ext>`; nama asli pengguna tidak dipakai.
- Validasi isi file dengan magic bytes (JPEG `FF D8 FF`, PNG `89 50 4E 47`, PDF `%PDF-`).
- Maksimum 5 MB per file; satu file per request absensi.
- Foto absensi hanya dapat diambil melalui API dengan Bearer token pemilik/Admin.
- Header respons: `Cache-Control: private, max-age=300`, `Content-Type` dari MIME tervalidasi, `X-Content-Type-Options: nosniff`, `Content-Disposition: inline` untuk gambar dan `attachment` untuk PDF lampiran.
- Lampiran izin dapat diunduh hanya oleh pemilik/Admin.
- Retensi dan penghapusan mengikuti keputusan OPEN-12.

---

## 7. API Hardening

- `helmet` (CSP, HSTS di produksi, `nosniff`, frame deny).
- CORS allow-list dari environment; tidak memakai `*` dengan kredensial.
- Body JSON maksimum 1 MB; multipart 5 MB.
- Rate limit pada login, refresh, absensi, pengajuan, dan ekspor; batas login/refresh per IP dapat dikonfigurasi agar tidak memblokir pergantian shift di jaringan NAT kantor.
- Validasi seluruh input (Zod) termasuk query dan parameter path.
- Prisma/parameterized query; tidak ada SQL string concatenation.
- Error produksi tanpa stack trace; `requestId` untuk korelasi.
- Respons tidak pernah memuat `password_hash`, token, atau metadata internal.
- Timeout request dan graceful shutdown.

---

## 8. Otorisasi

- `EMPLOYEE`: hanya data miliknya (`employee_id` dari token).
- `ADMIN`: data seluruh karyawan; tidak dapat melakukan Clock-In.
- Setiap endpoint Admin memakai `requireRole('ADMIN')`.
- Resource asing mengembalikan `404`, bukan `403`, untuk menghindari enumerasi.
- Perubahan role hanya melalui operasi database terkontrol (belum ada endpoint publik untuk mengubah role).

---

## 9. Audit Log

Dicatat minimal untuk:

- `LOGIN_SUCCESS`, `LOGIN_FAILED` (tanpa password), `LOGOUT`
- `DEVICE_REGISTERED`, `DEVICE_RESET`, `DEVICE_REVOKED`
- `EMPLOYEE_CREATED`, `EMPLOYEE_UPDATED`, `EMPLOYEE_STATUS_CHANGED`, `PASSWORD_RESET`
- `OFFICE_UPDATED`, `SHIFT_CREATED`, `SHIFT_UPDATED`
- `LEAVE_CREATED`, `LEAVE_APPROVED`, `LEAVE_REJECTED`, `LEAVE_CANCELLED`
- `EXPORT_DOWNLOADED`

Metadata tidak memuat token, password, atau isi file. Audit tidak dapat diubah melalui API.

---

## 10. Privasi

- Lokasi diambil hanya saat layar absensi aktif; tidak ada pelacakan latar belakang.
- Karyawan diberi penjelasan singkat sebelum meminta izin lokasi/kamera (UI).
- Foto dan koordinat hanya untuk keperluan absensi dan audit internal.
- Akses Admin dibatasi kebutuhan operasional.
- Retensi, penghapusan, dan permintaan subjek data mengikuti kebijakan perusahaan (OPEN-12).
- Kebijakan ini harus ditinjau terhadap peraturan perlindungan data yang berlaku sebelum produksi.

---

## 11. Checklist Sebelum Produksi

- [ ] Semua secret dari environment/secret manager, tidak ada di repository.
- [ ] HTTPS aktif dan HSTS.
- [ ] Database tidak dapat diakses dari internet.
- [ ] Bucket storage privat + versioning.
- [ ] Rate limit & CORS terverifikasi.
- [ ] Semua endpoint privat diuji tanpa token dan dengan role salah.
- [ ] Uji upload berbahaya (MIME palsu, file besar, PDF rusak).
- [ ] Uji IDOR (akses foto/pengajuan karyawan lain).
- [ ] Uji CSV injection pada ekspor.
- [ ] Backup otomatis + **uji restore** berhasil.
- [ ] Log tidak memuat token/password/koordinat presisi.
- [ ] Prosedur reset perangkat & eskalasi false positive terdokumentasi.
- [ ] Dependency audit (`npm audit`) ditinjau.
- [ ] Retensi data disetujui pemilik produk.

---

## 12. Penanganan Insiden (ringkas)

1. Identifikasi dan catat waktu, pengguna, endpoint, `requestId`.
2. Cabut sesi/perangkat terkait.
3. Nonaktifkan akun bila diperlukan (bukan hapus data).
4. Periksa audit log dan log server.
5. Perbaiki akar masalah, tambahkan tes regresi.
6. Laporkan sesuai kebijakan perusahaan.

---

## 13. Keterbatasan yang Diakui

- Tidak ada liveness/face verification; selfie bukan bukti biometrik.
- Deteksi mock location bergantung platform dan tidak tersedia di web.
- Perangkat yang di-root dapat memalsukan identitas perangkat.
- Web menyimpan token di browser; XSS pada admin berarti token dapat dicuri. CSP dan sanitasi wajib.
- Kontrol di dokumen ini baru berlaku setelah implementasi dan pengujian Fase 2–7.
