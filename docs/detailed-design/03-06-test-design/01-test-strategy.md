# 3.6.1 Test Strategy, Environment và Quality Gate

## Test levels

| Level | Scope | Dependency |
|---|---|---|
| Unit/domain | state transition, policy, money, authorization decision | In-memory/fakes only |
| Component | controller/handler/repository/consumer trong một service | Real PostgreSQL/RabbitMQ/Redis qua ephemeral container khi liên quan |
| Contract | OpenAPI request/response; JSON Schema message compatibility | Producer/consumer fixtures |
| Integration | transaction, constraint, Outbox/Inbox, provider adapter | Real infrastructure containers + provider simulator |
| E2E | Browser/Mobile/API critical business flow | Deployed test environment |
| Security | auth/tenant/ownership/webhook/log/privacy | Negative/adversarial tools |
| Performance/reliability | NFR latency/load/fault/recovery | Production-like topology/dataset |

Mock không được dùng để chứng minh PostgreSQL locking, RabbitMQ delivery, migration, provider signature hoặc tenant query correctness.

## Environments

| Environment | Mục đích | Data |
|---|---|---|
| Local | Fast unit/component development | Synthetic seed |
| CI ephemeral | Repeatable integration/contract/migration | Per-run isolated |
| QA | E2E, exploratory, accessibility | Synthetic multi-tenant |
| Performance | Load/fault with production-like sizing | ≥100,000 Trip baseline |
| Restore rehearsal | Backup/PITR/RTO verification | Sanitized backup fixture |

Không dùng production credential/PII ở môi trường thấp.

## Pipeline gates

1. Format/lint/static analysis and secret scan.
2. Unit/domain tests.
3. OpenAPI/event schema lint + breaking-change check.
4. Migration from empty and previous-version DB.
5. Integration tests with real PostgreSQL/RabbitMQ/Redis.
6. SAST/dependency/container scan and immutable artifact build.
7. Post-deploy smoke/contract/E2E in QA.
8. Scheduled/release-gated load, fault, DAST và restore test.

Flaky test không được rerun đến xanh rồi bỏ qua; phải quarantine có owner/due date và không được che suite critical.

