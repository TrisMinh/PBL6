#!/bin/sh
set -eu

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="/backups/pbl6-${timestamp}"
mkdir -p "$target"

for database in identity transport booking payment notification reporting; do
  pg_dump --format=custom --no-owner --no-acl --dbname="$database" --file="$target/$database.dump"
done

sha256sum "$target"/*.dump > "$target/SHA256SUMS"
echo "Backup completed: $target"
