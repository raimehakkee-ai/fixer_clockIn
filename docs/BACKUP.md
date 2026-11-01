# Backup dan Restore

| Item | Keterangan |
| :--- | :--- |
| Cakupan | Database PostgreSQL + media privat (S3/local) |
| Skrip | `infra/scripts/backup-postgres.sh`, `infra/scripts/restore-postgres.sh` |
| Status | Skrip disediakan; **belum dieksekusi** di lingkungan pengembangan ini karena `pg_dump`/`psql` tidak tersedia |

---

## 1. Target

| Parameter | Usulan |
| :--- | :--- |
| RPO (kehilangan data maks.) | 24 jam (backup harian) |
| RTO (pemulihan) | 4 jam |
| Retensi backup database | 30 hari |
| Lokasi salinan | Bucket/objek terpisah dari VPS |

Target ini perlu disetujui pemilik produk sebelum produksi.

---

## 2. Backup Database

```bash
export DATABASE_URL='postgresql://…'
export BACKUP_DIR=/var/backups/clockin
export RETENTION_DAYS=30

./infra/scripts/backup-postgres.sh
```

- Hasil: `clockin-<UTC timestamp>.sql.gz`.
- Simpan salinan di lokasi terpisah (S3/bucket lain) dan enkripsi saat transit.
- Jadwalkan harian melalui cron/systemd timer, mis. `0 2 * * *`.

---

## 3. Backup Media

- **S3-compatible**: aktifkan versioning/replication pada bucket privat; salin lifecycle ke bucket backup.
- **Local (`uploads/`)**: arsipkan direktori beserta database pada waktu yang sama:
  `tar -czf uploads-<stamp>.tar.gz -C server uploads`.

Tanpa media, record absensi tetap ada tetapi foto/lampiran tidak dapat ditampilkan.

---

## 4. Restore

```bash
# 1. Hentikan API agar tidak ada penulisan baru
sudo systemctl stop clockin-api

# 2. Restore database
export DATABASE_URL='postgresql://…'
./infra/scripts/restore-postgres.sh /var/backups/clockin/clockin-<stamp>.sql.gz

# 3. Restore media (contoh lokal)
tar -xzf uploads-<stamp>.tar.gz -C server

# 4. Pastikan versi aplikasi cocok dengan migrasi
cd server && npx prisma migrate deploy

# 5. Jalankan API dan verifikasi
sudo systemctl start clockin-api
curl -s http://127.0.0.1:4000/api/v1/health
```

### Verifikasi pasca-restore

1. Health check `200`.
2. Login Admin dan karyawan uji.
3. Buka satu record absensi: foto masuk/keluar tampil.
4. Unduh rekap CSV dan cocokkan jumlah baris dengan periode uji.
5. Periksa audit log terakhir.
6. Jalankan `npm run smoke` terhadap staging (bukan produksi).

---

## 5. Uji Restore Berkala

- Lakukan **bulanan** ke database staging.
- Catat waktu mulai/selesai, ukuran backup, dan hasil verifikasi.
- Backup yang belum pernah diuji restore **tidak boleh** dianggap berhasil.

## 6. Keterbatasan Lingkungan Ini

`pg_dump` dan `psql` tidak terpasang, sehingga backup/restore tidak dapat dijalankan
atau diklaim berhasil pada fase ini. Skrip dan prosedur di atas harus diuji pada
staging/VPS sebelum produksi.
