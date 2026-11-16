-- Earlier local databases predate the organization column added to the baseline.
-- Preserve payment history and recover tenant ownership from server-owned records.
CREATE TABLE IF NOT EXISTS booking_quotes (
  booking_id uuid PRIMARY KEY, customer_id uuid NOT NULL, organization_id uuid NOT NULL,
  amount bigint NOT NULL, currency char(3) NOT NULL, payment_channel varchar(20) NOT NULL,
  commission_rate numeric(5,4) NOT NULL, expires_at timestamptz
);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS organization_id_external uuid;
UPDATE payments p SET organization_id_external = q.organization_id
FROM booking_quotes q WHERE q.booking_id = p.booking_id_external AND p.organization_id_external IS NULL;
UPDATE payments p SET organization_id_external = s.organization_id_external
FROM booking_settlements s WHERE s.booking_id_external = p.booking_id_external AND p.organization_id_external IS NULL;
ALTER TABLE payments ALTER COLUMN organization_id_external SET NOT NULL;
CREATE INDEX IF NOT EXISTS ix_payments_organization ON payments (organization_id_external, created_at DESC);
