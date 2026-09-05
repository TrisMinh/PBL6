# 3.5.2 Concurrency và Idempotency

## Command algorithm

1. Validate `Idempotency-Key` syntax/length và authenticate actor.
2. Canonicalize business request; hash không gồm volatile header/correlation ID.
3. Insert/load record theo `(actorScope,operation,target,key)` trong transaction.
4. Existing completed + same hash: trả exact logical result/resource.
5. Existing + different hash: `IDEMPOTENCY_CONFLICT`.
6. Existing processing: `IDEMPOTENCY_IN_PROGRESS`/status URL.
7. New: execute invariant checks/state mutation + store response reference + Outbox, commit.

Không giữ raw request secret trong record. Nếu response chứa short-lived URL/token, lưu resource/status rồi regenerate authorized response thay vì replay secret.

## SeatHold concurrency

- Sort seat IDs, `SELECT ... FOR UPDATE`, verify exact count + every `AVAILABLE` + Trip sellable.
- Insert entire SeatHold/items and update all owner/state in one transaction.
- Một ghế fail → rollback mọi ghế; database state/constraint là final guard.
- Expiry worker và request path cùng lock/check ownership; worker chỉ release TripSeat vẫn trỏ đúng hold.
- Redis expiry signal có thể lặp/mất; không quyết định seat state.

## Booking/Payment/Ticket

| Race | Guard |
|---|---|
| Hai create Booking từ một hold | Lock SeatHold + unique `bookings.seat_hold_id` |
| Booking create lặp | HTTP idempotency record + one-hold constraint |
| Webhook lặp | unique provider event/transaction + Payment state guard |
| Payment event redelivery | Booking Inbox + Booking state + unique Ticket booking item |
| Check-in lặp | Ticket row lock/version + source state guard |
| Cancel lặp | idempotency + state/cancellation logical reference |
| Promotion quota race | conditional atomic increment + redemption unique |
| Refund race | lock Payment + logical refund unique + remaining amount calculation |

## Optimistic concurrency

Admin/operator/profile mutation nhận `If-Match` hoặc `expectedVersion`. SQL update có `where id=? and row_version=?`; affected row 0 → reload visible resource và trả `VERSION_CONFLICT`. Không last-write-wins cho role, Trip, policy, payment intervention hoặc moderation.

## Lock/deadlock policy

- Lock multi-row theo stable sorted key.
- Transaction ngắn, không gọi network/broker/provider khi giữ lock.
- Deadlock/serialization retry giới hạn với jitter và chỉ trên command đã có idempotency.
- Metric lock wait/deadlock/seat conflict; không tăng timeout để che contention.

