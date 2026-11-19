CREATE TABLE IF NOT EXISTS revenue_movements (
  movement_key text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('CAPTURE', 'REFUND', 'SETTLEMENT')),
  payment_id uuid NOT NULL,
  organization_id_external uuid NOT NULL,
  currency varchar(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  effective_at timestamptz NOT NULL,
  period_date date GENERATED ALWAYS AS ((effective_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) STORED,
  amount bigint NOT NULL,
  commission bigint NOT NULL,
  payable bigint NOT NULL,
  projected_at timestamptz NOT NULL DEFAULT NOW(),
  CHECK ((kind = 'SETTLEMENT' AND amount = 0) OR
         (kind IN ('CAPTURE', 'REFUND') AND amount > 0 AND commission = 0 AND payable = 0))
);

CREATE INDEX IF NOT EXISTS ix_revenue_movements_tenant_date ON revenue_movements (organization_id_external, period_date, currency);
CREATE INDEX IF NOT EXISTS ix_revenue_movements_date ON revenue_movements (period_date);

CREATE SCHEMA IF NOT EXISTS bi;
CREATE OR REPLACE VIEW bi.revenue_daily AS
WITH daily AS (
  SELECT organization_id_external, period_date, currency,
    COALESCE(SUM(amount) FILTER (WHERE kind = 'CAPTURE'), 0)::bigint AS gross_revenue,
    COALESCE(SUM(amount) FILTER (WHERE kind = 'REFUND'), 0)::bigint AS refund_amount,
    SUM(commission)::bigint AS platform_commission,
    SUM(payable)::bigint AS operator_payable,
    COUNT(*) FILTER (WHERE kind = 'CAPTURE') AS payment_count,
    COUNT(*) FILTER (WHERE kind = 'REFUND') AS refund_count,
    MAX(projected_at) AS data_as_of
  FROM revenue_movements
  GROUP BY organization_id_external, period_date, currency
)
SELECT *, gross_revenue - refund_amount AS net_revenue,
  gross_revenue - refund_amount - platform_commission - operator_payable AS unsettled_amount
FROM daily;

-- Database owners provision one login per operator Power BI connection.
CREATE TABLE IF NOT EXISTS bi.operator_reader_scope (
  login_name name PRIMARY KEY,
  organization_id_external uuid NOT NULL
);
CREATE OR REPLACE VIEW bi.operator_revenue_daily WITH (security_barrier = true) AS
SELECT d.* FROM bi.revenue_daily d JOIN bi.operator_reader_scope scope
  ON scope.organization_id_external = d.organization_id_external
WHERE scope.login_name = SESSION_USER;
