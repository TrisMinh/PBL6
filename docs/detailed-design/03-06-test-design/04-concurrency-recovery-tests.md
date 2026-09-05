# 3.6.4 Concurrency, Idempotency và Recovery Tests

## Deterministic concurrency cases

| ID | Setup/action | Expected invariant |
|---|---|---|
| `TC-CON-001` | 2–50 customers hit same AVAILABLE TripSeat behind a barrier | Exactly one ACTIVE hold; others `SEAT_UNAVAILABLE` |
| `TC-CON-002` | Hold A1+A2 while A2 concurrently acquired | Whole request fails; A1 remains AVAILABLE |
| `TC-CON-003` | Same Booking key/body from concurrent clients | One Booking ID; identical logical response |
| `TC-CON-004` | Same key with different body | One result + `IDEMPOTENCY_CONFLICT`; no second side effect |
| `TC-CON-005` | Quota=1, concurrent Promotion redemption | Successful redemption count ≤1 |
| `TC-CON-006` | Duplicate webhook 100 times/multiple instances | One Payment success event and one Ticket/item |
| `TC-CON-007` | Duplicate check-in concurrent | One transition/audit; repeat returns original time |
| `TC-CON-008` | Concurrent Refund requests near remaining cap | Sum SUCCEEDED/accepted within policy ≤ Payment amount |
| `TC-CON-009` | Concurrent Trip transition same version | One wins; other `VERSION_CONFLICT`/invalid state |

Test dùng barrier/latch và query authoritative DB after all workers; không kết luận chỉ từ HTTP response.

## Delivery/crash cases

| ID | Fault injection | Expected recovery |
|---|---|---|
| `TC-REC-001` | Broker down after business commit | Outbox pending; publishes after recovery |
| `TC-REC-002` | Publisher loses confirm after broker accepted | Possible duplicate; consumer Inbox one side effect |
| `TC-REC-003` | Consumer crash after DB commit before ACK | Redelivery ACK no-op via Inbox |
| `TC-REC-004` | Transient handler failure | 5s/30s/5m tier; no hot requeue loop |
| `TC-REC-005` | Invalid schema/version | DLQ with safe metadata; no side effect |
| `TC-REC-006` | Trip cancellation worker crash mid-batch | Resume checkpoint; no duplicate Refund |
| `TC-REC-007` | Payment success after hold lost | No double-book; compensation/manual case |
| `TC-REC-008` | Refund provider fails | Ticket stays CANCELLED; Refund visible/retryable/manual |

## Idempotency retention test

Within retention, retry returns same logical resource. After expiry, business unique/state constraints still prevent duplicate forbidden effects; expiry does not permit a second Payment success/Ticket/Refund for the same logical aggregate.

