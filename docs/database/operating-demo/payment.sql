\ir common.sql
\ir finance-common.sql

-- A live checkout can create its own payment for a pending order.
INSERT INTO booking_quotes (booking_id, customer_id, organization_id, amount, currency,
  payment_channel, commission_rate, expires_at)
SELECT id, customer_id, organization_id, total, 'VND', payment_channel, commission_rate, expires_at
FROM demo_finance
WHERE payment_channel = 'PREPAID' AND total > 0
ON CONFLICT DO NOTHING;

INSERT INTO payments (id, booking_id_external, customer_id_external, organization_id_external,
  provider, logical_reference, amount, currency, status, provider_order_reference, expires_at,
  succeeded_at, failed_at, cancelled_at, refunded_at, failure_code, created_at, updated_at,
  row_version, checkout_method)
SELECT payment_id, id, customer_id, organization_id, provider, logical_reference, total, 'VND',
  payment_status, CASE WHEN captured_at IS NOT NULL THEN transaction_reference END, payment_expires_at,
  captured_at, CASE WHEN payment_status = 'FAILED' THEN payment_updated_at END,
  CASE WHEN payment_status = 'CANCELLED' THEN cancelled_at END,
  CASE WHEN payment_status = 'REFUNDED' THEN refunded_at END,
  CASE WHEN payment_status = 'FAILED' THEN 'CHECKOUT_EXPIRED' END,
  created_at, payment_updated_at,
  CASE WHEN payment_status IN ('REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED') THEN 2 ELSE 1 END,
  CASE WHEN provider = 'SEPAY' THEN 'BANK_TRANSFER' END
FROM demo_prepaid_finance
ON CONFLICT DO NOTHING;

INSERT INTO payment_attempts (id, payment_id, attempt_no, provider, provider_transaction_id,
  request_fingerprint, status, response_code, response_metadata, created_at, completed_at)
SELECT pg_temp.demo_id('payment-attempt', f.id), p.id, 1, p.provider, p.provider_order_reference,
  encode(sha256(convert_to(p.logical_reference, 'UTF8')), 'hex'),
  CASE WHEN p.succeeded_at IS NOT NULL THEN 'SUCCEEDED'
       WHEN p.status = 'FAILED' THEN 'EXPIRED' ELSE 'FAILED' END,
  CASE WHEN p.succeeded_at IS NOT NULL THEN '00'
       WHEN p.status = 'FAILED' THEN p.failure_code ELSE 'BOOKING_CANCELLED' END,
  jsonb_build_object('fixture', 'operating-demo', 'bookingCode', f.booking_code),
  p.created_at, COALESCE(p.succeeded_at, p.failed_at, p.cancelled_at)
FROM demo_prepaid_finance f
JOIN payments p ON p.id = f.payment_id AND p.logical_reference = f.logical_reference
ON CONFLICT DO NOTHING;

INSERT INTO webhook_receipts (id, provider, external_event_id, provider_transaction_id, payload_hash,
  signature_valid, status, received_at, verified_at, processed_at, payment_id)
SELECT pg_temp.demo_id('payment-webhook', f.id), p.provider, 'DEMO-IPN-' || f.booking_code,
  p.provider_order_reference, encode(sha256(convert_to(p.provider_order_reference, 'UTF8')), 'hex'),
  true, 'PROCESSED', p.succeeded_at, p.succeeded_at, p.succeeded_at, p.id
FROM demo_prepaid_finance f
JOIN payments p ON p.id = f.payment_id AND p.logical_reference = f.logical_reference
WHERE p.succeeded_at IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO refunds (id, payment_id, booking_id_external, requested_by_external, refund_reference,
  provider_refund_id, amount, currency, reason_code, status, created_at, updated_at, succeeded_at, row_version)
SELECT f.refund_id, p.id, f.id, f.customer_id, 'DEMO-REF-' || f.booking_code,
  CASE WHEN f.refunded_at IS NOT NULL THEN 'DEMO-REFUND-' || f.booking_code END,
  f.refund_due, 'VND', CASE WHEN f.trip_status = 'CANCELLED' THEN 'TRIP_CANCELLED' ELSE 'BOOKING_CANCELLED' END,
  CASE WHEN f.refunded_at IS NOT NULL THEN 'SUCCEEDED' ELSE 'REQUESTED' END,
  f.cancelled_at, COALESCE(f.refunded_at, f.cancelled_at), f.refunded_at,
  CASE WHEN f.refunded_at IS NOT NULL THEN 1 ELSE 0 END
FROM demo_prepaid_finance f
JOIN payments p ON p.id = f.payment_id AND p.logical_reference = f.logical_reference
WHERE f.captured_at IS NOT NULL AND f.refund_due > 0
ON CONFLICT DO NOTHING;

INSERT INTO booking_settlements (id, booking_id_external, organization_id_external, payment_id, payment_channel,
  gross_amount, commission_rate, commission_amount, operator_net, currency, collection_status,
  created_at, updated_at, row_version)
SELECT f.settlement_id, f.id, f.organization_id, p.id, 'PREPAID', f.remaining_amount, f.commission_rate,
  f.remaining_commission, f.operator_net, 'VND',
  CASE WHEN f.remaining_amount = 0 THEN 'REFUNDED' ELSE 'COLLECTED' END,
  f.captured_at, f.settlement_updated_at, CASE WHEN f.refunded_amount > 0 THEN 1 ELSE 0 END
FROM demo_prepaid_finance f
JOIN payments p ON p.id = f.payment_id AND p.logical_reference = f.logical_reference
WHERE f.captured_at IS NOT NULL
UNION ALL
SELECT settlement_id, id, organization_id, NULL, 'PAY_LATER', total, commission_rate, 0, total, 'VND',
  CASE WHEN no_show THEN 'NOSHOW_WRITTEN_OFF' ELSE 'UNCOLLECTED' END,
  created_at, CASE WHEN no_show THEN cancelled_at ELSE created_at END, CASE WHEN no_show THEN 1 ELSE 0 END
FROM demo_finance
WHERE payment_channel = 'PAY_LATER' AND (status IN ('CONFIRMED', 'COMPLETED') OR no_show)
ON CONFLICT DO NOTHING;

INSERT INTO ledger_entries (id, settlement_id, organization_id_external, booking_id_external, payment_id,
  entry_type, amount, currency, correlation_id, occurred_at)
SELECT pg_temp.demo_id('ledger-' || movement.entry_type, f.id), s.id, s.organization_id_external,
  s.booking_id_external, s.payment_id, movement.entry_type, movement.amount, 'VND',
  movement.correlation_id, movement.occurred_at
FROM demo_finance f
JOIN booking_settlements s ON s.id = f.settlement_id
CROSS JOIN LATERAL (VALUES
  ('GATEWAY_CAPTURE', f.captured_amount, f.payment_id, f.captured_at),
  ('COMMISSION_ACCRUED', f.original_commission, f.payment_id, f.captured_at),
  ('OPERATOR_PAYABLE', f.captured_amount - f.original_commission, f.payment_id, f.captured_at),
  ('REFUND_CUSTOMER', -f.refunded_amount, f.refund_id, f.refunded_at),
  ('COMMISSION_REVERSED', f.remaining_commission - f.original_commission, f.refund_id, f.refunded_at),
  ('OPERATOR_PAYABLE_REVERSED', f.original_commission - f.remaining_commission - f.refunded_amount, f.refund_id, f.refunded_at),
  ('PAY_LATER_ISSUED', CASE WHEN f.payment_channel = 'PAY_LATER' THEN f.total ELSE 0 END, f.id, f.created_at),
  ('NOSHOW_WRITTEN_OFF', CASE WHEN f.no_show THEN -f.total ELSE 0 END, f.id, f.cancelled_at)
) movement(entry_type, amount, correlation_id, occurred_at)
WHERE movement.occurred_at IS NOT NULL AND movement.amount <> 0
ON CONFLICT DO NOTHING;

-- Weekly payouts roll up final payables once the ride or its refund has closed.
CREATE TEMP TABLE demo_payout_items AS
SELECT f.org_no, f.organization_id, f.booking_code, s.id AS settlement_id,
  s.operator_net, s.row_version,
  date_trunc('week', greatest(f.completed_at, f.settlement_updated_at))::date AS period_start
FROM demo_prepaid_finance f
JOIN booking_settlements s ON s.id = f.settlement_id
WHERE f.status IN ('COMPLETED', 'REFUNDED') AND s.collection_status = 'COLLECTED'
  AND s.operator_net = f.operator_net AND s.operator_net > 0;

CREATE TEMP TABLE demo_payouts AS
SELECT pg_temp.demo_id('operator-payout', items.org_no, items.period_start - date '2000-01-01') AS id,
  items.organization_id, items.period_start, items.period_start + 6 AS period_end,
  sum(items.operator_net)::bigint AS payable_amount,
  (items.period_start + 7)::timestamptz + interval '9 hours' AS created_at,
  (items.period_start + 8)::timestamptz + interval '11 hours' AS transferred_at
FROM demo_payout_items items
CROSS JOIN demo_config config
WHERE (items.period_start + 8)::timestamptz + interval '13 hours' <= config.anchor
GROUP BY items.org_no, items.organization_id, items.period_start;

INSERT INTO operator_payouts (id, organization_id_external, period_start, period_end, currency,
  payable_amount, status, transferred_at, created_at, updated_at, row_version)
SELECT id, organization_id, period_start, period_end, 'VND', payable_amount,
  'SENT', transferred_at, created_at, transferred_at, 1
FROM demo_payouts
ON CONFLICT DO NOTHING;

INSERT INTO operator_settlement_receipts (settlement_id, organization_id_external, reference,
  amount, currency, settlement_version, confirmed_by_external, confirmed_at)
SELECT item.settlement_id, item.organization_id, 'DEMO-TRANSFER-' || item.booking_code,
  item.operator_net, 'VND', item.row_version, pg_temp.demo_id('staff', item.org_no, 2),
  payout.transferred_at + interval '2 hours'
FROM demo_payout_items item
JOIN demo_payouts planned ON planned.organization_id = item.organization_id AND planned.period_start = item.period_start
JOIN operator_payouts payout ON payout.id = planned.id AND payout.payable_amount = planned.payable_amount
WHERE payout.status = 'SENT'
ON CONFLICT DO NOTHING;

-- Reporting receives reconstructed history directly. Only synthetic events from this transaction are closed.
UPDATE outbox_messages outbox
SET published_at = outbox.occurred_at
WHERE left(outbox.aggregate_id::text, 8) = 'da7a2026'
  AND outbox.message_type IN ('RevenueMovementRecorded', 'PaymentBookingLinked')
  AND outbox.occurred_at = transaction_timestamp()
  AND outbox.published_at IS NULL;
