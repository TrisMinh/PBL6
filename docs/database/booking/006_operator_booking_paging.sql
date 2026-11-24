CREATE INDEX IF NOT EXISTS ix_bookings_operator_paging
    ON bookings (organization_id_external, created_at DESC, id DESC);
