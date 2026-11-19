CREATE SCHEMA IF NOT EXISTS bi;

CREATE INDEX IF NOT EXISTS ix_bookings_tenant_created ON bookings (organization_id_external, created_at);

CREATE OR REPLACE VIEW bi.booking_activity AS
SELECT b.organization_id_external, b.created_at,
       (b.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS period_date,
       b.trip_id, trip.route_id_external AS route_id,
       COALESCE(NULLIF(trip.route_snapshot ->> 'Name', ''),
                NULLIF(trip.route_snapshot ->> 'name', ''),
                'Tuyến ' || left(trip.route_id_external::text, 8)) AS route_name,
       b.customer_id_external,
       b.payment_channel, b.status,
       tickets.tickets,
       tickets.boarded
FROM bookings b
JOIN trip_snapshots trip ON trip.trip_id = b.trip_id
    AND trip.organization_id_external = b.organization_id_external
CROSS JOIN LATERAL (
    SELECT COUNT(*) FILTER (WHERE t.status IN ('ISSUED', 'CHECKED_IN', 'USED')) AS tickets,
           COUNT(*) FILTER (WHERE t.status IN ('CHECKED_IN', 'USED')) AS boarded
    FROM tickets t WHERE t.booking_id = b.id
) tickets;

CREATE TABLE IF NOT EXISTS bi.operator_reader_scope (
  login_name name PRIMARY KEY,
  organization_id_external uuid NOT NULL
);

CREATE OR REPLACE VIEW bi.operator_booking_activity WITH (security_barrier = true) AS
SELECT a.period_date, a.route_id, a.route_name, a.payment_channel, a.status,
       md5(a.organization_id_external::text || ':' || a.customer_id_external::text) AS customer_key,
       a.tickets, a.boarded
FROM bi.booking_activity a JOIN bi.operator_reader_scope scope
  ON scope.organization_id_external = a.organization_id_external
WHERE scope.login_name = SESSION_USER;
