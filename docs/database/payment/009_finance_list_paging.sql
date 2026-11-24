CREATE INDEX IF NOT EXISTS ix_payments_admin_list
    ON payments (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS ix_refunds_admin_list
    ON refunds (created_at DESC, id DESC);
