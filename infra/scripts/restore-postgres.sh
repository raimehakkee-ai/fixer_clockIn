#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL wajib diisi}"
FILE="${1:?Penggunaan: restore-postgres.sh <berkas.sql.gz>}"

if [ ! -f "$FILE" ]; then
  echo "Berkas tidak ditemukan: $FILE" >&2
  exit 1
fi

echo "Memulihkan $FILE ke database..."
gunzip -c "$FILE" | psql "$DATABASE_URL" -v ON_ERROR_STOP=1

echo "Restore selesai. Jalankan smoke test sebelum membuka akses pengguna."
