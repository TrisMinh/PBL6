-- Publish financial movements in the same transaction as their source rows.
CREATE OR REPLACE FUNCTION enqueue_revenue_movement(
  movement_key text, kind text, payment_id uuid, organization_id uuid,
  currency text, effective_at timestamptz, amount bigint, commission bigint, payable bigint
) RETURNS void LANGUAGE sql AS $$
  INSERT INTO outbox_messages (id, message_type, schema_version, aggregate_id, payload, correlation_id, occurred_at, attempt_count)
  SELECT event.id, 'RevenueMovementRecorded', 1, payment_id,
    jsonb_build_object('eventId', event.id, 'eventType', 'RevenueMovementRecorded', 'version', 1,
      'occurredAt', NOW(), 'producer', 'payment', 'correlationId', event.id,
      'aggregateId', payment_id, 'tenantId', organization_id,
      'payload', jsonb_build_object('movementKey', movement_key, 'kind', kind, 'paymentId', payment_id,
        'organizationId', organization_id, 'currency', currency, 'effectiveAt', effective_at,
        'amount', amount, 'commission', commission, 'payable', payable)), event.id, NOW(), 0
  FROM (SELECT gen_random_uuid() AS id) event;
$$;

CREATE OR REPLACE FUNCTION publish_revenue_movement() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  org uuid;
  commission_delta bigint;
  payable_delta bigint;
BEGIN
  IF TG_TABLE_NAME = 'payments' THEN
    IF NEW.succeeded_at IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.succeeded_at IS NULL) THEN
      PERFORM enqueue_revenue_movement('capture:' || NEW.id, 'CAPTURE', NEW.id,
        NEW.organization_id_external, NEW.currency, NEW.succeeded_at, NEW.amount, 0, 0);
    END IF;
  ELSIF TG_TABLE_NAME = 'refunds' THEN
    IF NEW.status = 'SUCCEEDED' AND (TG_OP = 'INSERT' OR OLD.status <> 'SUCCEEDED') THEN
      SELECT organization_id_external INTO STRICT org FROM payments WHERE id = NEW.payment_id;
      PERFORM enqueue_revenue_movement('refund:' || NEW.id, 'REFUND', NEW.payment_id,
        org, NEW.currency, NEW.succeeded_at, NEW.amount, 0, 0);
    END IF;
  ELSIF NEW.payment_channel = 'PREPAID' AND NEW.payment_id IS NOT NULL THEN
    commission_delta := NEW.commission_amount;
    payable_delta := NEW.operator_net;
    IF TG_OP = 'UPDATE' AND OLD.payment_id = NEW.payment_id THEN
      commission_delta := commission_delta - OLD.commission_amount;
      payable_delta := payable_delta - OLD.operator_net;
    END IF;
    IF commission_delta <> 0 OR payable_delta <> 0 THEN
      PERFORM enqueue_revenue_movement('settlement:' || NEW.id || ':' || NEW.row_version,
        'SETTLEMENT', NEW.payment_id, NEW.organization_id_external, NEW.currency,
        NEW.updated_at, 0, commission_delta, payable_delta);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER reporting_capture AFTER INSERT OR UPDATE OF succeeded_at ON payments
FOR EACH ROW EXECUTE FUNCTION publish_revenue_movement();
CREATE OR REPLACE TRIGGER reporting_refund AFTER INSERT OR UPDATE OF status ON refunds
FOR EACH ROW EXECUTE FUNCTION publish_revenue_movement();
CREATE OR REPLACE TRIGGER reporting_settlement AFTER INSERT OR UPDATE OF commission_amount, operator_net ON booking_settlements
FOR EACH ROW EXECUTE FUNCTION publish_revenue_movement();

-- Backfill from Payment, including late captures and provider paths that do not emit BookingPaid.
SELECT enqueue_revenue_movement('capture:' || id, 'CAPTURE', id, organization_id_external,
  currency, succeeded_at, amount, 0, 0) FROM payments WHERE succeeded_at IS NOT NULL;

SELECT enqueue_revenue_movement('refund:' || r.id, 'REFUND', r.payment_id, p.organization_id_external,
  r.currency, r.succeeded_at, r.amount, 0, 0)
FROM refunds r JOIN payments p ON p.id = r.payment_id WHERE r.status = 'SUCCEEDED';

-- Reconstruct historical settlement accrual and refunds at the stored contract rate.
WITH settled AS (
  SELECT s.*, p.amount AS original, p.succeeded_at
  FROM booking_settlements s JOIN payments p ON p.id = s.payment_id
  WHERE s.payment_channel = 'PREPAID' AND p.succeeded_at IS NOT NULL
), refunds_in_order AS (
  SELECT s.id AS settlement_id, r.id AS refund_id, r.succeeded_at, r.amount,
    GREATEST(0, s.original - SUM(r.amount) OVER (
      PARTITION BY s.id ORDER BY r.succeeded_at, r.id ROWS UNBOUNDED PRECEDING))::bigint AS remaining
  FROM settled s JOIN refunds r ON r.payment_id = s.payment_id WHERE r.status = 'SUCCEEDED'
), refund_changes AS (
  SELECT r.*, (ROUND(r.remaining * s.commission_rate) - ROUND((r.remaining + r.amount) * s.commission_rate))::bigint AS commission
  FROM refunds_in_order r JOIN settled s ON s.id = r.settlement_id
), movements AS (
  SELECT 'settlement-opening:' || s.id AS key, s.id AS settlement_id, s.succeeded_at AS effective_at,
    ROUND(s.original * s.commission_rate)::bigint AS commission,
    s.original - ROUND(s.original * s.commission_rate)::bigint AS payable
  FROM settled s
  UNION ALL
  SELECT 'settlement-refund:' || refund_id, settlement_id, succeeded_at, commission, -amount - commission
  FROM refund_changes
), balances AS (
  SELECT settlement_id, SUM(commission)::bigint AS commission, SUM(payable)::bigint AS payable
  FROM movements GROUP BY settlement_id
), reconciled AS (
  SELECT * FROM movements
  UNION ALL
  SELECT 'settlement:' || s.id || ':' || s.row_version, s.id, s.updated_at,
    s.commission_amount - b.commission, s.operator_net - b.payable
  FROM settled s JOIN balances b ON b.settlement_id = s.id
)
SELECT enqueue_revenue_movement(m.key, 'SETTLEMENT', s.payment_id, s.organization_id_external,
  s.currency, m.effective_at, 0, m.commission, m.payable)
FROM reconciled m JOIN settled s ON s.id = m.settlement_id
WHERE m.commission <> 0 OR m.payable <> 0;
