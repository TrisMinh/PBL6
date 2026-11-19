# Local infrastructure

From `workspace/src/infra`:

```bash
docker compose config
docker compose up -d --wait
docker compose ps
docker compose down -v   # reset volumes; local/test only
```

Full platform (APIs + BLUE web):

```bash
docker compose -f docker-compose.yml -f docker-compose.apps.yml up -d --build --wait
```

The desktop frontends are separate applications:

- Customer: http://localhost:5173
- Operator: http://localhost:5174
- Admin: http://localhost:5175

They have independent routes, login and build artifacts. The old temporary backoffice has been removed. Source/design primitives are maintained in `workspace/src/apps/web`; app entry packages live in `customer-web`, `operator-web` and `admin-web`.

Configure SePay with the variables in the root `.env.example`. The Docker stack uses SePay for live checkout.

The Docker admin app uses live APIs through the gateway, including organization
lists, profiles and updates stored in PostgreSQL. Sign in with the local seed
account `admin.seed@example.test` / `AdminPass1234`. Customer and operator build
modes are configured separately in `docker-compose.apps.yml`.

Admin lists, filters, staff profiles/memberships and transaction details use live
services. Payment/refund dates and transaction histories come from the backend.
For an existing local database, restart `db-bootstrap` before rebuilding services
so that pending migrations are applied without resetting volumes.

With the Docker stack running, verify the full admin flow in headless Chromium:

```bash
cd workspace/src/apps/web
node scripts/verify-admin-live.mjs
```

This check creates isolated staff/organization records, exercises profile and
membership changes, verifies transaction filters/history/links, then removes only
the records it created. It does not use the interactive browser or initiate
payments/refunds.

The BLUE image installs the exact pnpm version and frozen lockfile. Build argument `APP_TARGET` selects customer/operator/admin, `API_MODE` defaults to mock for the standalone demo. Live API integration is an explicit opt-in and is not part of desktop mock acceptance.
Nginx proxies `/api/` to `gateway:8080`, so the browser uses the same origin;
no local `.env` or `localhost:5080` is baked into the image. Nested routes use
React Router's `__spa-fallback.html`, including on refresh.

After frontend changes, rebuild and replace only its container (with the stack
already running):

```bash
docker compose -f docker-compose.yml -f docker-compose.apps.yml up -d --build --no-deps customer-web
docker compose -f docker-compose.yml -f docker-compose.apps.yml logs --tail=100 customer-web
```

Stop a Vite dev server using port 5173 before starting the Docker web container.
Check container status with `docker compose -f docker-compose.yml -f docker-compose.apps.yml ps`.
Stop the stack without removing database volumes with
`docker compose -f docker-compose.yml -f docker-compose.apps.yml down`.

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
| redis | 6379 | Shared cache for public Transport search and explore routes |
| mailpit | 1025 / 8025 | SMTP capture |

Transport caches successful public trip searches for up to 10 seconds and the explore route list for 30 seconds. Search keys include all filters, sorting and pagination. Transport advances the cache generation when relevant API writes succeed and when it processes inventory-ready events. Cache misses and Redis outages fall back to PostgreSQL. The customer web still fetches current seat availability separately from Booking. Docker defaults to `redis:6379`. Set `REDIS_CONNECTION` to override that endpoint. A standalone Transport API uses PostgreSQL directly when `ConnectionStrings:Redis` is unset.

Credentials are local-dev only (`platform` / `postgres` or `.env`). Do not use production secrets.

`db-bootstrap` applies `docs/database/_shared/000_integration_tables.sql` then each service `001_initial.sql`, tracked in `schema_migrations`.

## Báo cáo Operator và Power BI trên Docker

Nếu các cổng phát triển chuẩn đang được dùng, chạy từ thư mục này:

```powershell
docker compose -f docker-compose.yml -f docker-compose.apps.yml -f docker-compose.operator-bi.yml up -d --build --wait operator-web
```

Operator dùng API live qua gateway và mở tại http://127.0.0.1:5184/operator/reports. PostgreSQL được giới hạn ở địa chỉ loopback `127.0.0.1:55474` để một Power BI gateway chạy trên máy Windows có thể kết nối. Đặt `OPERATOR_POWER_BI_EMBED_URL` trước khi build để chọn báo cáo nhúng. Quy trình tạo dự án live, giới hạn dữ liệu theo nhà xe và bật lịch làm mới nằm trong `workspace/analytics/power-bi/README.md`.
