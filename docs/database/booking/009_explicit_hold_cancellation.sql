ALTER TABLE seat_holds ADD COLUMN IF NOT EXISTS customer_cancelled boolean NOT NULL DEFAULT false;
