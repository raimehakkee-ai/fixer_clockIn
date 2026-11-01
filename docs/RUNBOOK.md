# Runbook Operasional

Panduan singkat untuk pengelola sistem (development & produksi).

---

## 1. Layanan

| Layanan | Port | Perintah (dev) |
| :--- | :--- | :--- |
| API | 4000 | `cd server && npm run dev` |
| Web Admin | 5173 | `cd admin && npm run dev` |
| Mobile web | 8081 | `npx expo start --web` |
| PostgreSQL (Prisma dev) | 51214 | `cd server && npm run db:local` |

Produksi: API di `127.0.0.1:4000` (systemd), Nginx 80/443, admin statis.

---

## 2. Mulai / Hentikan

```bash
# Database lokal
cd server && npx prisma dev --detach
npx prisma dev ls
npx prisma dev stop default

# API
cd server && npm run dev          # development
sudo systemctl start clockin-api  # produksi
sudo systemctl stop clockin-api

# Web Admin build
cd admin && npm run build
```

---

## 3. Health & Monitoring

```bash
curl -s http://localhost:4000/api/v1/health
# sehat:   {"ok":true,"db":"ok",...}
# DB mati: HTTP 503 {"ok":false,"db":"error",...}
```

- Pasang uptime check eksternal ke `/api/v1/health`.
- Alert bila 503 > 2 menit, error 5xx meningkat, disk > 80%, atau TLS < 14 hari.
- Log API: `journalctl -u clockin-api -f` (produksi) atau terminal dev.

---

## 4. Insiden Umum

| Gejala | Tindakan |
| :--- | :--- |
| Health 503 `db:error` | Cek PostgreSQL (`systemctl status postgresql`), `DATABASE_URL`, disk, dan koneksi. |
| API 500 berulang | Cek `journalctl`/log; catat `requestId` dari respons; periksa perubahan terakhir. |
| `DEVICE_NOT_AUTHORIZED` | Admin → Karyawan → **Reset Perangkat**. |
| Mock location terdeteksi | Minta karyawan menonaktifkan Fake GPS; bukan kegagalan sistem. |
| Akurasi GPS buruk | Ulangi di area terbuka; batas 100 m. |
| Di luar radius | Verifikasi koordinat/radius kantor; perbarui jika salah. |
| Ekspor 422 `EXPORT_TOO_LARGE` | Persempit periode/filter karyawan. |
| Ekspor 429 | Tunggu 1 jam (limit 10 unduhan/jam). |
| Foto tidak tampil | Cek storage (S3/kredensial/versioning) dan endpoint foto; cek log. |
| Admin terkunci | Buat/atur ulang Admin di server: `npm run admin:create -- email 'PasswordKuat123!'`. |
| Sesi terasa logout sendiri | Refresh token kedaluwarsa/dicabut; login ulang. |

---

## 5. Rotasi Secret

**JWT_ACCESS_SECRET**
1. Ganti nilai di `.env` produksi (secret baru ≥ 32 karakter).
2. Restart API → seluruh access/refresh token lama tidak berlaku (semua pengguna login ulang).
3. Lakukan pada jam sepi dan umumkan sebelumnya.

**Password database / kredensial S3**
1. Buat kredensial baru, uji koneksi dari staging.
2. Perbarui `.env`, restart API.
3. Cabut kredensial lama setelah verifikasi.

Jangan pernah menaruh secret di repository atau tiket.

---

## 6. Backup & Restore

- Backup harian: `infra/scripts/backup-postgres.sh` (cron).
- Restore: `infra/scripts/restore-postgres.sh <file>`.
- Prosedur lengkap dan verifikasi: [BACKUP](./BACKUP.md).
- **Restore belum diuji** di lingkungan pengembangan; wajib diuji di staging.

---

## 7. Update & Rollback

Lihat [DEPLOYMENT §9](./DEPLOYMENT.md#9-update--rollback).

Ringkas: `git pull` → `npm ci` → `prisma migrate deploy` → restart API →
rebuild admin → rsync. Simpan build admin bertimestamp untuk rollback.

---

## 8. Pemeriksaan Harian

- [ ] Health check hijau.
- [ ] Tidak ada lonjakan 5xx/429 di log.
- [ ] Backup semalam ada dan ukurannya wajar.
- [ ] Disk & memori aman.
- [ ] Pengajuan menunggu ditinjau.
- [ ] Sertifikat TLS masih valid.
