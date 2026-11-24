\ir common.sql

-- Create inventory only for trips that were published in the fixture history.
INSERT INTO trip_snapshots (
  trip_id, organization_id_external, route_id_external, bus_id_external,
  origin_stop_id_external, destination_stop_id_external, departure_at, arrival_at,
  currency, status, sellable, source_trip_version, route_snapshot, bus_snapshot,
  fare_policy_snapshot, created_at, updated_at
)
SELECT trip.id, trip.organization_id, trip.route_id, trip.bus_id,
       trip.origin_stop_id, trip.destination_stop_id, trip.departure_at, trip.arrival_at,
       'VND', trip.status, trip.sellable, 1, trip.route_snapshot, trip.bus_snapshot,
       trip.fare_policy_snapshot, trip.created_at, trip.updated_at
FROM demo_trips trip
WHERE EXISTS (SELECT 1 FROM demo_trip_seats seat WHERE seat.trip_id = trip.id)
ON CONFLICT (trip_id) DO NOTHING;

-- The booking item foreign key is deferred while the inventory, hold and order
-- rows are created in the same transaction. Terminal orders release inventory.
SET CONSTRAINTS fk_trip_seats_active_booking_item DEFERRED;

INSERT INTO trip_seats (
  id, trip_id, source_seat_id_external, seat_code, seat_type, deck, row_no,
  column_no, price, status, active_booking_item_id, updated_at
)
SELECT seat.id, seat.trip_id, seat.source_seat_id, seat.code, seat.seat_type, seat.deck,
       seat.row_no, seat.column_no, seat.price,
       CASE WHEN booked.id IS NULL THEN 'AVAILABLE' ELSE 'BOOKED' END,
       booked.id, greatest(seat.updated_at, booked.updated_at)
FROM demo_trip_seats seat
LEFT JOIN (
  SELECT item.id, item.trip_seat_id,
         greatest(demo_order.created_at, demo_order.paid_at, demo_order.completed_at) AS updated_at
  FROM demo_order_seats item
  JOIN demo_orders demo_order ON demo_order.id = item.booking_id
  WHERE demo_order.status IN ('PENDING_PAYMENT', 'CONFIRMED', 'PAID', 'COMPLETED')
) booked ON booked.trip_seat_id = seat.id
ON CONFLICT (id) DO NOTHING;

-- Creating a booking consumes its hold. The payment deadline is the same as
-- the original hold deadline, even when the booking later expires unpaid.
INSERT INTO seat_holds (
  id, trip_id, customer_id_external, idempotency_key, hold_token_hash, status,
  total_amount, currency, created_at, expires_at, consumed_at
)
SELECT hold_id, trip_id, customer_id, 'pbl6-operating-demo:' || hold_id,
       upper(encode(sha256(convert_to('hold:' || hold_id, 'UTF8')), 'hex')),
       'CONSUMED', subtotal, 'VND', expires_at - interval '10 minutes', expires_at, created_at
FROM demo_orders
ON CONFLICT (id) DO NOTHING;

INSERT INTO seat_hold_items (seat_hold_id, trip_seat_id, seat_code, unit_price)
SELECT hold_id, trip_seat_id, seat_code, unit_price
FROM demo_order_seats
ON CONFLICT (seat_hold_id, trip_seat_id) DO NOTHING;

CREATE TEMP TABLE demo_new_bookings ON COMMIT DROP AS
WITH inserted AS (
  INSERT INTO bookings (
    id, booking_code, seat_hold_id, trip_id, organization_id_external, customer_id_external,
    contact_name, contact_email, contact_phone, payment_channel, status, subtotal_amount,
    total_amount, currency, expires_at, paid_at, cancelled_at, completed_at, refunded_at,
    cancellation_fee, refund_amount, created_at, updated_at
  )
  SELECT id, booking_code, hold_id, trip_id, organization_id, customer_id,
         customer_name, customer_email, customer_phone, payment_channel, status, subtotal,
         total, 'VND', expires_at, paid_at, cancelled_at, completed_at, refunded_at,
         cancellation_fee, refund_amount, created_at,
         greatest(created_at, paid_at, cancelled_at, completed_at, refunded_at,
                  CASE WHEN status = 'EXPIRED' THEN expires_at END)
  FROM demo_orders
  ON CONFLICT (id) DO NOTHING
  RETURNING id
)
SELECT id FROM inserted;

INSERT INTO booking_items (
  id, booking_id, trip_seat_id, source_seat_id_external, seat_code, unit_price, line_total, created_at
)
SELECT item.id, item.booking_id, item.trip_seat_id, item.source_seat_id, item.seat_code,
       item.unit_price, item.unit_price, demo_order.created_at
FROM demo_order_seats item
JOIN demo_orders demo_order ON demo_order.id = item.booking_id
ON CONFLICT (id) DO NOTHING;

INSERT INTO passengers (
  id, booking_item_id, full_name, pickup_stop_id_external, dropoff_stop_id_external, created_at
)
SELECT item.passenger_id, item.id, item.passenger_name, item.pickup_stop_id,
       item.dropoff_stop_id, demo_order.created_at
FROM demo_order_seats item
JOIN demo_orders demo_order ON demo_order.id = item.booking_id
ON CONFLICT (id) DO NOTHING;

-- The ticket API signs a fresh customer QR from the ticket ID. The stored
-- field is unique and the ticket's public code also works with manual scan.
INSERT INTO tickets (
  id, booking_id, booking_item_id, public_code, qr_token_hash, payment_channel, status,
  issued_at, checked_in_at, checked_in_by_external, used_at, cancelled_at, refunded_at
)
SELECT item.ticket_id, item.booking_id, item.id, item.ticket_code,
       upper(encode(sha256(convert_to('ticket:' || item.ticket_id, 'UTF8')), 'hex')),
       demo_order.payment_channel, item.ticket_status, item.issued_at, item.checked_in_at,
       item.checked_in_by, item.used_at, item.cancelled_at, item.refunded_at
FROM demo_order_seats item
JOIN demo_orders demo_order ON demo_order.id = item.booking_id
WHERE item.ticket_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Reporting fixtures already contain this context. A repeat run leaves any
-- real events emitted after interacting with the sample bookings alone.
UPDATE outbox_messages message
SET published_at = message.occurred_at
FROM demo_new_bookings booking
WHERE message.aggregate_id = booking.id
  AND message.message_type = 'BookingRevenueContextRecorded'
  AND message.published_at IS NULL;
