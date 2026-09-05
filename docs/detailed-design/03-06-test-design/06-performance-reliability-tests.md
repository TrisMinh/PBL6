# 3.6.6 Performance, Reliability và Observability Tests

## Performance scenarios

| NFR | Workload/data | Pass threshold |
|---|---|---|
| `NFR-PERF-001` | 300 concurrent users, ≥100,000 Trip, representative search mix | p95 ≤2s; p99 ≤4s |
| `NFR-PERF-002` | Trip detail/seat availability at 300 concurrent | p95 ≤1.5s |
| `NFR-PERF-003` | SeatHold with realistic contention | p95 ≤1s; no double-book |
| `NFR-PERF-004` | Normal CRUD baseline | p95 ≤1s |
| `NFR-PERF-005` | Valid payment webhook persist+ack | p95 ≤2s; downstream excluded |
| `NFR-PERF-006` | Online report | ≤10s; larger request becomes ExportJob |
| `NFR-PERF-007` | Full load/concurrency | zero duplicate logical Booking/Payment/Ticket/Refund |

Report environment CPU/memory/replicas/DB/Rabbit/Redis versions, dataset distribution, warm-up, duration, request mix, error rate và percentile method. Không loại slow/error sample tùy ý.

## Reliability/fault scenarios

- Stop RabbitMQ: API business transaction + Outbox persists; backlog drains after recovery without duplicate effect.
- Stop Notification/Reporting: Booking/Payment completes; queues catch up and `dataAsOf` reflects lag.
- Provider timeout/5xx: Payment stays PROCESSING or Notification retries, circuit opens without thread/pool exhaustion.
- Kill consumer after commit before ACK: redelivery dedupe.
- Database failover/restart: no partial multi-seat hold; uncertain command resolved via idempotency/status.
- Restore/PITR rehearsal demonstrates RPO ≤15 minutes and RTO ≤4 hours with integrity validation.

## Availability measurement

Customer API monthly target 99.5%, excluding announced maintenance as approved. Define synthetic probe, successful status semantics, sampling interval and partial outage handling before measurement.

## Observability assertions

- One payment Booking trace follows Gateway → Payment webhook/outbox → RabbitMQ → Booking → Notification/Reporting using correlation/trace/causation IDs.
- Metrics: latency/error/rate, DB pool/lock, queue ready/unacked/oldest, outbox age, DLQ, hold expiry, payment success, refund failure.
- Alerts fire and resolve for high error rate, unavailable service, queue age/backlog, signature failure spike and Refund failure.
- Telemetry contains safe IDs/error codes and no forbidden PII/secret.

