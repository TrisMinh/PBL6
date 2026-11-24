\ir common.sql
\ir finance-common.sql

INSERT INTO booking_projections (booking_id, booking_code, organization_id_external, customer_id_external,
  trip_id_external, route_name, departure_at, status, payment_channel, seat_count, gross_amount,
  cancellation_fee, refunded_amount, net_amount, currency, booked_at, paid_at, cancelled_at,
  source_version, data_as_of, updated_at)
SELECT f.id, f.booking_code, f.organization_id, f.customer_id, f.trip_id, r.name, f.departure_at,
  f.status, f.payment_channel, seats.seat_count, f.total, COALESCE(f.cancellation_fee, 0), f.refunded_amount,
  f.total - f.refunded_amount, 'VND', f.created_at, f.paid_at, f.cancelled_at,
  1, f.last_activity_at, f.last_activity_at
FROM demo_finance f
JOIN demo_trips t ON t.id = f.trip_id
JOIN demo_routes r ON r.id = t.route_id
JOIN (SELECT booking_id, count(*)::integer AS seat_count FROM demo_order_seats GROUP BY booking_id) seats
  ON seats.booking_id = f.id
ON CONFLICT DO NOTHING;

-- Booking's inventory reserves pending-payment seats and releases expired and cancelled seats.
WITH active_seats AS (
  SELECT s.trip_seat_id,
    bool_or(COALESCE(s.ticket_status IN ('CHECKED_IN', 'USED'), false)) AS boarded,
    max(greatest(o.created_at, o.paid_at, o.completed_at, s.checked_in_at, s.used_at)) AS updated_at
  FROM demo_order_seats s
  JOIN demo_orders o ON o.id = s.booking_id
  WHERE o.status IN ('PENDING_PAYMENT', 'CONFIRMED', 'PAID', 'COMPLETED')
  GROUP BY s.trip_seat_id
)
INSERT INTO occupancy_projections (trip_id, organization_id_external, route_id_external, route_name,
  departure_at, status, capacity, available_count, held_count, booked_count, checked_in_count,
  source_version, data_as_of, updated_at)
SELECT t.id, t.organization_id, t.route_id, r.name, t.departure_at, t.status,
  count(*)::integer, count(*) FILTER (WHERE occupied.trip_seat_id IS NULL)::integer, 0,
  count(*) FILTER (WHERE occupied.trip_seat_id IS NOT NULL)::integer,
  count(*) FILTER (WHERE occupied.boarded)::integer,
  1, greatest(t.updated_at, max(seat.updated_at), max(occupied.updated_at)),
  greatest(t.updated_at, max(seat.updated_at), max(occupied.updated_at))
FROM demo_trips t
JOIN demo_routes r ON r.id = t.route_id
JOIN demo_trip_seats seat ON seat.trip_id = t.id
LEFT JOIN active_seats occupied ON occupied.trip_seat_id = seat.id
WHERE t.status <> 'DRAFT'
GROUP BY t.id, t.organization_id, t.route_id, r.name, t.departure_at, t.status, t.updated_at
ON CONFLICT DO NOTHING;

-- The legacy projection attributes captures and subsequent refunds to the booking date.
INSERT INTO revenue_projections (organization_id_external, period_date, currency, gross_revenue,
  refund_amount, cancellation_fee, platform_commission, operator_payable, net_revenue,
  paid_booking_count, cancelled_booking_count, data_as_of, updated_at)
SELECT organization_id, (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, 'VND',
  sum(captured_amount)::bigint, sum(refunded_amount)::bigint,
  sum(CASE WHEN captured_at IS NOT NULL THEN COALESCE(cancellation_fee, 0) ELSE 0 END)::bigint,
  sum(remaining_commission)::bigint, sum(remaining_amount - remaining_commission)::bigint,
  sum(remaining_amount)::bigint, count(captured_at)::integer, count(cancelled_at)::integer,
  max(last_activity_at), max(last_activity_at)
FROM demo_finance
WHERE captured_at IS NOT NULL OR cancelled_at IS NOT NULL
GROUP BY organization_id, (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
ON CONFLICT DO NOTHING;

-- Use Payment's historical movement keys and effective dates for the revenue API and BI views.
INSERT INTO revenue_movements (movement_key, kind, payment_id, organization_id_external,
  currency, effective_at, amount, commission, payable)
SELECT movement.movement_key, movement.kind, f.payment_id, f.organization_id, 'VND',
  movement.effective_at, movement.amount, movement.commission, movement.payable
FROM demo_prepaid_finance f
CROSS JOIN LATERAL (VALUES
  ('capture:' || f.payment_id, 'CAPTURE', f.captured_at, f.captured_amount, 0::bigint, 0::bigint),
  ('settlement-opening:' || f.settlement_id, 'SETTLEMENT', f.captured_at, 0::bigint,
    f.original_commission, f.captured_amount - f.original_commission),
  ('refund:' || f.refund_id, 'REFUND', f.refunded_at, f.refunded_amount, 0::bigint, 0::bigint),
  ('settlement-refund:' || f.refund_id, 'SETTLEMENT', f.refunded_at, 0::bigint,
    f.remaining_commission - f.original_commission, f.original_commission - f.remaining_commission - f.refunded_amount)
) movement(movement_key, kind, effective_at, amount, commission, payable)
WHERE movement.effective_at IS NOT NULL
  AND (movement.amount <> 0 OR movement.commission <> 0 OR movement.payable <> 0)
ON CONFLICT DO NOTHING;

SELECT to_regclass('revenue_payment_booking') IS NOT NULL AS demo_has_payment_booking_link,
       to_regclass('revenue_booking_context') IS NOT NULL AS demo_has_booking_context
\gset

\if :demo_has_payment_booking_link
INSERT INTO revenue_payment_booking (organization_id_external, payment_id, booking_id)
SELECT organization_id, payment_id, id
FROM demo_prepaid_finance
WHERE captured_at IS NOT NULL
ON CONFLICT DO NOTHING;
\endif

\if :demo_has_booking_context
INSERT INTO revenue_booking_context (organization_id_external, booking_id, booking_code, route_name)
SELECT f.organization_id, f.id, f.booking_code, r.name
FROM demo_finance f
JOIN demo_trips t ON t.id = f.trip_id
JOIN demo_routes r ON r.id = t.route_id
ON CONFLICT DO NOTHING;
\endif
