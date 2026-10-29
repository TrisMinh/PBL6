#!/bin/sh
set -eu

backup_set="${BACKUP_SET:?BACKUP_SET is required}"
source_dir="/backups/$backup_set"
test -d "$source_dir"
cd "$source_dir"
sha256sum -c SHA256SUMS

for source_database in identity transport booking payment notification reporting; do
  target_database="restore_verify_${source_database}"
  dropdb --if-exists "$target_database"
  createdb "$target_database"
  pg_restore --no-owner --no-acl --exit-on-error \
    --dbname="$target_database" "$source_dir/$source_database.dump"
  table_count="$(psql --dbname="$target_database" --tuples-only --no-align \
    --command="select count(*) from information_schema.tables where table_schema = 'public';")"
  test "$table_count" -gt 0
  echo "$source_database restore verified ($table_count public tables)"
  dropdb "$target_database"
done
