# 3.4.6 Threat Model và Security Verification

## STRIDE-focused threats

| Threat | Asset/path | Control | Verification |
|---|---|---|---|
| Spoofed User/token | Protected API | issuer/audience/alg/time/key validation, short TTL | forged/expired/wrong-audience tests |
| Session replay | Refresh endpoint | token hash, rotation, reuse detection | reuse old token concurrency test |
| Tenant escalation | IDs/body/query | resource-derived tenant + scoped repository | cross-tenant negative suite |
| Price/amount tampering | Booking/Payment request | server pricing, trusted payment snapshot | lower-total/wrong-currency tests |
| Double booking | SeatHold concurrency | row lock, state owner constraint, idempotency | barrier concurrency test |
| Webhook spoof/replay | Provider endpoint | raw signature, timestamp, unique event/transaction | invalid/duplicate/late tests |
| QR forgery/reuse | Check-in | signed/random token, server Trip/state check | wrong Trip/cancelled/replay tests |
| Message forgery/schema abuse | RabbitMQ consumer | ACL, schema/version validation, Inbox | unsupported/malformed event tests |
| Repudiation | Admin/payment/check-in | append-oriented audit + correlation | audit completeness/immutability tests |
| Sensitive-data disclosure | logs/export/manifest | minimization, mask, expiry, permission | log scan/export/manifest tests |
| DoS/resource exhaustion | auth/search/webhook/export | rate/body/query limits, async export, bulkhead | limit/load tests |
| Dependency/supply-chain compromise | build/image/library | lock/pin, SAST/SCA/image/secret scan | CI policy gate |

## Release security gate

- No unresolved critical vulnerability unless risk acceptance has owner/expiry/mitigation.
- Auth/tenant/payment/check-in negative tests pass.
- Secret scan and log redaction test pass.
- Dependency/container scan result archived.
- CORS/CSRF/TLS/security headers checked in deployment-like environment.
- Webhook signature/replay suite and audit trace verified.
- Restore/replay uses sanitized test data and does not leak production data.

Security findings được quản lý như defect có severity, owner, due date và evidence; không đánh dấu pass chỉ bằng checklist không có test/log.

