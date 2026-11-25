ALTER TABLE refunds
  ADD COLUMN IF NOT EXISTS transfer_reference varchar(120),
  ADD COLUMN IF NOT EXISTS transfer_recorded_by uuid;

CREATE UNIQUE INDEX IF NOT EXISTS uq_refunds_transfer_reference
  ON refunds (transfer_reference) WHERE transfer_reference IS NOT NULL;
