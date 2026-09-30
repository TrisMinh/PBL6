# Local infrastructure

From `workspace/src/infra`:

```bash
docker compose config
docker compose up -d --wait
docker compose ps
docker compose down -v   # reset volumes; local/test only
```

Full platform (APIs + customer/backoffice web):

```bash
docker compose -f docker-compose.yml -f docker-compose.apps.yml up -d --build --wait
```

Or from `workspace/`: `./scripts/dev-docker.ps1`.

Contract and Sprint 0 backend gates (from `workspace/`):

```bash
./scripts/verify-contracts.ps1
./scripts/verify-s0.ps1
```

Reset is local/test only: `down -v` deletes named volumes. Bootstrap refuses hosts other than `postgres`/`localhost` unless `ALLOW_DB_RESET=1`.

Synthetic seed (`docs/database/*/010_synthetic_seed.sql` and `identity/011_dev_login_seed.sql`) inserts `example.test` identities only — no real PII. Re-applying is a no-op via `schema_migrations` and `ON CONFLICT`. Loginable seed passwords: `CustomerPass1`, `OperatorPass1`, `AdminPass1234`, `DriverPass1`.

Identity API against this stack: set `ConnectionStrings__Identity` to `Host=localhost;Port=5432;Database=identity;Username=platform;Password=postgres` (Development currently blanks the connection string so `/ready` stays 503 without an explicit override).

Services:

| Name | Port | Purpose |
|---|---|---|
| postgres | 5432 | Six logical databases: identity, transport, booking, payment, notification, reporting |
| rabbitmq | 5672 / 15672 | vhost `bus-ticket`, topic exchanges from AsyncAPI |
| redis | 6379 | Booking hold/cache later |
| mailpit | 1025 / 8025 | SMTP capture |
| payment-simulator | 8099 | Sandbox provider for Sprint 0 |

Credentials are local-dev only (`platform` / `postgres` or `.env`). Do not use production secrets.

`db-bootstrap` applies `docs/database/_shared/000_integration_tables.sql` then each service `001_initial.sql`, tracked in `schema_migrations`.
