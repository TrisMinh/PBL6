# Production readiness checklist

## Automated release gates

- [x] Full .NET solution tests pass.
- [x] OpenAPI contract tests pass and every operation has a safe default error response.
- [x] Customer Web and Back-office production builds pass.
- [x] Mobile TypeScript check and Android Expo/Hermes export pass.
- [x] Production configuration preflight passes with deployment secrets.
- [x] Docker images build without root application runtimes.
- [x] Fresh production-shaped stack reaches healthy state.
- [x] Gateway, customer and back-office smoke checks pass after restart.
- [x] Full deterministic Postman Round 2 passes more cases than Round 1.
- [x] Repository secret scan and dependency audit are reviewed.

## Environment-owner gates

- [ ] DNS, valid TLS certificates, HTTPS redirect and HSTS configured.
- [ ] SMTP credentials verified using a real external mailbox.
- [ ] VNPay merchant/sandbox credentials and signed callback URL verified.
- [ ] Firewall exposes no PostgreSQL, RabbitMQ, Redis or service ports.
- [ ] Monitoring/alert destinations and log retention approved.
- [ ] Off-host encrypted backup destination and retention policy approved.
- [ ] Isolated restore drill meets agreed RPO/RTO.
- [ ] Privacy notice, operating contacts and incident escalation approved.

The release is deployable after automated gates are green. It is not authorized for real customer traffic until every environment-owner gate is signed off by the responsible operator.

## Verification evidence — 2026-10-30

- Full solution: 102/102 .NET tests passed; NuGet reported no known vulnerable direct or transitive packages.
- Clients: both Vite production builds passed; Expo Android Hermes export passed with 930 modules and a 2.1 MB bundle.
- Containers: nine application images built; every infrastructure, API, gateway and web container became healthy under the production overlay.
- Runtime isolation: API UID `1654`, web UID `101`, read-only root filesystems, internal service ports unpublished; web ports bound only to `127.0.0.1`.
- Recovery: gateway, booking and payment restart returned to healthy; public web health, gateway readiness and trip-search smoke returned HTTP 200.
- Data protection: six database dumps and checksums created; all dumps restored successfully into isolated temporary databases (8–14 public tables) and were removed afterward.
- Secret signature scan found no private key, AWS, GitHub or OpenAI token pattern in tracked source.
- `npm audit fix` removed the critical `shell-quote` and high `source-map-js` findings. Eight Expo build-tool advisories remain (5 low, 3 high in Expo CLI/config/Zod); npm offers only an incompatible downgrade to Expo 51. They are not shipped in the web images or Android runtime bundle and remain tracked for an upstream-compatible Expo update.
- Deterministic Postman Round 2 executed all 72 registered collections from a clean stack: 360/421 assertions passed (85.51%), versus 330/419 (78.76%) in Round 1. This is +30 passes, -28 failures and +6.75 percentage points. The 61 remaining failures are retained in the evidence rather than removed; most are legacy collections with stale runtime IDs.
- Final live smoke after the Round 2 run returned HTTP 200 for gateway `/health` and `/ready`, both web `/healthz` endpoints, and seeded public trip search. All 15 `pbl6-r2` containers remained healthy.
- Round 2 machine evidence is under `outputs/pbl6-round2/`; the reviewed workbook is `outputs/pbl6-round2/Test_Report_API_Postman_Round2.xlsx`.
