# Panduan Karyawan — ClockIn

Panduan singkat penggunaan aplikasi absensi di Android/iOS.

---

## 1. Sebelum Mulai

- Pastikan HP memiliki GPS dan kamera depan yang berfungsi.
- Aktifkan **lokasi presisi** dan berikan izin kamera saat diminta.
- Aplikasi memerlukan koneksi internet.
- Satu akun hanya dapat aktif di **satu perangkat**. Jika berganti HP, hubungi Admin/HRD untuk reset perangkat.

---

## 2. Login

1. Buka aplikasi ClockIn.
2. Masukkan email dan password dari Admin.
3. Tekan **Masuk**.
4. Jika muncul pesan **“Akun ini terikat pada perangkat lain”**, hubungi Admin untuk reset perangkat.

Login pertama mendaftarkan perangkat Anda secara otomatis.

---

## 3. Melakukan Clock-In

1. Buka tab **Absen**.
2. Periksa **jam server** di bagian atas (bukan jam HP).
3. Pilih **shift** yang sesuai. Shift yang sedang berjalan dipilih otomatis:
   - Shift 1: 08:00–15:00
   - Shift 2: 15:00–22:00
   - Shift 3: 22:00–08:00
4. Tunggu bagian **Lokasi** menampilkan jarak dan akurasi. Tombol absen aktif jika:
   - Anda berada di dalam radius kantor,
   - akurasi GPS ≤ 100 m,
   - tidak terdeteksi aplikasi Fake GPS,
   - waktu masih dalam jendela shift.
5. Tekan **Ambil Selfie**, lalu **Kirim Absen Masuk**.
6. Status akan tampil: **Hadir** atau **Terlambat** (beserta menit keterlambatan).

> Foto diambil langsung dari kamera aplikasi; tidak dapat memilih dari galeri.

---

## 4. Clock-Out

1. Buka tab **Absen** pada shift yang sama.
2. Pastikan Anda masih berada di radius kantor.
3. Tekan **Ambil Selfie** lalu **Kirim Absen Keluar**.

Clock-Out di luar radius kantor akan ditolak.

---

## 5. Riwayat Kehadiran

- Tab **Riwayat** menampilkan absensi per bulan.
- Gunakan tombol ‹ › untuk berpindah bulan.
- Setiap kartu menampilkan tanggal, shift, jam masuk/keluar, status, dan menit terlambat.

---

## 6. Mengajukan Izin / Cuti / Sakit

1. Buka tab **Izin**, tekan **Ajukan**.
2. Pilih jenis: Sakit, Cuti, Izin, atau Lainnya.
3. Isi tanggal mulai dan selesai (format `YYYY-MM-DD`).
4. Tulis alasan minimal 10 karakter.
5. Lampirkan surat dokter/dokumen bila perlu (JPEG, PNG, atau PDF maks. 5 MB).
6. Tekan **Kirim Pengajuan**.

Status pengajuan: Menunggu → Disetujui/Ditolak. Pengajuan yang masih **Menunggu** dapat dibatalkan (hubungi Admin bila tombol tidak tersedia di versi Anda).

---

## 7. Profil

Tab **Profil** menampilkan data karyawan, kantor, perangkat terverifikasi, dan daftar shift. Gunakan tombol **Keluar** untuk logout.

---

## 8. Masalah Umum

| Masalah | Penyebab / solusi |
| :--- | :--- |
| “Akun ini terikat pada perangkat lain” | Admin perlu reset perangkat. |
| “Di luar jendela shift” | Pilih shift yang benar atau tunggu jendela shift. |
| “Akurasi GPS terlalu rendah” | Keluar dari gedung, tunggu GPS terkunci, tekan **Perbarui**. |
| “Anda berada di luar radius kantor” | Mendekat ke kantor; cek radius dengan Admin. |
| “Mock location terdeteksi” | Nonaktifkan aplikasi Fake GPS dan restart HP. |
| Aplikasi tidak bisa menghubungi server | Periksa internet; hubungi Admin bila berlanjut. |
| Kamera hitam | Tutup aplikasi lain yang memakai kamera; beri izin kamera. |

---

## 9. Privasi

- Lokasi hanya diambil saat layar Absen digunakan, bukan pelacakan terus-menerus.
- Foto dan koordinat hanya untuk keperluan absensi dan audit internal.
- Selfie bukan verifikasi biometrik; hanya bukti visual absensi.
