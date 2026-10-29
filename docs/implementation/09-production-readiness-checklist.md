# Production readiness checklist

## Automated release gates

- [ ] Full .NET solution tests pass.
- [ ] OpenAPI contract tests pass and every operation has a safe default error response.
- [ ] Customer Web and Back-office production builds pass.
- [ ] Mobile TypeScript check and Android Expo/Hermes export pass.
- [ ] Production configuration preflight passes with deployment secrets.
- [ ] Docker images build without root application runtimes.
- [ ] Fresh production-shaped stack reaches healthy state.
- [ ] Gateway, customer and back-office smoke checks pass after restart.
- [ ] Full deterministic Postman Round 2 passes more cases than Round 1.
- [ ] Repository secret scan and dependency audit are reviewed.

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

## Verification evidence — 2026-10-29

- Full solution: 99/99 .NET tests passed; NuGet reported no known vulnerable direct or transitive packages.
- Clients: both Vite production builds passed; Expo Android Hermes export passed with 930 modules and a 2.1 MB bundle.
- Containers: nine application images built; every infrastructure, API, gateway and web container became healthy under the production overlay.
- Runtime isolation: API UID `1654`, web UID `101`, read-only root filesystems, internal service ports unpublished; web ports bound only to `127.0.0.1`.
- Recovery: gateway, booking and payment restart returned to healthy; public web health, gateway readiness and trip-search smoke returned HTTP 200.
- Data protection: six database dumps and checksums created; all dumps restored successfully into isolated temporary databases (8–14 public tables) and were removed afterward.
- Secret signature scan found no private key, AWS, GitHub or OpenAI token pattern in tracked source.
- `npm audit fix` removed the critical `shell-quote` and high `source-map-js` findings. Eight Expo build-tool advisories remain (5 low, 3 high in Expo CLI/config/Zod); npm offers only an incompatible downgrade to Expo 51. They are not shipped in the web images or Android runtime bundle and remain tracked for an upstream-compatible Expo update.
