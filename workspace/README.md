# Development Workspace

Source lives here. Documents stay in [`../docs/`](../docs/README.md); delivery tracking stays in [`../task-tracking/`](../task-tracking/README.md).

## Commands

From `workspace/`:

```bash
dotnet restore
dotnet build
dotnet test
npm install
npm run dev:customer
npm run dev:backoffice
```

## Run (dev / test)

Infra only (Postgres, Rabbit, Redis, Mailpit, VNPay simulator):

```bash
docker compose -f src/infra/docker-compose.yml up -d --wait
./scripts/dev-host.ps1
npm run dev:customer    # http://localhost:5173
npm run dev:backoffice  # http://localhost:5174
```

Full Docker (infra + Gateway + 6 APIs + both web apps):

```bash
./scripts/dev-docker.ps1
```

HTTP:

- Customer web: `http://localhost:5173`
- Back-office: `http://localhost:5174`
- Gateway: `http://localhost:5080`
- Mailpit: `http://localhost:8025`
- VNPay simulator: `http://localhost:8099`

Seed logins (local/test only):

| App | Email | Password |
|---|---|---|
| Customer | seed.customer@example.test | CustomerPass1 |
| Operator | operator.seed@example.test | OperatorPass1 |
| Platform admin | admin.seed@example.test | AdminPass1234 |
| Driver | driver.seed@example.test | DriverPass1 |

Search seed trip: Seed Origin → Seed Destination on 2026-12-01.

Development appsettings blank the connection strings. `dev-host.ps1` sets `ConnectionStrings__*` and `MESSAGING__AMQPURI` so `/ready` works against Docker Postgres/Rabbit.
