# Deployment

| Item | Keterangan |
| :--- | :--- |
| Status | Artefak dan simulasi lokal selesai; **belum** dideploy ke VPS/domain nyata |
| Target | Ubuntu 22.04/24.04, Nginx, Node.js 22, PostgreSQL 16, S3-compatible |
| Terkait | [BACKUP](./BACKUP.md), [SECURITY](./SECURITY.md), [ADMIN](./ADMIN.md) |

---

## 1. Topologi

```
Internet
  │ HTTPS (443)
  ▼
Nginx
  ├── /            → /var/www/clockin/admin (static SPA + CSP)
  ├── /api/        → 127.0.0.1:4000 (Node API, systemd)
  └── /uploads/    → deny
                       │
                       ├── PostgreSQL 127.0.0.1:5432 (tidak terekspos)
                       └── S3-compatible privat (foto/lampiran)
```

- API **tidak boleh** diekspos langsung; `TRUST_PROXY=1` mengandalkan Nginx.
- Port yang dibuka hanya 22 (dibatasi), 80, 443.

---

## 2. Prasyarat Server

```bash
sudo apt update
sudo apt install -y nginx postgresql postgresql-client certbot python3-certbot-nginx \
  ufw git curl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

Buat user sistem non-root:

```bash
sudo useradd --system --create-home --shell /bin/bash clockin
sudo mkdir -p /opt/clockin /var/www/clockin /var/backups/clockin
sudo chown -R clockin:clockin /opt/clockin /var/www/clockin /var/backups/clockin
```

Firewall:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## 3. Database

```bash
sudo -u postgres psql <<'SQL'
CREATE USER clockin WITH PASSWORD 'GANTI_PASSWORD_KUAT';
CREATE DATABASE clockin OWNER clockin;
SQL
```

Pastikan PostgreSQL hanya listen di `localhost` dan akses dari luar ditolak.
Simpan `DATABASE_URL` di environment API, bukan di repository.

---

## 4. Backend

```bash
sudo -u clockin git clone <repo-url> /opt/clockin
cd /opt/clockin/server
sudo -u clockin npm ci
cp .env.production.example .env.production
sudo -u clockin chmod 600 .env.production
```

Isi `.env.production` (contoh ada di repository):

- `JWT_ACCESS_SECRET` acak minimal 32 karakter (`openssl rand -base64 48`).
- `DATABASE_URL` user `clockin`.
- `CORS_ORIGIN=https://absensi.example.com`.
- `STORAGE_DRIVER=s3` + kredensial bucket privat.
- `TRUST_PROXY=1`.

Migrasi dan buat Admin pertama (jangan memakai seed demo di produksi):

```bash
cd /opt/clockin/server
set -a; source .env.production; set +a
sudo -u clockin --preserve-env npx prisma generate
sudo -u clockin --preserve-env npx prisma migrate deploy
sudo -u clockin --preserve-env npm run admin:create -- admin@perusahaan.com 'PasswordKuat123!'
```

Pasang service:

```bash
sudo cp /opt/clockin/infra/systemd/clockin-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now clockin-api
sudo systemctl status clockin-api
curl -s http://127.0.0.1:4000/api/v1/health
```

Health harus `{ "ok": true, "db": "ok" }`. Bila `503`, periksa `journalctl -u clockin-api`.

---

## 5. Web Admin

```bash
cd /opt/clockin/admin
sudo -u clockin npm ci
sudo -u clockin npm run build
sudo rsync -a --delete dist/ /var/www/clockin/admin/
sudo chown -R www-data:www-data /var/www/clockin/admin
```

`VITE_API_URL` dikosongkan karena admin dan API berada di origin yang sama.

---

## 6. Nginx & TLS

```bash
sudo cp /opt/clockin/infra/nginx/snippets/*.conf /etc/nginx/snippets/
sudo cp /opt/clockin/infra/nginx/clockin.conf /etc/nginx/sites-available/clockin.conf
sudo ln -s /etc/nginx/sites-available/clockin.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
```

Tambahkan zona limit pada blok `http {}` di `/etc/nginx/nginx.conf`:

```nginx
limit_req_zone $binary_remote_addr zone=clockin_api:10m rate=20r/s;
```

Uji dan aktifkan TLS:

```bash
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d absensi.example.com
```

Verifikasi header:

```bash
curl -sI https://absensi.example.com | grep -iE 'strict-transport|content-security|x-content-type|x-frame'
```

---

## 7. Backup & Restore

- Jadwalkan `infra/scripts/backup-postgres.sh` harian (cron/systemd timer), salin ke lokasi terpisah.
- Aktifkan versioning bucket S3 dan backup metadata.
- **Uji restore** ke staging minimal bulanan — lihat [BACKUP](./BACKUP.md).
- Backup yang belum pernah direstore tidak dianggap valid.

---

## 8. Monitoring & Log

- Healthcheck eksternal ke `https://…/api/v1/health` setiap 1–5 menit.
- `journalctl -u clockin-api` + logrotate/journald retention.
- Pantau CPU/RAM/disk, error rate 5xx, dan kegagalan backup.
- Alert bila health `503` (database) atau sertifikat TLS < 14 hari.

---

## 9. Update & Rollback

**Update:**

```bash
cd /opt/clockin
sudo -u clockin git pull --ff-only
cd server && sudo -u clockin npm ci
set -a; source .env.production; set +a
sudo -u clockin --preserve-env npx prisma migrate deploy
sudo systemctl restart clockin-api

cd ../admin && sudo -u clockin npm ci && sudo -u clockin npm run build
sudo rsync -a --delete dist/ /var/www/clockin/admin/
```

**Rollback:** checkout tag/commit sebelumnya, `npm ci`, `prisma migrate deploy` hanya jika migrasi kompatibel, restart API, deploy ulang admin. Simpan rilis admin bertimestamp agar bisa dikembalikan.

---

## 10. Simulasi Produksi Lokal (sudah dijalankan)

Karena lingkungan pengembangan tidak memiliki VPS/domain/TLS, produksi disimulasikan:

```bash
# 1. Database lokal
cd server && npx prisma dev --detach

# 2. API mode produksi
NODE_ENV=production CORS_ORIGIN=http://localhost:8080 TRUST_PROXY=1 \
STORAGE_DRIVER=local npx tsx src/index.ts

# 3. Build admin + server statis dengan proxy
cd ../admin && npm run build
cd ..
node infra/scripts/serve-static.mjs      # http://localhost:8080

# 4. Smoke produksi
node infra/scripts/production-smoke.mjs
```

Hasil: halaman admin, CSP, nosniff, deep link SPA, bundle JS, health + database,
login Admin, ringkasan, login salah (401), dan 404 API semuanya lulus.
Lihat laporan Fase 8 untuk angka aktual.

---

## 11. Checklist Go-Live

- [ ] DNS mengarah ke server, TLS valid.
- [ ] `.env.production` permission 600, secret acak, CORS produksi.
- [ ] Migrasi diterapkan, Admin pertama dibuat (bukan seed demo).
- [ ] API di belakang Nginx; port 4000 tidak terbuka.
- [ ] Bucket S3 privat + versioning; akses foto hanya via API.
- [ ] Backup harian + **restore diuji**.
- [ ] Healthcheck & monitoring aktif.
- [ ] `production-smoke` lulus di domain nyata.
- [ ] Uji perangkat Android (kamera/GPS/mock) sebelum pengumuman.
- [ ] Kebijakan retensi & privasi disetujui.
