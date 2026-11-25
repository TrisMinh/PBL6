ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_phone varchar(20);
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_verified_phone ON users(verified_phone)
    WHERE verified_phone IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS phone_verification_requests (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id),
    phone varchar(20) NOT NULL,
    profile_phone varchar(20) NOT NULL,
    code_hash text NOT NULL,
    attempts int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL DEFAULT now() + interval '5 minutes',
    used_at timestamptz
);
CREATE INDEX IF NOT EXISTS ix_phone_verification_owner ON phone_verification_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_phone_verification_number ON phone_verification_requests(phone, created_at DESC);
