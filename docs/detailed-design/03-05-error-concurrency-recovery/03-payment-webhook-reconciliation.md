# 3.5.3 Payment Webhook và Reconciliation

## Outcome decision

| Signal | Local action |
|---|---|
| Redirect/deep link | Không đổi final state; client GET Payment |
| Provider request timeout | Giữ `PROCESSING`; chờ webhook/reconcile |
| Verified success, amount/currency match | `SUCCEEDED` + Outbox once |
| Verified final failure | `FAILED` nếu state permits |
| Invalid signature/replay mismatch | Reject, metric/audit; không business success |
| Duplicate verified event | Idempotent 2xx after persisted result lookup |
| Contradicts local `SUCCEEDED` | Không downgrade; open ReconciliationCase |

## Webhook transaction

Unique receipt insert và Payment lock phải ngăn hai instance apply cùng outcome. State transition + receipt processed + Outbox atomic. ACK provider không chờ RabbitMQ publish; Outbox guarantees later handoff.

## Reconciliation worker

Candidate query: Payment `PROCESSING` quá threshold, webhook gap, provider/local mismatch, Refund uncertain hoặc manual request. Worker:

1. Claim candidate có lock/lease hữu hạn.
2. Query provider bằng provider transaction/reference, không charge lại.
3. Verify response như webhook.
4. Apply state idempotently hoặc update/open case.
5. Record attempt, safe result, next action và correlation.

Backoff/maximum age là provider/configuration specific. Circuit breaker tránh cascade; case quá SLA alert Finance/Operations.

## Late success compensation

Payment vẫn ghi `SUCCEEDED` vì đó là sự thật tài chính. Booking consumer nếu không confirm được seat sẽ persist compensation/manual state và phát `PaymentCompensationRequested`. Payment tạo Refund cùng logical reference; nếu Refund fail, Ticket/seat không bị chiếm lại và ReconciliationCase còn mở.

## Manual action

Yêu cầu explicit permission, reason, expected version, current provider evidence và idempotency key. Manual action không trực tiếp update Payment state bằng SQL/admin console; phải đi application command và audit.

