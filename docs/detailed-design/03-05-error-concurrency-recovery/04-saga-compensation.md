# 3.5.4 Saga và Compensation

Saga dùng choreography với durable local state/Outbox; không có distributed transaction coordinator.

## Payment → Ticket saga

| Step | Owner | Commit/message | Failure action |
|---:|---|---|---|
| 1 | Payment | Payment `SUCCEEDED` + `PaymentSucceeded` | Outbox retry nếu broker lỗi |
| 2 | Booking | Inbox + Booking `PAID` + seat `BOOKED` + Tickets + events | Duplicate no-op; invariant fail → compensation/manual |
| 3 | Notification | Inbox + Notification/attempt | Retry/DLQ; không rollback step 1–2 |
| 4 | Reporting | Inbox + projection | Retry/rebuild; không rollback |

Compensation khi step 2 không thể commit vì late payment/seat lost: request full refund, giữ Booking non-PAID/compensation-visible, alert nếu refund fail.

## Customer cancellation saga

1. Booking validates fresh preview and commits Ticket `CANCELLED`, conditional seat release, RefundRequested + notification/report events.
2. Payment creates/processes Refund.
3. RefundSucceeded makes Booking/Ticket converge `REFUNDED`; RefundFailed keeps Ticket `CANCELLED` and exposes support state.

Không khôi phục Ticket chỉ vì provider refund lỗi.

## Trip cancellation batch saga

- Transport commits Trip `CANCELLED` + event once.
- Booking creates cancellation job/checkpoint keyed trip/version; processes affected Booking pages deterministically.
- Mỗi Ticket/cancellation/refund reference unique; restart resumes checkpoint and rechecks state.
- Payment, Notification, Reporting independent consumers; dashboard shows total/processed/refund pending/failed.

## Ticket change saga

| Point | Old Ticket | New seat/hold | Financial action |
|---|---|---|---|
| Before eligibility | ISSUED | None | None |
| New hold ready | ISSUED | HELD | Preview delta |
| Additional payment pending | ISSUED | HELD | PROCESSING |
| Commit swap | CANCELLED | BOOKED + new ISSUED | Payment/refund reference recorded |
| Failure before commit | ISSUED | Released | Refund extra payment if charged |
| Failure after partial commit | Recovery lock/manual case | Do not allow two valid tickets | Compensate with audit |

Mỗi saga instance có stable ID, status, correlation ID, current step, last error, attempt count và timestamps. Không để workflow “mất” chỉ trong log.

