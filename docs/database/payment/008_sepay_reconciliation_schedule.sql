CREATE INDEX IF NOT EXISTS ix_payments_sepay_reconciliation_due
  ON payments (expires_at)
  WHERE provider = 'SEPAY' AND status IN ('PENDING', 'PROCESSING', 'FAILED', 'CANCELLED');
