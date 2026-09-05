# 3.3.4 Booking Database

Logical DB/schema: `booking_db`; ERD: [Booking](../../system-design/02-07-database-erd/03-booking-db.md). Đây là concurrency boundary chống double-booking.

## Aggregate tables

| Nhóm | Tables | Guard chính |
|---|---|---|
| Trip inventory | `trip_snapshots`, `trip_seats` | unique trip/seat, state + active owner + row version |
| Hold | `seat_holds`, `seat_hold_items` | one logical hold/key, ACTIVE expiry, all-or-nothing |
| Booking | `bookings`, `booking_items`, `passengers` | one Booking per hold; one Passenger per item |
| Ticket | `tickets` | unique booking item/public code/QR hash |
| Promotion | `promotions`, `promotion_redemptions` | scope/code, quota, unique booking redemption |
| Review/support | `reviews`, `support_cases`, `support_case_history` | one review per Ticket; append history |

## TripSeat constraints

```sql
alter table trip_seats add constraint uq_trip_seat_source unique (trip_id, source_seat_id_external);
alter table trip_seats add constraint uq_trip_seat_code unique (trip_id, seat_code);
alter table trip_seats add constraint ck_trip_seat_owner check (
  (status = 'AVAILABLE' and active_hold_id is null and active_booking_item_id is null) or
  (status = 'HELD' and active_hold_id is not null and active_booking_item_id is null) or
  (status = 'BOOKED' and active_hold_id is null and active_booking_item_id is not null) or
  (status = 'DISABLED' and active_hold_id is null and active_booking_item_id is null)
);
```

Nullable owner FK được tạo `DEFERRABLE INITIALLY DEFERRED` nếu circular insert cần thiết. State/owner update vẫn cùng transaction.

## Atomic multi-seat hold

```sql
begin;

select id, status, row_version
from trip_seats
where trip_id = :trip_id and id = any(:sorted_seat_ids)
order by id
for update;

-- Verify exact count, TripSnapshot sellable, every status AVAILABLE.
-- Insert SeatHold + all items; update every TripSeat to HELD/active_hold_id.
-- Insert SeatHoldCreated into outbox; commit all or rollback all.

commit;
```

Không “update các ghế còn trống rồi báo partial success”. Request lặp được xử lý ở idempotency table trước/đồng transaction; DB lock theo ID ổn định giảm deadlock.

## Booking/Ticket constraints

- `bookings.seat_hold_id` unique; create Booking lock SeatHold và chỉ consume `ACTIVE` một lần.
- `booking_items(booking_id,trip_seat_id)` unique.
- `passengers.booking_item_id` unique, not null sau create complete.
- `tickets.booking_item_id`, `public_code`, `qr_token_hash` unique.
- Booking `PAID` ticket completeness được bảo đảm trong application transaction + deferred constraint/verification query; reconciliation job phát hiện gap không thể xảy ra bình thường.
- Booking/Ticket/Passenger snapshot sau PAID không update trực tiếp; đổi vé tạo audited workflow.

## Promotion concurrency

```sql
update promotions
set redeemed_count = redeemed_count + 1,
    row_version = row_version + 1
where id = :promotion_id
  and status = 'ACTIVE'
  and :now between valid_from and valid_to
  and redeemed_count < quota;
```

Affected row phải bằng 1 rồi insert `promotion_redemptions` unique `(promotion_id,booking_id)`. Cùng transaction với Booking; failure rollback quota.

## Index baseline

- `trip_seats(trip_id,status)` include seat code/price/version.
- Partial `seat_holds(expires_at)` where status=`ACTIVE`.
- `bookings(customer_id_external,created_at desc)` và `(trip_id,status)`.
- `tickets(public_code)`, `(booking_item_id)`, `(status,checked_in_at)`.
- `reviews(ticket_id)` unique; public query `(trip_id,status,created_at desc)` qua local denormalized trip reference.
- Support `(organization_id_external,status,updated_at desc)` và transaction reference indexes.

