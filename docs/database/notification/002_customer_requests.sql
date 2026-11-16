CREATE TABLE IF NOT EXISTS customer_requests (
    id uuid PRIMARY KEY,
    kind text NOT NULL CHECK (kind IN ('support', 'partner')),
    reference text NOT NULL UNIQUE,
    payload jsonb NOT NULL,
    customer_id uuid,
    created_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS customer_requests_kind_created_idx ON customer_requests(kind, created_at DESC);
