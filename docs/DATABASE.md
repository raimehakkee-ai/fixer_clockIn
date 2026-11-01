# Rancangan Database

| Item | Keterangan |
| :--- | :--- |
| DBMS | PostgreSQL 14+ |
| ORM | Prisma 7 (migrasi terversi) |
| Status | Draft Fase 1 — menunggu persetujuan sebelum migrasi dibuat |
| Aturan bisnis | [PRD §6](./PRD.md#6-aturan-bisnis) |

---

## 1. Konvensi

- Primary key: `uuid` (dibuat aplikasi/DB), bukan data bisnis.
- Nama tabel & kolom di database: **snake_case**; model Prisma CamelCase dengan `@@map`/`@map`.
- Semua waktu: `TIMESTAMPTZ` disimpan **UTC**. `work_date` bertipe `DATE` dan mengikuti zona waktu kantor.
- Uang/desimal tidak dipakai; koordinat memakai `numeric(9,6)`.
- Penghapusan: data historis tidak di-hard-delete. `users`/`employees` dinonaktifkan (`is_active`).
- Setiap perubahan skema melalui migrasi; tidak ada perubahan manual di produksi.

---

## 2. ERD Ringkas

```
users 1───1 employees 1───* devices
  │             │  │
  │             │  └──* attendance_records *──1 shifts
  │             │  │                     └──1 office_locations
  │             │  └──* leave_requests *──1 users (reviewer)
  │             └──* audit_logs (actor)
  └──* sessions
```

---

## 3. Enumerasi

| Enum | Nilai | Catatan |
| :--- | :--- | :--- |
| `user_role` | `EMPLOYEE`, `ADMIN` | Role baru harus melalui keputusan produk |
| `device_status` | `ACTIVE`, `REVOKED` | Maks. satu `ACTIVE` per karyawan |
| `attendance_status` | `PRESENT`, `LATE`, `INCOMPLETE` | `ABSENT` **tidak disimpan**, dihitung di laporan |
| `leave_type` | `SICK`, `ANNUAL`, `PERMISSION`, `OTHER` | Saldo cuti belum ada |
| `leave_status` | `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED` | `CANCELLED` oleh karyawan |

---

## 4. Tabel

### 4.1 `users`

| Kolom | Tipe | Aturan |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `email` | varchar(255) | UNIQUE, NOT NULL, lowercase |
| `password_hash` | varchar(255) | NOT NULL, bcrypt cost 12 |
| `role` | `user_role` | NOT NULL |
| `is_active` | boolean | NOT NULL DEFAULT true |
| `created_at` / `updated_at` | timestamptz | NOT NULL |

Indeks: `UNIQUE(email)`.

### 4.2 `employees`

| Kolom | Tipe | Aturan |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `user_id` | uuid | UNIQUE, FK → `users.id` ON DELETE RESTRICT |
| `employee_number` | varchar(50) | UNIQUE, NOT NULL |
| `full_name` | varchar(150) | NOT NULL |
| `department` | varchar(100) | NULL |
| `position` | varchar(100) | NULL |
| `office_location_id` | uuid | FK → `office_locations.id` ON DELETE RESTRICT, NULL |
| `is_active` | boolean | NOT NULL DEFAULT true |
| `created_at` / `updated_at` | timestamptz | NOT NULL |

Indeks: `UNIQUE(user_id)`, `UNIQUE(employee_number)`, `(is_active)`.

> Tidak ada kolom shift tetap pada karyawan: **shift dipilih saat Clock-In** (D-017), sehingga penugasan tidak disimpan di master karyawan.

### 4.3 `devices`

| Kolom | Tipe | Aturan |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `employee_id` | uuid | FK → `employees.id` ON DELETE CASCADE |
| `device_identifier` | varchar(128) | NOT NULL; simpan **hash** identifier klien, bukan nilai mentah |
| `platform` | varchar(20) | `android` / `ios` / `web` |
| `device_name` | varchar(150) | NULL |
| `status` | `device_status` | NOT NULL DEFAULT `ACTIVE` |
| `registered_at` | timestamptz | NOT NULL |
| `last_seen_at` | timestamptz | NULL |
| `revoked_at` | timestamptz | NULL |
| `revoked_by` | uuid | FK → `users.id` ON DELETE SET NULL |

Indeks: `UNIQUE(employee_id, device_identifier)`, partial `UNIQUE(employee_id) WHERE status = 'ACTIVE'`.

> Catatan: identifier perangkat dapat berubah dan dapat dipalsukan. Pengikatan perangkat adalah kontrol tambahan, bukan bukti identitas absolut.

### 4.4 `sessions`

| Kolom | Tipe | Aturan |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `user_id` | uuid | FK → `users.id` ON DELETE CASCADE |
| `device_id` | uuid | FK → `devices.id` ON DELETE SET NULL |
| `refresh_token_hash` | varchar(255) | UNIQUE, NOT NULL (SHA-256) |
| `expires_at` | timestamptz | NOT NULL, default +30 hari |
| `revoked_at` | timestamptz | NULL |
| `last_used_at` | timestamptz | NOT NULL |
| `ip_address` | varchar(45) | NULL |
| `user_agent` | varchar(255) | NULL |
| `created_at` | timestamptz | NOT NULL |

Indeks: `UNIQUE(refresh_token_hash)`, `(user_id, revoked_at)`, `(expires_at)`.

### 4.5 `office_locations`

| Kolom | Tipe | Aturan |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `name` | varchar(150) | NOT NULL |
| `latitude` | numeric(9,6) | NOT NULL, -90..90 |
| `longitude` | numeric(9,6) | NOT NULL, -180..180 |
| `radius_meters` | integer | NOT NULL DEFAULT 50, CHECK 10..1000 |
| `timezone` | varchar(64) | NOT NULL DEFAULT `Asia/Jakarta` |
| `is_active` | boolean | NOT NULL DEFAULT true |
| `created_at` / `updated_at` | timestamptz | NOT NULL |

Indeks: partial `UNIQUE(is_active) WHERE is_active = true` → **hanya satu lokasi aktif** (D-006).

### 4.6 `shifts`

| Kolom | Tipe | Aturan |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `name` | varchar(50) | UNIQUE, NOT NULL (misal `Pagi`) |
| `start_time` | varchar(5) | NOT NULL — format `HH:mm`, ditafsirkan pada zona waktu kantor |
| `end_time` | varchar(5) | NOT NULL — format `HH:mm`; `end <= start` berarti lintas tengah malam |
| `crosses_midnight` | boolean | NOT NULL, dihitung dari `end_time <= start_time` |
| `tolerance_minutes` | integer | NOT NULL DEFAULT 15, CHECK 0..120 |
| `early_window_minutes` | integer | NOT NULL DEFAULT 120, CHECK 0..480 |
| `is_active` | boolean | NOT NULL DEFAULT true |
| `sort_order` | integer | NOT NULL DEFAULT 0 |

Indeks: `UNIQUE(name)`, `(is_active, sort_order)`.

> 3 shift/24 jam dan toleransi 15 menit adalah keputusan terkonfirmasi (D-009, D-010). Jam tiap shift **dikelola Admin** melalui dashboard (D-016); seed: Shift 1 08:00–15:00, Shift 2 15:00–22:00, Shift 3 22:00–08:00 (lintas tengah malam).

### 4.7 `attendance_records`

| Kolom | Tipe | Aturan |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `employee_id` | uuid | FK → `employees.id` ON DELETE RESTRICT, NOT NULL |
| `office_location_id` | uuid | FK → `office_locations.id` ON DELETE RESTRICT, NOT NULL |
| `shift_id` | uuid | FK → `shifts.id` ON DELETE RESTRICT, NOT NULL — shift yang dipilih karyawan saat Clock-In |
| `work_date` | date | NOT NULL — tanggal mulai shift pada zona waktu kantor |
| `clock_in_at` | timestamptz | NOT NULL — waktu server |
| `clock_in_latitude` | numeric(9,6) | NOT NULL |
| `clock_in_longitude` | numeric(9,6) | NOT NULL |
| `clock_in_accuracy` | double precision | NOT NULL (meter) |
| `clock_in_distance_meters` | double precision | NOT NULL (hasil Haversine server) |
| `clock_in_mocked` | boolean | NOT NULL DEFAULT false |
| `clock_in_photo_key` | varchar(255) | NOT NULL |
| `clock_in_photo_mime` | varchar(50) | NOT NULL |
| `clock_in_ip` | varchar(45) | NULL |
| `clock_out_at` | timestamptz | NULL |
| `clock_out_latitude` | numeric(9,6) | NULL |
| `clock_out_longitude` | numeric(9,6) | NULL |
| `clock_out_accuracy` | double precision | NULL |
| `clock_out_distance_meters` | double precision | NULL |
| `clock_out_mocked` | boolean | NULL |
| `clock_out_photo_key` | varchar(255) | NULL |
| `clock_out_photo_mime` | varchar(50) | NULL |
| `clock_out_ip` | varchar(45) | NULL |
| `status` | `attendance_status` | NOT NULL |
| `late_minutes` | integer | NOT NULL DEFAULT 0, CHECK >= 0 |
| `early_leave_minutes` | integer | NOT NULL DEFAULT 0, CHECK >= 0 |
| `risk_flags` | jsonb | NOT NULL DEFAULT `[]` (mis. `["MOCK_DETECTED"]`) |
| `created_at` / `updated_at` | timestamptz | NOT NULL |

**Constraint kunci**

- `UNIQUE(employee_id, work_date, shift_id)` — mencegah absensi ganda per shift.
- `CHECK(clock_out_at IS NULL OR clock_out_at >= clock_in_at)`.
- `status = INCOMPLETE` bila `clock_out_at IS NULL` (ditegakkan service).

Indeks: `(office_location_id, work_date)`, `(work_date, status)`, `(employee_id, work_date DESC)`, `(shift_id)`.

### 4.8 `leave_requests`

| Kolom | Tipe | Aturan |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `employee_id` | uuid | FK → `employees.id` ON DELETE RESTRICT |
| `type` | `leave_type` | NOT NULL |
| `start_date` | date | NOT NULL |
| `end_date` | date | NOT NULL, CHECK `end_date >= start_date` |
| `reason` | text | NOT NULL, minimal 10 karakter (validasi aplikasi) |
| `attachment_key` | varchar(255) | NULL |
| `attachment_mime` | varchar(50) | NULL |
| `status` | `leave_status` | NOT NULL DEFAULT `PENDING` |
| `reviewed_by` | uuid | FK → `users.id` ON DELETE SET NULL |
| `reviewed_at` | timestamptz | NULL |
| `review_note` | text | NULL |
| `created_at` / `updated_at` | timestamptz | NOT NULL |

Indeks: `(status, created_at DESC)`, `(employee_id, start_date DESC)`, `(start_date, end_date)`.

Aturan tumpang tindih: pengajuan `PENDING`/`APPROVED` tidak boleh beririsan tanggal dengan pengajuan lain milik karyawan yang sama.

### 4.9 `audit_logs`

| Kolom | Tipe | Aturan |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `actor_user_id` | uuid | FK → `users.id` ON DELETE SET NULL |
| `action` | varchar(64) | NOT NULL (mis. `DEVICE_RESET`, `LEAVE_APPROVED`, `OFFICE_UPDATED`, `EXPORT_DOWNLOADED`) |
| `entity_type` | varchar(64) | NOT NULL |
| `entity_id` | uuid | NULL |
| `metadata` | jsonb | NOT NULL DEFAULT `{}` — tanpa token/password |
| `ip_address` | varchar(45) | NULL |
| `user_agent` | varchar(255) | NULL |
| `created_at` | timestamptz | NOT NULL |

Indeks: `(entity_type, entity_id)`, `(actor_user_id, created_at DESC)`, `(created_at DESC)`.

### 4.10 `idempotency_keys` (opsional, PROPOSED)

| Kolom | Tipe | Aturan |
| :--- | :--- | :--- |
| `key` | varchar(128) | PK (dari header `Idempotency-Key`) |
| `user_id` | uuid | FK → `users.id` ON DELETE CASCADE |
| `request_hash` | varchar(64) | NOT NULL |
| `response_status` | integer | NOT NULL |
| `response_body` | jsonb | NOT NULL |
| `created_at` | timestamptz | NOT NULL |

Indeks: `(created_at)` untuk pembersihan berkala.

---

## 5. Semantik Waktu dan Shift

- Shift disimpan sebagai `TIME` tanpa zona waktu dan ditafsirkan pada `office_locations.timezone`.
- `work_date` = tanggal **mulai** shift di zona waktu kantor.
- Shift malam `23:00–07:00` memiliki `crosses_midnight = true`; Clock-Out terjadi pada tanggal kalender berikutnya tetapi tetap milik `work_date` hari mulai.
- Jendela Clock-In yang diusulkan: `[start_time - early_window_minutes, end_time]`, termasuk jam yang melewati tengah malam.
- `late_minutes = max(0, selisih menit(clock_in, start_time + tolerance_minutes))`.
- `early_leave_minutes = max(0, selisih menit(end_time, clock_out))` bila Clock-Out sebelum akhir shift.
- Konversi waktu memakai `Intl.DateTimeFormat` dengan `timeZone` kantor; tidak ada dependensi tanggal eksternal.
- Perhitungan `ABSENT` dilakukan saat laporan: shift yang sudah berakhir, tidak ada `attendance_records`, dan tidak ada izin `APPROVED` pada tanggal tersebut.

---

## 6. Relasi dan Aturan Hapus

| Relasi | ON DELETE |
| :--- | :--- |
| `employees.user_id → users.id` | RESTRICT |
| `devices.employee_id → employees.id` | CASCADE |
| `sessions.user_id → users.id` | CASCADE |
| `attendance_records.employee_id → employees.id` | RESTRICT |
| `attendance_records.shift_id → shifts.id` | RESTRICT |
| `attendance_records.office_location_id → office_locations.id` | RESTRICT |
| `leave_requests.employee_id → employees.id` | RESTRICT |
| `leave_requests.reviewed_by → users.id` | SET NULL |
| `audit_logs.actor_user_id → users.id` | SET NULL |

Data absensi tidak dihapus; koreksi dilakukan melalui fitur koreksi Admin di fase berikutnya (belum termasuk rilis pertama) dan dicatat di audit log.

---

## 7. Migrasi, Seed, dan Backup

- Development: `prisma migrate dev` (membuat migrasi + menerapkan).
- Test: database terpisah, `prisma migrate deploy` + seed minimal.
- Produksi: `prisma migrate deploy` saat deploy; tidak pernah `db push`.
- Seed hanya untuk development/demo, idempoten (`upsert`), berisi Admin, 3 karyawan, 1 kantor, 3 shift, riwayat 14 hari, 2 pengajuan `PENDING`.
- Backup: `pg_dump` harian, retensi 30 hari, salinan di lokasi terpisah; uji restore bulanan.
- Object storage: versioning aktif; retensi foto sesuai **OPEN-12**.

---

## 8. Hal yang Belum Diputuskan

1. ~~Jam pasti tiap shift~~ — **dijawab**: dikelola Admin di dashboard (D-016).
2. ~~Shift ditetapkan Admin atau dipilih karyawan~~ — **dijawab**: dipilih saat Clock-In (D-017).
3. Tabel hari libur (**OPEN-04**).
4. Saldo cuti dan jenis izin final (**OPEN-06**).
5. Retensi foto/absensi (**OPEN-12**).
6. Perlu tidaknya tabel koreksi absensi (belum ada di rilis pertama).
