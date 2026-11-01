# Panduan Admin / HRD — ClockIn

Panduan penggunaan Web Dashboard (`https://absensi.example.com`).

---

## 1. Login

- Gunakan akun dengan role **Admin**.
- Akun karyawan tidak dapat masuk ke dashboard (gunakan aplikasi mobile).
- Sesi kedaluwarsa akan mengarahkan kembali ke halaman login.

---

## 2. Dashboard

| Kartu | Arti |
| :--- | :--- |
| Total Karyawan | Karyawan aktif |
| Hadir | Karyawan dengan absensi, tidak terlambat |
| Terlambat | Karyawan dengan minimal satu absensi terlambat |
| Izin / Cuti | Pengajuan disetujui yang mencakup tanggal tersebut dan belum absen |
| Tanpa Keterangan | Karyawan aktif yang tidak hadir/terlambat/izin |
| Pengajuan Menunggu | Pengajuan `PENDING` yang perlu diputuskan |

Kategori dihitung saling eksklusif oleh backend. Data diperbarui otomatis
setiap 15–30 detik.

---

## 3. Monitoring Kehadiran

- Filter berdasarkan tanggal, nama/NIK, shift, dan status.
- Klik **Detail** untuk melihat:
  - foto masuk dan keluar (bila tersedia),
  - koordinat (tautan Google Maps), akurasi, dan jarak,
  - menit terlambat/pulang awal,
  - penanda mock location.
- Kolom **Mock** = `Terdeteksi` bila klien melaporkan mock location.

---

## 4. Persetujuan Izin/Cuti

1. Buka **Izin & Cuti**, pilih tab **Menunggu**.
2. Klik **Setujui** atau **Tolak**.
3. Catatan opsional untuk approve, **wajib** untuk reject (min. 3 karakter).
4. Lampiran dapat dilihat melalui tautan **Lihat**.

Hanya pengajuan `PENDING` yang dapat diputuskan. Aksi tercatat di audit log.

---

## 5. Karyawan

- **Cari** berdasarkan nama, NIK, atau email.
- **Karyawan Baru**: isi email, NIK, nama, password awal, departemen, jabatan, kantor.
- **Edit**: ubah nama/departemen/jabatan/kantor (email & NIK tidak diubah).
- **Nonaktifkan/Aktifkan**: akun nonaktif tidak dapat login; semua sesi dicabut.
- **Reset Password**: tetapkan password baru; semua sesi dicabut.
- **Reset Perangkat**: cabut perangkat aktif; karyawan dapat login dari perangkat baru.

Password minimal 8 karakter dan harus memuat huruf serta angka.

---

## 6. Lokasi & Shift

- Hanya **satu lokasi aktif**. Mengaktifkan lokasi lain menonaktifkan yang lama.
- Isi nama, latitude, longitude, radius (10–1000 m), dan zona waktu IANA
  (mis. `Asia/Jakarta`).
- Shift: nama, jam mulai/selesai, toleransi (menit), jendela Clock-In lebih awal,
  urutan, dan status aktif.
- Shift yang melewati tengah malam (mis. 22:00–08:00) ditandai **lintas hari**.
- Menonaktifkan shift tidak menghapus data absensi lama.

> Perubahan langsung berlaku pada absensi berikutnya tanpa update aplikasi.

---

## 7. Laporan

1. Pilih rentang tanggal dan format **CSV** atau **XLSX**.
2. **Unduh Rekap Absensi** atau **Unduh Rekap Izin**.
3. Unduhan memakai autentikasi Admin dan tercatat di audit log.

Batasan: maksimal 20.000 baris dan 10 unduhan per jam.
Rekap absensi berisi satu baris per record; angka hadir/absen ada di dashboard.

---

## 8. Audit Log

- Filter berdasarkan action (mis. `EXPORT_DOWNLOADED`), entity type, dan periode.
- Metadata dapat dibuka per baris.
- Audit bersifat append-only; tidak ada fitur hapus/ubah.

Aksi yang tercatat antara lain: login gagal/berhasil, registrasi/reset perangkat,
perubahan karyawan, reset password, perubahan shift/lokasi, approval izin,
dan unduhan laporan.

---

## 9. Hal yang Perlu Diperhatikan

- **Reset perangkat** dan **nonaktifkan akun** langsung memutus sesi aktif.
- Jangan memakai seed demo di produksi; Admin produksi dibuat via `npm run admin:create`.
- Perubahan radius terlalu kecil dapat menyulitkan karyawan; koordinasikan.
- Token Admin tersimpan di browser; gunakan perangkat tepercaya dan logout setelah selesai.
- Untuk laporan besar, persempit periode agar tidak melewati batas 20.000 baris.
