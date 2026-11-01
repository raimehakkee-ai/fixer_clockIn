#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL wajib diisi}"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/clockin}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$BACKUP_DIR/clockin-$STAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

pg_dump "$DATABASE_URL" \
  --format=plain \
  --no-owner \
  --no-privileges \
  | gzip -9 > "$FILE"

find "$BACKUP_DIR" -name 'clockin-*.sql.gz' -mtime +"$RETENTION_DAYS" -delete

echo "Backup database: $FILE"
echo "Salin berkas ini ke lokasi terpisah dari server (object storage / bucket)."
