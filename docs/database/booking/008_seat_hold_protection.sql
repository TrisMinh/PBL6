ALTER TABLE seat_holds ADD COLUMN IF NOT EXISTS verified_phone_key text;
CREATE INDEX IF NOT EXISTS ix_seat_hold_customer_created ON seat_holds(customer_id_external, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_seat_hold_customer_trip_created ON seat_holds(customer_id_external, trip_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_seat_hold_phone_created ON seat_holds(verified_phone_key, created_at DESC)
    WHERE verified_phone_key IS NOT NULL;
