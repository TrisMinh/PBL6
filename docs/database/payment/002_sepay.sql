ALTER TABLE payments DROP CONSTRAINT ck_payments_provider;
ALTER TABLE payments ADD CONSTRAINT ck_payments_provider CHECK (provider IN ('VNPAY_SANDBOX','SIMULATOR','SEPAY'));
ALTER TABLE payment_attempts DROP CONSTRAINT ck_payment_attempt_provider;
ALTER TABLE payment_attempts ADD CONSTRAINT ck_payment_attempt_provider CHECK (provider IN ('VNPAY_SANDBOX','SIMULATOR','SEPAY'));
ALTER TABLE webhook_receipts DROP CONSTRAINT ck_webhook_provider;
ALTER TABLE webhook_receipts ADD CONSTRAINT ck_webhook_provider CHECK (provider IN ('VNPAY_SANDBOX','SIMULATOR','SEPAY'));
ALTER TABLE payments ADD COLUMN return_uri text;
ALTER TABLE payments ADD COLUMN checkout_method varchar(30);
ALTER TABLE webhook_receipts ADD COLUMN payment_id uuid REFERENCES payments(id);

-- Keep failed/cancelled attempts for audit and allow a new attempt on a still-open booking.
ALTER TABLE payments DROP CONSTRAINT uq_payments_booking;
CREATE INDEX ix_payments_latest_booking ON payments (booking_id_external, created_at DESC, id DESC);
