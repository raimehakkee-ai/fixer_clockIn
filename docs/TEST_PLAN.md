# Rencana Pengujian

| Item | Keterangan |
| :--- | :--- |
| Versi | 1.0 (Fase 1) |
| Status | Rencana — belum ada pengujian aplikasi yang dijalankan |
| Lingkup | Backend API, mobile Expo, web Admin, keamanan, operasional |

> **Pernyataan jujur:** pada Fase 1 hanya dokumen yang dibuat. Tidak ada tes otomatis maupun tes manual aplikasi yang dijalankan. Hasil tes akan dicatat per fase setelah implementasi.

---

## 1. Tingkat Pengujian

| Tingkat | Alat | Cakupan |
| :--- | :--- | :--- |
| Unit | Vitest (server), `tsc --noEmit` | Haversine, perhitungan shift/toleransi, work_date lintas tengah malam, sniff file, validasi skema, CSV escaping |
| Integrasi API | Vitest + Supertest + database uji | Auth, device binding, clock-in/out, izin, approval, otorisasi |
| End-to-end API | Skrip smoke (`server/scripts/smoke.mjs`) | Alur lengkap karyawan → admin dengan database seed |
| UI mobile | Manual + Expo web | Login, izin lokasi/kamera, tampilan riwayat, validasi form |
| UI Admin | Manual + build produksi | Dashboard, filter, approval, ekspor, form lokasi |
| Keamanan | Tes negatif + `npm audit` | Authz, IDOR, upload, rate limit, CSV injection |
| Operasional | Manual di VPS | Backup/restore, HTTPS, healthcheck, restart |

---

## 2. Lingkungan Uji

| Lingkungan | Database | Catatan |
| :--- | :--- | :--- |
| Local | PostgreSQL via `prisma dev` | Seed demo, storage lokal |
| CI (rencana) | PostgreSQL service container | `prisma migrate deploy`, tes paralel aman |
| Staging | PostgreSQL terpisah | Uji sebelum produksi, storage S3 staging |
| Produksi | — | Hanya smoke test, **tidak** menjalankan tes destruktif |

Data uji tidak boleh memakai database produksi. Setiap tes integrasi membersihkan data yang dibuatnya.

---

## 3. Matriks Kasus Uji

### 3.1 Autentikasi (AUTH)

| ID | Skenario | Ekspektasi |
| :--- | :--- | :--- |
| AUTH-01 | Login kredensial benar | `200`, token + user, tanpa `password_hash` |
| AUTH-02 | Password salah | `401 UNAUTHENTICATED`, pesan seragam |
| AUTH-03 | Akun nonaktif | `403 FORBIDDEN` |
| AUTH-04 | Login perangkat pertama | Perangkat `ACTIVE`, audit `DEVICE_REGISTERED` |
| AUTH-05 | Login perangkat berbeda | `403 DEVICE_NOT_AUTHORIZED` |
| AUTH-06 | Refresh token valid | Token baru, token lama tidak berlaku |
| AUTH-07 | Refresh token dicabut/kedaluwarsa | `401` |
| AUTH-08 | Logout | `204`, sesi dicabut, refresh gagal |
| AUTH-09 | `/auth/me` tanpa token | `401` |
| AUTH-10 | Admin login tanpa deviceIdentifier | `200` (perangkat tidak wajib untuk Admin) |

### 3.2 Perangkat (DEV)

| ID | Skenario | Ekspektasi |
| :--- | :--- | :--- |
| DEV-01 | Reset perangkat oleh Admin | Perangkat `REVOKED`, semua sesi dicabut, audit `DEVICE_RESET` |
| DEV-02 | Employee memanggil endpoint reset | `403` |
| DEV-03 | Registrasi ulang setelah reset | `201`, hanya satu perangkat `ACTIVE` |
| DEV-04 | Dua perangkat aktif bersamaan | Ditolak (unique parsial) |

### 3.3 Clock-In / Clock-Out (ATT)

| ID | Skenario | Ekspektasi |
| :--- | :--- | :--- |
| ATT-01 | Clock-In dalam radius, shift Pagi, akurasi baik | `201`, status `PRESENT` |
| ATT-02 | Clock-In dalam radius setelah 15 menit | `201`, status `LATE`, `lateMinutes` benar |
| ATT-03 | Clock-In di luar radius | `422 OUT_OF_RANGE`, tidak ada record |
| ATT-04 | `mocked=true` | `422 MOCK_LOCATION`, tidak ada record |
| ATT-05 | Akurasi 150 m | `422 LOW_ACCURACY` |
| ATT-06 | Foto tidak ada | `400 VALIDATION_ERROR` |
| ATT-07 | MIME `image/jpeg` tetapi isi bukan gambar | `400 VALIDATION_ERROR` (magic bytes) |
| ATT-08 | Foto > 5 MB | `400` |
| ATT-09 | Clock-In ganda shift sama | `409 ALREADY_CLOCKED_IN`, hanya 1 record |
| ATT-10 | Clock-In shift berbeda pada tanggal sama | `201` (record terpisah) |
| ATT-11 | Clock-In di luar jendela shift | `422 OUTSIDE_SHIFT_WINDOW` |
| ATT-12 | Karyawan tanpa shift | `422 SHIFT_NOT_ASSIGNED` |
| ATT-13 | Clock-Out tanpa Clock-In | `409 NOT_CLOCKED_IN` |
| ATT-14 | Clock-Out sah | `200`, `clockOutAt` dari server |
| ATT-15 | Clock-Out ganda | `409 ALREADY_CLOCKED_OUT` |
| ATT-16 | Clock-Out di luar radius | `422 OUT_OF_RANGE` |
| ATT-17 | Shift malam 23:00–07:00 | `work_date` = tanggal mulai, Clock-Out tetap pada record yang sama |
| ATT-18 | Waktu perangkat diubah | Tidak berpengaruh pada timestamp server |
| ATT-19 | Retry request identik | Tidak membuat record baru |
| ATT-20 | Foto karyawan A diakses karyawan B | `404` |

### 3.4 Izin/Cuti (LEAVE)

| ID | Skenario | Ekspektasi |
| :--- | :--- | :--- |
| LEAVE-01 | Pengajuan valid | `201 PENDING` |
| LEAVE-02 | `endDate < startDate` | `400` |
| LEAVE-03 | Alasan < 10 karakter | `400` |
| LEAVE-04 | Tanggal beririsan dengan pengajuan aktif | `409 LEAVE_OVERLAP` |
| LEAVE-05 | Lampiran PDF valid | `201`, file tersimpan privat |
| LEAVE-06 | Lampiran `.exe` dengan MIME palsu | `400` |
| LEAVE-07 | Karyawan melihat pengajuan orang lain | `404` |
| LEAVE-08 | Approve oleh Admin | `200`, reviewer/waktu/catatan tersimpan + audit |
| LEAVE-09 | Approve oleh Employee | `403` |
| LEAVE-10 | Approve pengajuan yang sudah diputuskan | `409` |
| LEAVE-11 | Reject tanpa catatan | `400` |
| LEAVE-12 | Cancel pengajuan `PENDING` | `200 CANCELLED` |
| LEAVE-13 | Cancel pengajuan `APPROVED` | `409` |

### 3.5 Admin & Laporan (ADM/REP)

| ID | Skenario | Ekspektasi |
| :--- | :--- | :--- |
| ADM-01 | Statistik hari ini | Angka sama dengan agregasi DB |
| ADM-02 | Filter tanggal + nama + status | Hasil sesuai filter, pagination benar |
| ADM-03 | Karyawan tanpa absensi & tanpa izin | Terhitung `ABSENT` |
| ADM-04 | Karyawan dengan izin `APPROVED` | Terhitung izin, bukan `ABSENT` |
| ADM-05 | Ubah lokasi/radius | Berlaku pada absensi berikutnya tanpa update aplikasi |
| ADM-06 | Ubah shift | Berlaku pada absensi berikutnya |
| ADM-07 | Akses Admin tanpa token | `401` |
| ADM-08 | Akses Admin dengan role EMPLOYEE | `403` |
| REP-01 | Ekspor CSV periode | `text/csv`, jumlah baris sesuai data |
| REP-02 | Ekspor XLSX periode | File terbuka di Excel/LibreOffice |
| REP-03 | Sel berisi `=HYPERLINK(...)` | Ditulis sebagai teks, bukan formula |
| REP-04 | Ekspor mencatat audit | `EXPORT_DOWNLOADED` tercatat |
| REP-05 | Periode tanpa data | File valid dengan header saja |

### 3.6 Keamanan (SEC)

| ID | Skenario | Ekspektasi |
| :--- | :--- | :--- |
| SEC-01 | Semua endpoint privat tanpa token | `401` |
| SEC-02 | IDOR foto/lampiran/pengajuan | `404` |
| SEC-03 | Body melebihi batas | `413`/`400` |
| SEC-04 | Login 11 kali gagal | `429` |
| SEC-05 | CORS origin tidak diizinkan | Ditolak |
| SEC-06 | Respons error produksi | Tanpa stack trace/secret |
| SEC-07 | Log server | Tidak memuat token/password/koordinat presisi |
| SEC-08 | `npm audit` | Tidak ada kerentanan kritis/tinggi tanpa mitigasi |

### 3.7 Mobile UI (UI-M)

| ID | Skenario | Ekspektasi |
| :--- | :--- | :--- |
| UI-M-01 | Login berhasil | Masuk ke layar Absen, token tersimpan aman |
| UI-M-02 | Izin lokasi ditolak | Pesan jelas, tombol absen nonaktif, ada tautan pengaturan |
| UI-M-03 | Izin kamera ditolak | Pesan jelas, tidak ada jalur galeri |
| UI-M-04 | Di luar radius | Jarak + radius tampil, tombol nonaktif |
| UI-M-05 | Mock location aktif | Banner peringatan, tombol nonaktif |
| UI-M-06 | Jam perangkat berbeda | Jam pada layar mengikuti server |
| UI-M-07 | Clock-In sukses | Status + jam server tampil |
| UI-M-08 | Riwayat | Daftar sesuai API, foto hanya milik sendiri |
| UI-M-09 | Ajukan izin dengan lampiran | Berhasil, status `PENDING` tampil |
| UI-M-10 | Jaringan terputus saat absen | Pesan gagal, tidak ada absensi palsu |

### 3.8 Admin UI (UI-A)

| ID | Skenario | Ekspektasi |
| :--- | :--- | :--- |
| UI-A-01 | Login non-admin | Ditolak dengan pesan jelas |
| UI-A-02 | Dashboard | Statistik + tabel real-time (polling) tampil |
| UI-A-03 | Detail absensi | Foto + koordinat + tautan peta |
| UI-A-04 | Approval | Status berubah tanpa reload manual |
| UI-A-05 | Form lokasi | Validasi rentang lat/lng/radius |
| UI-A-06 | Ekspor | File terunduh dengan nama dan periode benar |
| UI-A-07 | Sesi kedaluwarsa | Diarahkan ke login, bukan layar kosong |

---

## 4. Uji Perangkat Nyata (wajib sebelum rilis)

Tidak dapat dijalankan di lingkungan pengembangan ini:

1. Android: izin lokasi presisi, kamera, mock location aktif/nonaktif (aplikasi Fake GPS).
2. Android: perilaku saat GPS mati, akurasi buruk, di dalam gedung.
3. Android: shift malam (Clock-Out setelah tengah malam).
4. iOS: `LocationObject.mocked` saat simulasi lokasi Xcode.
5. Rotasi layar, ukuran layar kecil, mode gelap, font besar.
6. Reinstall aplikasi → perilaku identitas perangkat dan sesi.
7. Jaringan lambat/putus saat upload foto.

---

## 5. Target Non-Fungsional

| Metrik | Target |
| :--- | :--- |
| p95 respons API normal | < 500 ms |
| p95 upload foto 1 MB | < 2 s (jaringan lokal) |
| Waktu muat dashboard | < 2 s |
| Error rate 5xx | < 0,5% |
| Backup restore | Berhasil dan terverifikasi |

---

## 6. Kriteria Keluar (Exit Criteria)

Pengujian dianggap lulus jika:

1. Semua kasus **W** pada matriks di atas lulus.
2. Tidak ada bug kritis/tinggi terbuka.
3. Tes otomatis backend berjalan di CI (setelah Fase 7).
4. Build produksi admin berhasil dan bebas error TypeScript.
5. Uji perangkat nyata Android minimal satu perangkat lulus untuk alur utama.
6. Backup dan restore terbukti berhasil di staging.

---

## 7. Pelaporan Hasil

Setiap fase melaporkan dengan format AGENT.md:

```
FASE / STATUS
Perintah yang dijalankan:
Hasil aktual:
Status: LULUS / GAGAL / SEBAGIAN
Kendala:
Pekerjaan berikutnya:
```

Hasil tes tidak boleh dikarang. Tes yang tidak dapat dijalankan harus ditulis eksplisit sebagai "belum dijalankan" beserta alasannya.
