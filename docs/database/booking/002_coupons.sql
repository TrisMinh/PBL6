CREATE TABLE IF NOT EXISTS coupons (
 code varchar(32) PRIMARY KEY CHECK (code ~ '^[A-Z0-9_-]{3,32}$'),
 percent integer NOT NULL CHECK (percent BETWEEN 1 AND 90),
 cap bigint NOT NULL CHECK (cap > 0), minimum bigint NOT NULL CHECK (minimum >= 0),
 organization_id uuid NULL, starts_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL CHECK (expires_at > starts_at), active boolean NOT NULL DEFAULT true
);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS coupon_code varchar(32);
