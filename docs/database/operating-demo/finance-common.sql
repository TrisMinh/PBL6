-- Keep Payment and Reporting on the same IDs, timestamps and VND rounding.
CREATE TEMP TABLE demo_finance AS
WITH facts AS (
  SELECT o.*, org.org_no, org.commission_rate, trip.departure_at, trip.status AS trip_status,
    pg_temp.demo_id('payment', o.id) AS payment_id,
    pg_temp.demo_id('refund', o.id) AS refund_id,
    pg_temp.demo_id('settlement', o.id) AS settlement_id,
    CASE WHEN o.payment_channel = 'PREPAID' AND o.total > 0 THEN o.paid_at END AS captured_at,
    CASE WHEN o.status IN ('REFUND_PENDING', 'REFUNDED') THEN
      COALESCE(o.refund_amount, o.total - COALESCE(o.cancellation_fee, 0))
    ELSE 0 END::bigint AS refund_due
  FROM demo_orders o
  JOIN demo_orgs org ON org.id = o.organization_id
  JOIN demo_trips trip ON trip.id = o.trip_id
), balances AS (
  SELECT facts.*,
    CASE WHEN captured_at IS NOT NULL THEN total ELSE 0 END::bigint AS captured_amount,
    CASE WHEN captured_at IS NOT NULL AND refunded_at IS NOT NULL THEN refund_due ELSE 0 END AS refunded_amount,
    CASE WHEN payment_channel = 'PAY_LATER' AND status = 'CANCELLED' AND cancelled_at >= departure_at
      THEN true ELSE false END AS no_show
  FROM facts
)
SELECT balances.*,
  (captured_amount - refunded_amount) AS remaining_amount,
  round(captured_amount * commission_rate)::bigint AS original_commission,
  round((captured_amount - refunded_amount) * commission_rate)::bigint AS remaining_commission,
  CASE
    WHEN captured_at IS NULL AND status = 'EXPIRED' THEN 'FAILED'
    WHEN captured_at IS NULL AND status = 'CANCELLED' THEN 'CANCELLED'
    WHEN captured_at IS NULL THEN NULL
    WHEN status = 'REFUND_PENDING' AND refund_due > 0 THEN 'REFUND_PENDING'
    WHEN refunded_amount = captured_amount THEN 'REFUNDED'
    WHEN refunded_amount > 0 THEN 'PARTIALLY_REFUNDED'
    ELSE 'SUCCEEDED'
  END AS payment_status,
  CASE
    WHEN captured_at IS NOT NULL AND status = 'COMPLETED' AND trip_status = 'COMPLETED'
      AND get_byte(uuid_send(id), 15) % 3 <> 0 THEN 'SEPAY'
    ELSE 'SIMULATOR'
  END AS provider,
  greatest(created_at, paid_at, cancelled_at, completed_at, refunded_at,
    CASE WHEN status = 'EXPIRED' THEN expires_at END) AS last_activity_at
FROM balances;
CREATE UNIQUE INDEX ON demo_finance(id);
ANALYZE demo_finance;

CREATE TEMP TABLE demo_prepaid_finance AS
SELECT f.*, 'DEMO-PAY-' || booking_code AS logical_reference,
  'DEMO-' || provider || '-' || booking_code AS transaction_reference,
  greatest(expires_at, created_at + interval '1 second') AS payment_expires_at,
  CASE
    WHEN payment_status = 'FAILED' THEN greatest(expires_at, created_at + interval '1 second')
    WHEN payment_status = 'CANCELLED' THEN cancelled_at
    ELSE COALESCE(refunded_at, CASE WHEN payment_status = 'REFUND_PENDING' THEN cancelled_at END, captured_at)
  END AS payment_updated_at,
  COALESCE(refunded_at, captured_at) AS settlement_updated_at,
  remaining_amount - remaining_commission AS operator_net
FROM demo_finance f
WHERE payment_channel = 'PREPAID' AND total > 0 AND payment_status IS NOT NULL;
CREATE UNIQUE INDEX ON demo_prepaid_finance(payment_id);
ANALYZE demo_prepaid_finance;
