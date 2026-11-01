# Web Admin (React + Tailwind)

| Item | Keterangan |
| :--- | :--- |
| Stack | Vite 7, React 19, Tailwind CSS 4, React Router 7, TanStack Query |
| Lokasi | `admin/` |
| Status | Fase 6b selesai |
| Dokumen terkait | [API](./API.md), [SECURITY](./SECURITY.md), [MOBILE](./MOBILE.md) |

---

## 1. Halaman

| Route | Halaman | Fungsi |
| :--- | :--- | :--- |
| `/login` | Login | Hanya role `ADMIN`; karyawan ditolak |
| `/` | Dashboard | Statistik harian, kehadiran terbaru, pengajuan menunggu (polling 15–30 dtk) |
| `/attendance` | Kehadiran | Filter tanggal/nama/shift/status, detail foto + koordinat + mock |
| `/leave` | Izin & Cuti | Tab status, setujui/tolak dengan catatan, lihat lampiran |
| `/employees` | Karyawan | Cari, buat, edit, aktif/nonaktif, reset password/perangkat |
| `/office` | Lokasi & Shift | Geofence kantor + CRUD shift |
| `/reports` | Laporan | Ringkasan harian, unduh CSV/XLSX absensi & izin |
| `/audit` | Audit Log | Filter action/entity/periode, pagination |

---

## 2. Konfigurasi

`admin/.env` (opsional):

```bash
VITE_API_URL=
```

- Kosong → memakai path relatif `/api/v1` dan proxy Vite ke `http://localhost:4000`.
- Di produksi, isi dengan URL API (HTTPS) atau letakkan admin dan API di origin yang sama di belakang Nginx.

---

## 3. Menjalankan

```bash
# Terminal 1 — backend
cd server
npx prisma dev --detach
npx prisma migrate deploy
npm run db:seed        # jika database masih kosong
npm run dev            # http://localhost:4000/api/v1

# Terminal 2 — admin
cd admin
npm install
npm run dev            # http://localhost:5173
```

Login demo: `admin@clockin.test` / `Admin123!`.

```bash
npm run typecheck      # tsc --noEmit
npm run build          # typecheck + vite build
npm run preview        # pratinjau hasil build
```

---

## 4. Autentikasi & Sesi

- Login memakai `POST /api/v1/auth/login` dengan `platform: web`.
- Server menolak karyawan (tanpa device binding) dan UI juga memeriksa `role === 'ADMIN'`.
- Token disimpan di `localStorage` (`clockin.admin.session`); refresh otomatis sekali saat `401`, lalu sesi dibersihkan bila gagal.
- Logout memanggil endpoint server dan menghapus sesi lokal.

> Risiko XSS pada localStorage diakui; produksi wajib memakai CSP yang ketat dan sanitasi. Alternatif cookie HttpOnly dapat dipertimbangkan pada fase deployment.

---

## 5. Media Privat

Foto absensi dan lampiran izin **tidak** memakai URL publik. Komponen `AuthImage` dan `openProtectedFile` mengambil blob melalui `fetch` dengan header `Authorization`, lalu membuat object URL sementara yang dicabut kembali setelah dipakai.

---

## 6. Pengujian yang Sudah Dilakukan

| Pemeriksaan | Hasil |
| :--- | :--- |
| `npm run build` (tsc + Vite) | **Lulus** — 1.820 modul, CSS 21 kB, JS 637 kB (warning ukuran chunk) |
| Vite dev server | HTML `200`, elemen `#root` dan entry ditemukan |
| Proxy `/api` | `GET /api/v1/health` → `200 ok` |
| Login via proxy | `200`, role `ADMIN` |
| Ringkasan via proxy | `200`, tanggal & total karyawan terisi |

**Belum dilakukan:** verifikasi visual/interaksi browser (tidak ada browser terpasang di lingkungan ini; `agent-browser` belum terinstal) dan uji end-to-end pada data produksi.

---

## 7. Keterbatasan

1. Belum ada code-splitting; bundle produksi ±637 kB (gzip ±174 kB) dan memicu peringatan Vite.
2. Dashboard memakai polling, bukan WebSocket/SSE.
3. Belum ada pengelolaan hari libur, saldo cuti, atau koreksi absensi.
4. Tabel menggunakan render biasa; untuk ribuan baris sebaiknya ditambah virtualisasi.
5. Tidak ada halaman pengaturan profil Admin atau ganti password mandiri.
6. Pengujian UI otomatis (Playwright/agent-browser) belum dijalankan.
