-- Pastikan hanya satu lokasi kantor aktif.
WITH ranked_offices AS (
    SELECT "id",
           ROW_NUMBER() OVER (ORDER BY "created_at" ASC, "id" ASC) AS rn
    FROM "office_locations"
    WHERE "is_active" = true
)
UPDATE "office_locations"
SET "is_active" = false,
    "updated_at" = CURRENT_TIMESTAMP
WHERE "id" IN (SELECT "id" FROM ranked_offices WHERE rn > 1);

CREATE UNIQUE INDEX "office_locations_single_active_key"
    ON "office_locations" ("is_active")
    WHERE "is_active" = true;

-- Pastikan hanya satu perangkat aktif per karyawan.
WITH ranked_devices AS (
    SELECT "id",
           ROW_NUMBER() OVER (
               PARTITION BY "employee_id"
               ORDER BY "registered_at" DESC, "id" DESC
           ) AS rn
    FROM "devices"
    WHERE "status" = 'ACTIVE'
)
UPDATE "devices"
SET "status" = 'REVOKED',
    "revoked_at" = COALESCE("revoked_at", CURRENT_TIMESTAMP)
WHERE "id" IN (SELECT "id" FROM ranked_devices WHERE rn > 1);

UPDATE "sessions" AS s
SET "revoked_at" = COALESCE(s."revoked_at", CURRENT_TIMESTAMP)
FROM "devices" AS d
WHERE s."device_id" = d."id"
  AND d."status" = 'REVOKED'
  AND s."revoked_at" IS NULL;

CREATE UNIQUE INDEX "devices_employee_id_single_active_key"
    ON "devices" ("employee_id")
    WHERE "status" = 'ACTIVE';

-- Batasan nilai yang selama ini hanya divalidasi di aplikasi.
ALTER TABLE "office_locations"
    ADD CONSTRAINT "office_locations_radius_meters_check"
        CHECK ("radius_meters" BETWEEN 10 AND 1000);

ALTER TABLE "shifts"
    ADD CONSTRAINT "shifts_tolerance_minutes_check"
        CHECK ("tolerance_minutes" BETWEEN 0 AND 120),
    ADD CONSTRAINT "shifts_early_window_minutes_check"
        CHECK ("early_window_minutes" BETWEEN 0 AND 480);

ALTER TABLE "attendance_records"
    ADD CONSTRAINT "attendance_records_late_minutes_check"
        CHECK ("late_minutes" >= 0),
    ADD CONSTRAINT "attendance_records_early_leave_minutes_check"
        CHECK ("early_leave_minutes" >= 0),
    ADD CONSTRAINT "attendance_records_clock_out_after_clock_in_check"
        CHECK ("clock_out_at" IS NULL OR "clock_out_at" >= "clock_in_at"),
    ADD CONSTRAINT "attendance_records_risk_flags_array_check"
        CHECK (jsonb_typeof("risk_flags") = 'array');

ALTER TABLE "leave_requests"
    ADD CONSTRAINT "leave_requests_date_order_check"
        CHECK ("end_date" >= "start_date");

CREATE INDEX "audit_logs_action_created_at_idx"
    ON "audit_logs" ("action", "created_at" DESC);
