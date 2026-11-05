# Kontrak API — v1

| Item | Keterangan |
| :--- | :--- |
| Base URL | `https://<host>/api/v1` (dev: `http://localhost:4000/api/v1`) |
| Format | JSON UTF-8, kecuali upload (multipart) dan ekspor (CSV/XLSX) |
| Auth | `Authorization: Bearer <access_token>` |
| Versi | `/v1`; perubahan breaking → `/v2` |
| Status | Draft Fase 1 |

---

## 1. Konvensi

### Autentikasi

- `POST /auth/login` → `accessToken` (15 menit) + `refreshToken` (30 hari).
- Access token: JWT berisi `sub`, `role`, `sid`, `deviceId`.
- Refresh token disimpan di DB sebagai hash; setiap refresh melakukan rotasi.
- Logout mencabut sesi; reset perangkat Admin mencabut seluruh sesi akun.

### Pagination

`?page=1&limit=20` — `limit` maksimum 100.

```json
{
  "data": [],
  "meta": { "page": 1, "limit": 20, "total": 0, "totalPages": 0 }
}
```

### Format Error

```json
{
  "error": {
    "code": "OUT_OF_RANGE",
    "message": "Anda berada di luar radius kantor.",
    "details": { "distanceMeters": 84.2, "radiusMeters": 50 }
  },
  "requestId": "req_01JABC"
}
```

### Kode Error

| HTTP | Code | Makna |
| :--- | :--- | :--- |
| 400 | `VALIDATION_ERROR` | Body/query tidak valid |
| 401 | `UNAUTHENTICATED` | Token tidak ada/kedaluwarsa |
| 403 | `FORBIDDEN` | Role tidak berwenang |
| 403 | `DEVICE_NOT_AUTHORIZED` | Perangkat berbeda dari yang terdaftar |
| 404 | `NOT_FOUND` | Resource tidak ada / bukan milik pengguna |
| 409 | `ALREADY_CLOCKED_IN` | Sudah Clock-In pada shift & tanggal tersebut |
| 409 | `ALREADY_CLOCKED_OUT` | Sudah Clock-Out |
| 409 | `NOT_CLOCKED_IN` | Clock-Out tanpa Clock-In sah |
| 409 | `LEAVE_OVERLAP` | Tanggal pengajuan beririsan |
| 409 | `LEAVE_ALREADY_REVIEWED` | Pengajuan sudah diputuskan |
| 409 | `CONFLICT` | Konflik umum |
| 422 | `EXPORT_TOO_LARGE` | Jumlah baris ekspor melebihi batas |
| 422 | `OUT_OF_RANGE` | Di luar radius kantor |
| 422 | `MOCK_LOCATION` | Mock location terdeteksi |
| 422 | `LOW_ACCURACY` | Akurasi GPS melebihi batas |
| 422 | `INVALID_SHIFT` | Shift tidak aktif atau tidak dikenal |
| 422 | `OUTSIDE_SHIFT_WINDOW` | Clock-In/Out di luar jendela shift |
| 413 | `VALIDATION_ERROR` | File upload melebihi batas ukuran |
| 429 | `RATE_LIMITED` | Terlalu banyak permintaan |
| 500 | `INTERNAL_ERROR` | Kesalahan server |

### Rate Limit

| Endpoint | Batas |
| :--- | :--- |
| `POST /auth/login` | 10 / 15 menit per IP+email, 120 / 15 menit per IP |
| `POST /auth/refresh` | 300 / 15 menit per IP |
| `POST /attendance/clock-in` / `clock-out` | 20 / jam per karyawan |
| `POST /leave-requests` | 10 / hari per karyawan |
| Ekspor laporan | 10 / jam per Admin |

Batas login/refresh per IP dapat diatur lewat `LOGIN_IP_LIMIT_MAX` dan
`REFRESH_LIMIT_MAX` agar pergantian shift dari satu jaringan NAT tidak saling blokir.

### Idempotensi

- Clock-In aman dari duplikasi melalui unique constraint + `409`.
- Clock-Out memakai update kondisional `WHERE clock_out_at IS NULL`, sehingga dua
  request bersamaan tidak sama-sama berhasil.
- Header `Idempotency-Key` belum menyimpan respons; nilainya saat ini hanya
  diizinkan pada CORS untuk kompatibilitas klien.

### Matriks Akses

| Endpoint | Employee | Admin |
| :--- | :--- | :--- |
| Auth (login/refresh/logout/me) | ✅ | ✅ |
| Device (me/revoke) | ✅ milik sendiri | ✅ semua |
| Employees | `/me` saja | ✅ CRUD |
| Office locations | baca | ✅ kelola |
| Shifts | baca | ✅ kelola |
| Attendance clock-in/out | ✅ | ❌ |
| Attendance riwayat | ✅ milik sendiri | ✅ semua |
| Foto absensi | ✅ milik sendiri | ✅ semua |
| Leave requests | ✅ milik sendiri | ✅ semua + approval |
| Reports | ❌ | ✅ |
| Audit logs | ❌ | ✅ |

---

## 2. Health

### `GET /health`

Publik. `200`

```json
{ "ok": true, "serverTime": "2026-11-01T09:00:00.000Z", "version": "1" }
```

---

## 3. Authentication

### `POST /auth/login`

```json
{
  "email": "budi@clockin.test",
  "password": "Employee123!",
  "deviceIdentifier": "9f2c…",
  "deviceName": "Samsung SM-A525F",
  "platform": "android"
}
```

`200`

```json
{
  "accessToken": "eyJ…",
  "refreshToken": "f1c…",
  "user": {
    "id": "…",
    "email": "budi@clockin.test",
    "role": "EMPLOYEE",
    "employee": { "id": "…", "number": "EMP-001", "fullName": "Budi Santoso", "shiftId": "…" }
  },
  "device": { "id": "…", "status": "ACTIVE" },
  "serverTime": "2026-11-01T09:00:00.000Z"
}
```

Error: `401 UNAUTHENTICATED` (kredensial salah), `403 DEVICE_NOT_AUTHORIZED`, `403 FORBIDDEN` (akun nonaktif).

Perilaku perangkat (**D-009, PROPOSED**): login pertama mengikat perangkat dan menulis audit `DEVICE_REGISTERED`; login dengan identifier berbeda ditolak sampai Admin mereset.

### `POST /auth/refresh`

```json
{ "refreshToken": "f1c…", "deviceIdentifier": "9f2c…" }
```

`200` → `{ accessToken, refreshToken, serverTime }` (rotasi). `401` bila token dicabut/kedaluwarsa.

### `POST /auth/logout`

Body `{ refreshToken }`. `204`.

### `GET /auth/me`

`200` → `{ user, employee?, device?, serverTime }`.

---

## 4. Devices

Registrasi perangkat terjadi otomatis pada login pertama karyawan (D-028). Tidak ada endpoint registrasi terpisah pada rilis ini; setelah Admin mereset perangkat, login berikutnya dengan identifier yang sama akan mengaktifkan kembali perangkat tersebut dan menulis audit baru.

### `GET /devices/me`

`200` → `{ devices: [...] }` milik akun karyawan.

### `POST /devices/revoke`

Body `{ deviceId }`. `200` → `{ device }`. Hanya perangkat sendiri; sesi pada perangkat tersebut dicabut dan audit `DEVICE_REVOKED` dicatat.

### `POST /employees/:id/reset-device` (Admin)

Mencabut perangkat aktif dan seluruh sesi akun, menulis audit `DEVICE_RESET`. `200` → `{ revokedDevices: number }`.

---

## 5. Employees

| Method | Path | Akses | Keterangan |
| :--- | :--- | :--- | :--- |
| GET | `/employees/me` | Employee | Profil sendiri |
| GET | `/employees?q=&page=&limit=&includeInactive=` | Admin | Daftar karyawan (pagination) |
| POST | `/employees` | Admin | Buat user + employee |
| GET | `/employees/:id` | Admin | Detail karyawan |
| PATCH | `/employees/:id` | Admin | Ubah nama, departemen, jabatan, lokasi |
| PATCH | `/employees/:id/status` | Admin | Aktif/nonaktif (mencabut sesi saat nonaktif) |
| POST | `/employees/:id/reset-password` | Admin | Set password baru + cabut semua sesi (audit) |
| POST | `/employees/:id/reset-device` | Admin | Cabut perangkat aktif + semua sesi (audit) |

Contoh `PATCH /employees/:id`:

```json
{ "fullName": "Budi Santoso", "department": "Operasional", "shiftId": "…", "officeLocationId": "…" }
```

Validasi: email unik, `employee_number` unik, `shiftId` harus aktif, password minimal 8 karakter dengan huruf dan angka.

---

## 6. Office Locations

| Method | Path | Akses |
| :--- | :--- | :--- |
| GET | `/office-locations` | Semua user |
| POST | `/office-locations` | Admin |
| PATCH | `/office-locations/:id` | Admin |
| POST | `/office-locations/:id/activate` | Admin |

Contoh `PATCH`:

```json
{ "name": "Ayam Geprek JnQ Tamamaung", "latitude": -5.141905, "longitude": 119.445277, "radiusMeters": 100, "timezone": "Asia/Makassar" }
```

Respons juga memuat `accuracyLimitMeters` (dari `ACCURACY_LIMIT_M`) agar klien
memakai batas akurasi yang sama dengan server.

Validasi: lat -90..90, lng -180..180, radius 10..1000, `timezone` IANA valid. Hanya satu lokasi aktif (D-012), ditegakkan juga oleh partial unique index database.

---

## 7. Shifts

| Method | Path | Akses |
| :--- | :--- | :--- |
| GET | `/shifts` | Semua user (karyawan untuk info shift) |
| POST | `/shifts` | Admin |
| PATCH | `/shifts/:id` | Admin |

```json
{ "name": "Malam", "startTime": "23:00", "endTime": "07:00", "toleranceMinutes": 15, "earlyWindowMinutes": 120, "isActive": true }
```

Respons shift juga memuat `clockOutGraceMinutes` (dari
`CLOCK_OUT_GRACE_MINUTES`, default 240) agar jendela Clock-Out di klien sama
dengan server.

`crosses_midnight` dihitung server dari `endTime <= startTime`. Jam shift **dapat diubah Admin** melalui dashboard (D-016); seed: Shift 1 08:00–15:00, Shift 2 15:00–22:00, Shift 3 22:00–08:00.

---

## 8. Attendance

### `POST /attendance/clock-in`

`multipart/form-data`:

| Field | Tipe | Aturan |
| :--- | :--- | :--- |
| `photo` | file | Wajib, `image/jpeg`/`image/png`, maks 5 MB, diverifikasi magic bytes |
| `latitude` | number | -90..90 |
| `longitude` | number | -180..180 |
| `accuracy` | number | meter, > 0 |
| `mocked` | boolean | `true` → ditolak |
| `shiftId` | uuid | **Wajib** — shift aktif yang dipilih karyawan (D-017) |

`201`

```json
{
  "attendance": {
    "id": "…",
    "workDate": "2026-11-01",
    "status": "LATE",
    "lateMinutes": 8,
    "earlyLeaveMinutes": 0,
    "shift": { "id": "…", "name": "Shift 1", "startTime": "08:00", "endTime": "15:00" },
    "clockIn": {
      "at": "2026-11-01T01:03:12.000Z",
      "latitude": -5.141905,
      "longitude": 119.445277,
      "accuracy": 8,
      "distanceMeters": 12.4,
      "mocked": false,
      "photoAvailable": true
    },
    "clockOut": null,
    "riskFlags": []
  },
  "distanceMeters": 12.4,
  "serverTime": "2026-11-01T01:03:12.000Z"
}
```

Penolakan: `422 MOCK_LOCATION`, `422 LOW_ACCURACY`, `422 OUT_OF_RANGE`, `422 INVALID_SHIFT`, `422 OUTSIDE_SHIFT_WINDOW`, `409 ALREADY_CLOCKED_IN`, `400` foto tidak ada/bukan gambar, `413` file melebihi batas. Jika `ALLOW_WEB_ATTENDANCE=false`, sesi yang terikat perangkat `web` ditolak `403 FORBIDDEN`; record web yang diizinkan pada UAT diberi `riskFlags: ["WEB_ATTENDANCE"]`.

### `POST /attendance/clock-out`

Multipart sama dengan Clock-In, **termasuk `shiftId`** (shift yang dipilih saat Clock-In). Radius, akurasi, dan mock location divalidasi sama. Clock-Out masih
diizinkan setelah jam selesai shift selama `CLOCK_OUT_GRACE_MINUTES` (default 240
menit), sehingga karyawan tidak kehilangan absensi pulang karena terlambat
beberapa menit. Clock-In tetap ditolak setelah shift berakhir.

`200` → `{ attendance, distanceMeters, serverTime }` dengan `attendance.clockOut` terisi dan `earlyLeaveMinutes` dihitung server.

Error: `409 NOT_CLOCKED_IN`, `409 ALREADY_CLOCKED_OUT`, `422 OUT_OF_RANGE`, `422 MOCK_LOCATION`, `422 LOW_ACCURACY`, `422 OUTSIDE_SHIFT_WINDOW`.

### `GET /attendance/me?from=2026-11-01&to=2026-11-30&page=1&limit=31`

Employee. `200` → daftar record milik sendiri, terbaru dulu, termasuk `shift`, `status`, `lateMinutes`, `photoAvailable`.

### `GET /attendance?date=&from=&to=&employeeId=&shiftId=&status=&q=&page=&limit=`

Admin. Baris termasuk `employee`, `shift`, `clockIn/Out`, `distanceMeters`, `mocked`, `riskFlags`, `photoAvailable`.

### `GET /attendance/:id`

Pemilik atau Admin. `404` bila bukan milik dan bukan Admin (tidak membocorkan keberadaan data).

### `GET /attendance/:id/photo?type=in|out`

Stream biner dengan otorisasi pemilik/Admin, `Cache-Control: private, max-age=300`, `X-Content-Type-Options: nosniff`, dan `Content-Type` dari MIME tervalidasi. `404 NOT_FOUND` bila tidak ada atau bukan milik pengguna.

---

## 9. Leave Requests

Diimplementasikan pada Fase 5a.

### `POST /leave-requests`

`multipart/form-data`: `type` (`SICK`/`ANNUAL`/`PERMISSION`/`OTHER`), `startDate` (`YYYY-MM-DD`), `endDate`, `reason` (min. 10 karakter), `attachment?` (JPEG/PNG/PDF, maks 5 MB, diverifikasi magic bytes).

`201` → `{ leave: { id, type, startDate, endDate, days, status: "PENDING", attachmentAvailable, … } }`.

Validasi: `startDate <= endDate`; tidak beririsan dengan pengajuan `PENDING`/`APPROVED` milik karyawan yang sama (`409 LEAVE_OVERLAP`); lampiran wajib berupa file yang valid meski MIME-nya benar.

### `GET /leave-requests/me?status=&page=&limit=`

Employee. `200` → `{ data, meta }` berisi pengajuan milik sendiri, terbaru dulu.

### `GET /leave-requests?status=&employeeId=&q=&from=&to=&page=&limit=`

Admin. Filter tumpang tindih periode (`from`/`to`), status, karyawan, dan pencarian nama/nomor.

### `GET /leave-requests/:id` dan `GET /leave-requests/:id/attachment`

Pemilik/Admin. Lampiran di-stream dengan `Content-Type` tervalidasi dan `nosniff`; resource milik orang lain → `404`.

### `POST /leave-requests/:id/approve` dan `/reject`

Admin. Body `{ "reviewNote": "…" }` — **wajib** untuk reject (min. 3 karakter), opsional untuk approve.

`200` → `{ leave }` dengan `status`, `reviewer`, `reviewedAt`, dan `reviewNote`. Hanya `PENDING` yang dapat diputuskan; selain itu `409 LEAVE_ALREADY_REVIEWED`. Audit `LEAVE_APPROVED`/`LEAVE_REJECTED`.

### `POST /leave-requests/:id/cancel`

Employee, hanya pengajuan `PENDING` → `CANCELLED`. Selain `PENDING` → `409 LEAVE_ALREADY_REVIEWED`.

---

## 10. Reports

Diimplementasikan pada Fase 6a.

### `GET /reports/summary?date=`

Admin. `date` opsional (`YYYY-MM-DD`, default hari ini pada zona waktu kantor).

```json
{
  "summary": {
    "date": "2026-11-01",
    "timezone": "Asia/Jakarta",
    "totalEmployees": 12,
    "present": 7,
    "late": 1,
    "incomplete": 1,
    "onLeave": 1,
    "absent": 2,
    "attendanceRecords": 10,
    "pendingLeaveRequests": 3
  }
}
```

Kategori saling eksklusif: karyawan terlambat tidak dihitung sebagai hadir;
karyawan dengan record `INCOMPLETE` (sudah Clock-In, belum Clock-Out setelah
grace period) dihitung terpisah dan tidak dihitung sebagai hadir atau izin.
`absent` = karyawan aktif − (hadir + terlambat + incomplete + izin), tidak pernah
negatif. Karena sistem belum menyimpan penugasan shift per karyawan, angka ini
adalah perkiraan dan tidak boleh dipakai untuk payroll.

### `GET /reports/attendance/export?from=&to=&employeeId=&shiftId=&status=&format=csv|xlsx`

Admin. Default periode: awal bulan berjalan sampai hari ini. Maksimum **20.000 baris** (`422 EXPORT_TOO_LARGE`). Rate limit 10 unduhan/jam per akun.

Kolom: NIK, Nama, Departemen, Tanggal, Shift, Masuk, Keluar, Status, Terlambat (menit), Pulang Awal (menit), Jarak Masuk (m), Jarak Keluar (m), Mock Location, Catatan.

Satu baris = satu record absensi. Karyawan tanpa absensi tidak dibuatkan baris; rekap hadir/absen tersedia di `/reports/summary`.

### `GET /reports/leave/export?from=&to=&employeeId=&status=&format=csv|xlsx`

Admin. Periode dihitung dari tumpang tindih `start_date`–`end_date` dengan rentang. Kolom: NIK, Nama, Jenis, Mulai, Selesai, Hari, Status, Reviewer, Waktu Keputusan, Catatan, Dibuat.

**Format file:**
- **CSV**: UTF-8 BOM, CRLF, semua sel dikutip; sel teks berawalan `=`, `+`, `-`, `@`, TAB, atau CR diberi prefiks `'` (formula injection).
- **XLSX**: dibuat dengan penulis minimal berbasis `fflate`; nilai ditulis sebagai teks/angka, bukan formula.
- `Content-Disposition: attachment`, nama file `rekap-absensi-<from>_<to>.<ext>` atau `rekap-izin-<from>_<to>.<ext>`.

**Audit:** setiap ekspor menulis `EXPORT_DOWNLOADED` (jenis laporan, periode, format, jumlah baris, filter). Percobaan absensi yang ditolak juga dicatat sebagai `CLOCK_IN_REJECTED` / `CLOCK_OUT_REJECTED` dengan kode alasan (mis. `MOCK_LOCATION`, `OUT_OF_RANGE`, `LOW_ACCURACY`).

---

## 11. Audit Logs

### `GET /audit-logs?action=&actorId=&entityType=&from=&to=&page=&limit=`

Admin. `from`/`to` memfilter `createdAt` (UTC).

```json
{
  "data": [
    {
      "id": "…",
      "action": "EXPORT_DOWNLOADED",
      "entityType": "report",
      "entityId": null,
      "metadata": { "report": "attendance", "rows": 24 },
      "actor": { "id": "…", "email": "admin@clockin.test" },
      "ipAddress": "127.0.0.1",
      "createdAt": "2026-11-01T09:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

Audit bersifat append-only (tidak ada endpoint ubah/hapus) dan metadata tidak memuat token/password.

---

## 12. Contoh cURL

```bash
# Login
curl -s -X POST http://localhost:4000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"budi@clockin.test","password":"Employee123!","deviceIdentifier":"dev-001","platform":"android"}'

# Clock-In (multipart)
curl -s -X POST http://localhost:4000/api/v1/attendance/clock-in \
  -H "Authorization: Bearer $TOKEN" \
  -F photo=@selfie.jpg \
  -F latitude=-5.141905 -F longitude=119.445277 -F accuracy=8.5 -F mocked=false

# Statistik Admin
curl -s "http://localhost:4000/api/v1/reports/attendance?from=2026-11-01&to=2026-11-01" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Ekspor CSV
curl -sL "http://localhost:4000/api/v1/reports/attendance/export?from=2026-11-01&to=2026-11-30&format=csv" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -o rekap.csv
```

---

## 13. Catatan Implementasi

- Semua timestamp pada respons berupa ISO-8601 UTC; klien menampilkan sesuai zona waktu kantor.
- `serverTime` disertakan pada login, refresh, `/auth/me`, dan `/attendance/*` agar klien dapat menghitung offset jam.
- Endpoint Admin selalu memakai `requireRole('ADMIN')`.
- Endpoint milik karyawan memfilter `employee_id` dari token, bukan dari parameter.
- Request body maksimum 1 MB untuk JSON; upload dibatasi 5 MB per file.
- Dokumentasi OpenAPI akan dihasilkan pada Fase 2 dan diperlakukan sebagai kontrak yang diuji.
