# 3.5 Error, Concurrency & Recovery

Thiết kế failure path là một phần của correctness. Không được coi timeout là business failure cuối, retry mọi thứ một cách mù quáng hoặc che trạng thái dở dang không thể đối soát.

## Danh mục

- [3.5.1 Error contract và catalog](./01-error-contract-catalog.md)
- [3.5.2 Concurrency và idempotency](./02-concurrency-idempotency.md)
- [3.5.3 Payment webhook và reconciliation](./03-payment-webhook-reconciliation.md)
- [3.5.4 Saga và compensation](./04-saga-compensation.md)
- [3.5.5 RabbitMQ retry, DLQ và replay](./05-rabbitmq-retry-dlq.md)
- [3.5.6 Timeout, retry, circuit breaker và health](./06-resilience-health.md)

## Nguyên tắc

- Business error ổn định bằng code; technical detail chỉ ở safe internal telemetry.
- Invariant dựa DB transaction/constraint/state guard, không dựa cache/UI.
- Retry chỉ khi operation idempotent và failure transient đã phân loại.
- Workflow nhiều service có durable state, correlation và đường retry/compensation/manual case.

