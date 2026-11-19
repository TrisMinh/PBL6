CREATE TABLE IF NOT EXISTS operator_settlement_receipts (
  settlement_id uuid PRIMARY KEY REFERENCES booking_settlements(id),
  organization_id_external uuid NOT NULL,
  reference varchar(100) NOT NULL,
  amount bigint NOT NULL CHECK (amount > 0),
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  settlement_version bigint NOT NULL CHECK (settlement_version >= 0),
  confirmed_by_external uuid NOT NULL,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id_external, reference)
);
