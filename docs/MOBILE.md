# Aplikasi Mobile Karyawan (Expo)

| Item | Keterangan |
| :--- | :--- |
| Stack | Expo SDK 58, React Native 0.88, React 19, Expo Router |
| Platform | Android (utama), iOS, web (SPA untuk demo/pengujian) |
| Status | Fase 5b selesai — terhubung ke API yang sudah teruji |
| Dokumen terkait | [API](./API.md), [SECURITY](./SECURITY.md), [PRD](./PRD.md) |

---

## 1. Layar

| Route | Layar | Fungsi |
| :--- | :--- | :--- |
| `/sign-in` | Login | Email/password, registrasi perangkat pada login pertama |
| `/` | Absen | Jam server, pemilih shift, lokasi & jarak, kamera selfie, Clock-In/Out |
| `/history` | Riwayat | Absensi per bulan, status, jam masuk/keluar |
| `/leave` | Izin & Cuti | Daftar pengajuan dan statusnya |
| `/leave-new` | Form Izin | Jenis, tanggal, alasan, lampiran (modal) |
| `/profile` | Profil | Data karyawan, kantor, perangkat, shift, logout |

Route dilindungi dengan `Stack.Protected`: tanpa sesi hanya `/sign-in` yang tersedia.

---

## 2. Konfigurasi Environment

Buat `.env` di root repo (tidak di-commit):

```bash
EXPO_PUBLIC_API_URL=http://localhost:4000
```

- Web/dev lokal: `http://localhost:4000`.
- Perangkat fisik: gunakan IP LAN mesin server, mis. `http://192.168.1.10:4000`.
- Produksi: URL HTTPS API.

`.env` dibaca saat Metro start; restart `npx expo start` setelah mengubahnya.

---

## 3. Menjalankan

```bash
# Terminal 1 — database & API
cd server
npx prisma dev --detach        # atau PostgreSQL lokal yang sudah berjalan
npx prisma migrate deploy
npm run db:seed                # hanya sekali / saat reset data
npm run dev                    # http://localhost:4000/api/v1

# Terminal 2 — aplikasi
cd ..
npx expo start                 # tekan a / i / w
```

Akun demo (development): `budi@clockin.test` / `Employee123!` (lihat `server/README.md`).

---

## 4. Alur Absensi

1. **Login** — aplikasi membuat `deviceIdentifier` (UUID di SecureStore) dan mengirimkannya. Login pertama mengikat perangkat; perangkat lain ditolak sampai Admin mereset.
2. **Pilih shift** — aplikasi memilih shift yang sedang berjalan secara default; karyawan dapat mengganti. Jendela shift dan toleransi berasal dari server.
3. **Lokasi** — izin lokasi diminta; aplikasi menampilkan jarak ke kantor, akurasi GPS, dan status radius. Flag `mocked` dari `expo-location` memblokir absensi.
4. **Selfie** — kamera depan (`CameraView`) wajib; tidak ada akses galeri. Foto dikirim multipart.
5. **Kirim** — server tetap sumber kebenaran: radius Haversine, batas akurasi dari `accuracyLimitMeters`, mock location, jendela Clock-In, grace period Clock-Out, dan waktu server divalidasi ulang.
6. **Hasil** — status (`Hadir`/`Terlambat`), jam server, dan jarak ditampilkan; riwayat diperbarui.
7. **Batalkan izin** — pengajuan `PENDING` dapat dibatalkan dari tab Izin; status berubah menjadi `CANCELLED`.

---

## 5. Penyimpanan Sesi

- Native: `expo-secure-store` (Keychain/Keystore).
- Web: `localStorage` (dokumentasi risiko XSS; CSP wajib di produksi).
- Access token 15 menit; refresh otomatis sekali saat `401`, lalu retry request.
- Logout mencabut sesi di server dan menghapus penyimpanan lokal.

> Web dibangun sebagai **SPA** (`app.json` → `web.output: "single"`), bukan SSR.
> Seluruh layar berada di balik autentikasi dan status sesi baru diketahui di
> klien, sehingga SSR hanya menghasilkan hydration mismatch tanpa manfaat.

---

## 6. Izin Native (konfigurasi `app.json`)

- `expo-camera` — pesan izin kamera (Bahasa Indonesia), `recordAudioAndroid: false`.
- `expo-location` — pesan izin lokasi saat aplikasi digunakan.
- `expo-secure-store` — Android backup aman + `usesNonExemptEncryption: false` di iOS.
- `@react-native-community/datetimepicker` — pemilih tanggal native (web memakai input teks).

---

## 7. Pengujian yang Sudah Dilakukan

| Pemeriksaan | Hasil |
| :--- | :--- |
| `npm test` | 9 unit test logika tanggal kerja & window |
| `npx tsc --noEmit` | Lulus |
| `npx expo lint` | Lulus (0 error/warning) |
| `npx expo-doctor` | 20/20 pemeriksaan lulus |
| `npx expo export --platform web` | Berhasil — semua route ter-bundle |
| API (auth/admin/absensi/izin/laporan) | 151 smoke test lulus (lihat `server/README.md`) |

**Belum diuji:** perangkat Android/iOS nyata (kamera, GPS asli, mock location, shift malam). Lingkungan pengembangan ini tidak memiliki emulator/perangkat. Karena itu, klaim "siap produksi" belum dibuat.

---

## 8. Keterbatasan

1. Deteksi mock location berasal dari `LocationObject.mocked`; tidak tersedia di web dan tidak menangkap seluruh bentuk spoofing.
2. Kamera web memerlukan HTTPS/localhost dan izin browser.
3. Selfie bukan verifikasi biometrik.
4. Aplikasi memerlukan koneksi; tidak ada antrean absensi offline.
5. `@react-native-community/datetimepicker` memerlukan development build di beberapa konfigurasi; Expo Go mendukung modul yang dibundel SDK 58, tetapi pengujian penuh tetap disarankan lewat development build.

---

## 9. Troubleshooting

| Gejala | Penyebab / solusi |
| :--- | :--- |
| `Network request failed` | `EXPO_PUBLIC_API_URL` salah atau ponsel tidak satu jaringan; gunakan IP LAN, bukan `localhost`. |
| `DEVICE_NOT_AUTHORIZED` | Akun terikat perangkat lain; Admin perlu reset perangkat. |
| Kamera hitam | Izin kamera belum diberikan atau kamera dipakai aplikasi lain. |
| Absen diblokir "Di luar jendela shift" | Waktu server di luar jendela shift terpilih; pilih shift yang benar. |
| Absen diblokir "Akurasi GPS" | Tunggu fix GPS atau pindah ke area terbuka. |
| Izin lokasi ditolak permanen | Aktifkan lewat pengaturan perangkat; aplikasi menampilkan status. |
