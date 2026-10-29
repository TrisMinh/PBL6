# Production deployment runbook

## 1. Host prerequisites

- Linux host with Docker Engine and Docker Compose v2.24+; the checked version must support `!reset`.
- A TLS reverse proxy/load balancer with certificates for the customer and back-office hostnames.
- Firewall permits only `22`, `80` and `443`; database, RabbitMQ, Redis, gateway and service ports stay on the Compose network.
- An encrypted, access-controlled backup destination outside the application host.

## 2. Secrets and configuration

Copy `workspace/src/infra/production.env.example` to a protected location outside Git, replace every placeholder and restrict its permissions to the deployment account. Generate independent random values; do not reuse the database, RabbitMQ, JWT, SMTP or VNPay secrets.

Run the mandatory preflight from `workspace`:

```powershell
pwsh ./scripts/test-production-config.ps1 -EnvFile /secure/path/pbl6.production.env
```

The gate rejects missing/short/placeholder secrets, non-HTTPS browser origins, development-only services and an invalid Compose merge.

## 3. Build and deploy

From `workspace/src/infra`:

```bash
docker compose --env-file /secure/path/pbl6.production.env \
  -f docker-compose.yml -f docker-compose.apps.yml -f docker-compose.production.yml \
  build --pull
docker compose --env-file /secure/path/pbl6.production.env \
  -f docker-compose.yml -f docker-compose.apps.yml -f docker-compose.production.yml \
  up -d --wait
```

Configure the TLS proxy to forward the customer hostname to `127.0.0.1:${CUSTOMER_HTTP_PORT}` and the operations hostname to `127.0.0.1:${BACKOFFICE_HTTP_PORT}`. Preserve `Host`, `X-Forwarded-For` and `X-Forwarded-Proto`. Redirect HTTP to HTTPS and add HSTS at the TLS terminator.

## 4. Release verification

```bash
docker compose --env-file /secure/path/pbl6.production.env \
  -f docker-compose.yml -f docker-compose.apps.yml -f docker-compose.production.yml ps
curl --fail https://customer.example.vn/healthz
curl --fail https://ops.example.vn/healthz
curl --fail https://customer.example.vn/ready
```

All long-running services must be `healthy`. Verify registration email with a real mailbox, complete one low-value VNPay sandbox transaction, cancel it, and confirm payment/refund/settlement records before production traffic is enabled.

Restart recovery check:

```bash
docker compose --env-file /secure/path/pbl6.production.env \
  -f docker-compose.yml -f docker-compose.apps.yml -f docker-compose.production.yml restart gateway booking payment
docker compose --env-file /secure/path/pbl6.production.env \
  -f docker-compose.yml -f docker-compose.apps.yml -f docker-compose.production.yml up -d --wait
```

## 5. Backup and restore drill

Create a consistent logical backup of all six service databases:

```bash
docker compose --env-file /secure/path/pbl6.production.env \
  -f docker-compose.yml -f docker-compose.apps.yml -f docker-compose.production.yml \
  --profile ops run --rm pg-backup
```

Copy the timestamped directory and `SHA256SUMS` off-host. Verify checksums before restore. Quarterly, restore each dump into an isolated PostgreSQL instance with `pg_restore --create --clean --if-exists`; run `/ready`, login, trip search, booking lookup and settlement readback against that isolated environment. Never run a restore drill against the live database server. Retention target: 7 daily, 4 weekly and 12 monthly backups; encrypt backups at rest and test recovery-time/recovery-point objectives with the system owner.

On a dedicated restore-drill stack (never the live PostgreSQL server), the bundled verifier restores all dumps into temporary `restore_verify_*` databases, checks their schemas and removes them:

```bash
BACKUP_SET=pbl6-YYYYMMDDTHHMMSSZ docker compose --env-file /secure/path/pbl6.production.env \
  -f docker-compose.yml -f docker-compose.apps.yml -f docker-compose.production.yml \
  --profile ops run --rm pg-restore-verify
```

## 6. Rollback and operations

Tag every image with the Git commit. Roll back by pinning the prior immutable tags and running `up -d --wait`; do not roll database files backward. Database schema changes in this release are idempotent bootstrap SQL, but restore is the last resort for an incompatible future migration.

Use `docker compose logs --since 15m <service>` and correlation IDs for incident diagnosis. Rotate secrets after suspected disclosure. Patch base images and npm/NuGet dependencies on a scheduled cadence, then rerun the complete release gate and Postman suite.
