CREATE TABLE IF NOT EXISTS revenue_payment_booking (
  organization_id_external uuid NOT NULL,
  payment_id uuid NOT NULL,
  booking_id uuid NOT NULL,
  PRIMARY KEY (organization_id_external, payment_id)
);

CREATE TABLE IF NOT EXISTS revenue_booking_context (
  organization_id_external uuid NOT NULL,
  booking_id uuid NOT NULL,
  booking_code varchar(20) NOT NULL,
  route_name text NOT NULL,
  PRIMARY KEY (organization_id_external, booking_id)
);

CREATE OR REPLACE VIEW bi.operator_revenue_by_booking WITH (security_barrier = true) AS
WITH order_day AS (
  SELECT m.period_date, m.currency, context.booking_code,
    COALESCE(context.route_name, 'Chưa xác định tuyến') AS route_name,
    COALESCE(SUM(m.amount) FILTER (WHERE m.kind = 'CAPTURE'), 0)::bigint AS gross_revenue,
    COALESCE(SUM(m.amount) FILTER (WHERE m.kind = 'REFUND'), 0)::bigint AS refund_amount,
    SUM(m.commission)::bigint AS platform_commission,
    SUM(m.payable)::bigint AS operator_payable,
    COUNT(*) FILTER (WHERE m.kind = 'CAPTURE') AS payment_count,
    COUNT(*) FILTER (WHERE m.kind = 'REFUND') AS refund_count
  FROM revenue_movements m
  JOIN bi.operator_reader_scope scope ON scope.organization_id_external = m.organization_id_external
  LEFT JOIN revenue_payment_booking link ON link.organization_id_external = m.organization_id_external
    AND link.payment_id = m.payment_id
  LEFT JOIN revenue_booking_context context ON context.organization_id_external = m.organization_id_external
    AND context.booking_id = link.booking_id
  WHERE scope.login_name = SESSION_USER
  GROUP BY m.period_date, m.currency, context.booking_code, context.route_name
)
SELECT *, gross_revenue - refund_amount AS net_revenue,
  gross_revenue - refund_amount - platform_commission - operator_payable AS unsettled_amount
FROM order_day;
