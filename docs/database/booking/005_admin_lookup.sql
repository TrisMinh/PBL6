CREATE INDEX IF NOT EXISTS ix_bookings_admin_lookup
    ON bookings (created_at DESC, id DESC);
