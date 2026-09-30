#!/bin/sh
set -eu

case "${PGHOST:-}" in
  postgres|localhost|127.0.0.1) ;;
  *)
    if [ "${ALLOW_DB_RESET:-}" != "1" ]; then
      echo "refusing bootstrap on host '${PGHOST:-}'; local/test only (postgres|localhost) or ALLOW_DB_RESET=1"
      exit 1
    fi
    ;;
esac

until pg_isready -d postgres >/dev/null 2>&1; do
  sleep 1
done

apply() {
  db="$1"
  file="$2"
  name="$(basename "$file")"
  psql -d "$db" -v ON_ERROR_STOP=1 -q <<SQL
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL
);
SQL
  applied="$(psql -d "$db" -tA -c "SELECT 1 FROM schema_migrations WHERE filename = '$name'" || true)"
  if [ "$applied" = "1" ]; then
    echo "skip $db $name"
    return
  fi
  psql -d "$db" -v ON_ERROR_STOP=1 -f "$file"
  psql -d "$db" -v ON_ERROR_STOP=1 -c "INSERT INTO schema_migrations (filename, applied_at) VALUES ('$name', NOW())"
  echo "applied $db $name"
}

for db in identity transport booking payment notification reporting; do
  psql -d postgres -v ON_ERROR_STOP=1 -c "SELECT 1 FROM pg_database WHERE datname = '$db'" | grep -q 1 \
    || psql -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $db"
  apply "$db" "/baseline/_shared/000_integration_tables.sql"
done

apply identity /baseline/identity/001_initial.sql
apply transport /baseline/transport/001_initial.sql
apply booking /baseline/booking/001_initial.sql
apply booking /baseline/booking/012_rebook_after_cancel.sql
apply payment /baseline/payment/001_initial.sql
apply notification /baseline/notification/001_initial.sql
apply reporting /baseline/reporting/001_initial.sql
apply reporting /baseline/reporting/011_seed_occupancy.sql

apply identity /baseline/identity/010_synthetic_seed.sql
apply identity /baseline/identity/011_dev_login_seed.sql
apply transport /baseline/transport/010_synthetic_seed.sql
apply transport /baseline/transport/011_more_seed_seats.sql
apply transport /baseline/transport/012_seed_driver.sql
apply transport /baseline/transport/013_seed_amenities.sql
apply booking /baseline/booking/010_synthetic_seed.sql
apply booking /baseline/booking/013_more_seed_seats.sql

echo "bootstrap complete"
touch /tmp/bootstrap-ok
exec sleep infinity
