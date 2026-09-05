# 3.5.6 Timeout, Retry, Circuit Breaker và Health

## Call policy

| Dependency | Timeout/retry principle | Fallback |
|---|---|---|
| Service query | Deadline nhỏ hơn caller remaining deadline; retry GET ít lần+jitter | Cache/stale chỉ khi use case cho phép và ghi dataAsOf |
| Service command | Không retry trừ khi idempotency guaranteed | Query status/idempotency result |
| Payment provider | Provider-specific connect/overall timeout; no blind charge retry | PROCESSING + webhook/reconcile |
| Notification provider | Bulkhead/channel timeout; background retry | Persist attempt, business transaction unaffected |
| RabbitMQ publish | Publisher confirm timeout; Outbox remains pending | Background retry |
| PostgreSQL | Statement/lock timeout theo query class | Retry limited transient transaction |

Giá trị số ngoài NFR phải nằm trong environment config và được load/failure test; không dùng một timeout cho mọi dependency.

## Circuit breaker và bulkhead

- Circuit breaker cho external provider/unstable remote; half-open probe giới hạn.
- Không circuit-break local DB theo cách trả success giả.
- Separate connection/thread pools cho public API, payment webhook, outbox, notification và export workload.
- Queue prefetch hữu hạn; Booking/Payment bắt đầu nhỏ rồi tune theo processing time/redelivery.

## Health endpoints

| Endpoint | Meaning |
|---|---|
| `/live` | Process/event loop sống; không phụ thuộc mọi external provider |
| `/ready` | Instance có thể nhận workload; kiểm tra dependency thiết yếu theo component |
| `/startup` | Cho migration/warmup dài mà không bị restart sớm |

Notification provider down không nhất thiết làm Booking `/ready` fail. Broker down không làm business commit đã có Outbox mất; readiness của publisher/consumer worker có thể fail riêng để orchestration xử lý.

## Degradation

- Search có thể dùng cache/stale read rõ timestamp; SeatHold luôn revalidate DB.
- Reporting lag trả `dataAsOf`; không trình bày realtime.
- Notification failure không chặn Ticket in-app.
- Payment unknown trả PROCESSING; không tự yêu cầu charge lại.

Telemetry tối thiểu: request latency/error/rate, DB pool/lock, outbox oldest age, queue ready/unacked/oldest, redelivery/DLQ, provider latency/error, hold expiry, Payment success và Refund failure.

