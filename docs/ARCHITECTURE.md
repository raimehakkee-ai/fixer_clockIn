# Arsitektur Sistem — Aplikasi Absensi

| Item | Keterangan |
| :--- | :--- |
| Versi | 1.0 (Fase 1) |
| Status | Draft untuk ditinjau |
| Keputusan terkait | [DECISIONS](./DECISIONS.md) |

---

## 1. Prinsip

1. **Server adalah sumber kebenaran.** Waktu, jarak, status keterlambatan, role, dan keputusan persetujuan dihitung di backend.
2. **Klien tidak dipercaya.** Koordinat, akurasi, flag mock, dan identitas perangkat selalu divalidasi ulang.
3. **Satu jalur data.** Mobile dan web hanya berkomunikasi melalui REST API; database dan storage tidak diekspos.
4. **Bertahap dan dapat diuji.** Setiap fase menghasilkan kriteria selesai dan pengujian yang dijalankan.
5. **Rahasia tidak masuk repository.** Semua konfigurasi sensitif melalui environment variable.
6. **Ketergantungan pada stack repo.** Repository sudah memakai Expo; Flutter tidak ditambahkan (lihat **D-001**).

---

## 2. Diagram Konteks

```
┌────────────────────┐        HTTPS/JSON         ┌──────────────────────┐
│  Mobile Karyawan   │  ───────────────────────▶ │                      │
│  Expo SDK 58       │  ◀─────────────────────── │   REST API           │
│  (Android/iOS/web) │        multipart foto     │   Express 5           │
└────────────────────┘                           │   /api/v1             │
                                                 │                      │
┌────────────────────┐        HTTPS/JSON         │   • Auth & perangkat │
│  Web Admin         │  ───────────────────────▶ │   • Absensi          │
│  React + Tailwind  │  ◀─────────────────────── │   • Izin/cuti        │
│  (Vite)            │        CSV/XLSX           │   • Laporan & audit  │
└────────────────────┘                           └──────────┬───────────┘
                                                            │ Prisma
                                                 ┌──────────▼───────────┐
                                                 │ PostgreSQL           │
                                                 │ (data transaksional) │
                                                 └──────────────────────┘
                                                            │
                                                 ┌──────────▼───────────┐
                                                 │ Object Storage       │
                                                 │ privat (S3-compat)   │
                                                 │ foto & lampiran      │
                                                 └──────────────────────┘
```

---

## 3. Komponen

### 3.1 Aplikasi mobile (`src/`)

- Expo Router dengan grup terproteksi: `(auth)` dan `(app)`.
- Modul: sesi & penyimpanan token aman, klien API, lokasi, kamera, absensi, riwayat, izin, profil.
- Native modules: `expo-camera`, `expo-location` (termasuk `LocationObject.mocked`), `expo-secure-store`, `expo-crypto`, `expo-document-picker`.
- Tidak ada kamera galeri untuk selfie absensi; kamera hanya `CameraView` internal.

### 3.2 Web Admin (`admin/`)

- Vite + React 19 + TypeScript + Tailwind CSS v4.
- React Router untuk halaman, React Query untuk fetching/polling.
- Foto diambil melalui endpoint ber-otorisasi (Bearer token), bukan URL publik.

### 3.3 API (`server/`)

- Express 5, struktur per modul: `auth`, `devices`, `employees`, `office-locations`, `shifts`, `attendance`, `leave-requests`, `reports`, `audit-logs`.
- Lapisan: route → validation (Zod) → service (aturan bisnis) → data (Prisma).
- Middleware: `auth`, `requireRole`, `rateLimit`, `upload`, `requestId`, `errorHandler`.
- Logging terstruktur tanpa data sensitif; setiap error memiliki `code` dan `requestId`.

### 3.4 Database

- PostgreSQL, migrasi terversi melalui Prisma Migrate.
- Skema dan konvensi: lihat [DATABASE](./DATABASE.md).
- Semua timestamp UTC; tanggal kerja dihitung pada zona waktu kantor.

### 3.5 Penyimpanan file

- Interface `StorageDriver { save, read, delete }`.
- `local` untuk development; `s3` untuk produksi (bucket privat).
- Kunci objek acak (UUID), bukan nama file pengguna.
- Akses hanya via API dengan otorisasi pemilik/Admin; tidak ada URL publik permanen.

---

## 4. Alur Clock-In (urutan)

```
Mobile            API                          DB / Storage
  │  POST clock-in  │                              │
  ├────────────────▶│ 1. auth + device check       │
  │                 ├─────────────────────────────▶│
  │                 │ 2. validasi input (Zod)      │
  │                 │ 3. ambil office + shift      │
  │                 ├─────────────────────────────▶│
  │                 │ 4. tolak mock/low accuracy   │
  │                 │ 5. hitung Haversine & radius │
  │                 │ 6. simpan foto (privat)      │
  │                 ├─────────────────────────────▶│ storage
  │                 │ 7. transaksi create record   │
  │                 ├─────────────────────────────▶│ unique(user,date,shift)
  │◀────────────────┤ 201 {status, lateMinutes}    │
```

Penolakan dilakukan **sebelum** record dibuat; foto yang sudah terlanjur diunggah pada request gagal dihapus kembali.

---

## 5. Batas Kepercayaan (Trust Boundary)

| Data | Dikirim klien | Divalidasi/dihitung server |
| :--- | :--- | :--- |
| Waktu absensi | ❌ tidak dipakai | `new Date()` server |
| Koordinat & akurasi | ✅ | Rentang nilai, jarak, batas akurasi |
| Flag `mocked` | ✅ (petunjuk) | Ditolak jika `true`; disimpan untuk audit |
| Jarak ke kantor | ❌ | Haversine dari konfigurasi kantor |
| Status terlambat | ❌ | Jam shift + toleransi 15 menit |
| Role | ❌ | Dari token & database |
| Device identifier | ✅ | Dicocokkan dengan `devices` milik akun |
| Keputusan approval | ❌ | Endpoint Admin + audit |

---

## 6. Struktur Repository

```
dfixer_clockIn/
├── src/                     Expo — aplikasi karyawan
├── admin/                   Vite — dashboard Admin
├── server/                  Express + Prisma — API
│   ├── prisma/              schema, migrations, seed
│   ├── src/                 routes, services, middleware, lib
│   └── tests/               unit & integrasi
├── docs/                    dokumen ini
└── infra/                   Nginx, systemd, dan skrip operasional
```

Proyek tidak memakai npm workspaces agar Metro/Expo tidak terpengaruh hoisting; setiap proyek memiliki `package.json` sendiri.

---

## 7. Lingkungan

| Lingkungan | Database | Storage | Catatan |
| :--- | :--- | :--- | :--- |
| Development | PostgreSQL lokal (`prisma dev`) atau PostgreSQL yang sudah berjalan | `local` | Seed data demo |
| Test | Database terpisah, dibuat ulang per run | `local` sementara | Tidak memakai data produksi |
| Production | PostgreSQL terkelola/VPS | S3-compatible privat | HTTPS, backup harian |

File `.env` tidak di-commit. Contoh variabel disediakan di `.env.example`.

---

## 8. Error, Logging, dan Idempotensi

### Format error

```json
{
  "error": {
    "code": "OUT_OF_RANGE",
    "message": "Anda berada di luar radius kantor.",
    "details": { "distanceMeters": 84.2, "radiusMeters": 50 }
  },
  "requestId": "req_01J..."
}
```

- Tidak ada stack trace atau detail internal pada respons produksi.
- Status HTTP: 400 validasi, 401 unauthenticated, 403 unauthorized/device, 404, 409 konflik, 422 aturan bisnis, 429 rate limit, 500 error tak terduga.

### Idempotensi

- Constraint unik `(employee_id, work_date, shift_id)` mencegah record ganda.
- Clock-Out memakai update kondisional `WHERE clock_out_at IS NULL` untuk mencegah dua request bersamaan berhasil.
- Header opsional `Idempotency-Key` **belum** menyimpan respons; masih PROPOSED.
- Retry Clock-In yang sama mengembalikan `409 ALREADY_CLOCKED_IN` tanpa membuat baris baru.

### Logging

- `requestId` di setiap request dan log.
- Tidak mencatat password, token, koordinat presisi, atau isi file.
- Audit log terpisah untuk aksi administratif dan perangkat.

---

## 9. Deployment Produksi (rencana)

```
Internet ──▶ Nginx (TLS, rate limit dasar)
              ├── /          → admin (static build)
              ├── /api/      → Node API (systemd/pm2, port lokal)
              └── /uploads/  → TIDAK diekspos
                              PostgreSQL (localhost/private network)
                              S3-compatible (bucket privat)
```

- API dan database berjalan dengan user non-root.
- Firewall hanya membuka 80/443.
- Backup database harian + uji restore berkala.
- Monitoring: healthcheck `/api/v1/health`, log rotasi, alert disk/CPU.

---

## 10. Keterbatasan Arsitektur

1. Deteksi mock location bergantung pada platform dan hanya tersedia di perangkat native, bukan web.
2. Selfie tidak memverifikasi identitas biometrik.
3. Satu lokasi aktif membatasi perusahaan multi-cabang sampai keputusan berikutnya.
4. Antrian offline tidak ada; absensi memerlukan koneksi.
5. Pengujian perangkat nyata (kamera, GPS, mock) tidak dapat dilakukan di lingkungan pengembangan ini dan harus dijalankan pada perangkat Android/iOS.
