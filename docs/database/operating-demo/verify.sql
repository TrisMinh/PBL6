SELECT :'demo_database'='identity' AS identity,
       :'demo_database'='transport' AS transport,
       :'demo_database'='booking' AS booking,
       :'demo_database'='payment' AS payment,
       :'demo_database'='reporting' AS reporting,
       :'demo_database'='notification' AS notification \gset

-- Tables can grow from a handful of rows to six figures in this transaction.
-- Prefer set joins for the full snapshot checks before autoanalyze catches up.
SET LOCAL enable_nestloop = off;

\if :identity
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM demo_people p
    WHERE NOT EXISTS (
      SELECT FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id
      WHERE u.id=p.id AND r.code=p.role AND ur.organization_id_external IS NOT DISTINCT FROM p.organization_id
    )
  ) THEN RAISE EXCEPTION 'Demo user or role was not loaded'; END IF;
END $$;
SELECT count(*) FILTER (WHERE role='CUSTOMER') AS customers, count(*) FILTER (WHERE role<>'CUSTOMER') AS staff FROM demo_people;
\endif

\if :transport
DO $$
BEGIN
  IF EXISTS (SELECT FROM demo_trips d LEFT JOIN trips t ON t.id=d.id WHERE t.id IS NULL)
    OR EXISTS (
      SELECT FROM demo_buses d JOIN buses b ON b.id=d.id
      WHERE b.seat_count <> (SELECT count(*) FROM seats s WHERE s.bus_id=b.id)
    )
  THEN RAISE EXCEPTION 'Demo schedule or fleet layout is incomplete'; END IF;
END $$;
SELECT (SELECT count(*) FROM demo_orgs) AS operators, (SELECT count(*) FROM demo_buses) AS buses,
       (SELECT count(*) FROM demo_drivers) AS drivers, (SELECT count(*) FROM demo_routes) AS routes,
       (SELECT count(*) FROM demo_stops) AS stops, (SELECT count(*) FROM demo_trips) AS trips;
\endif

\if :booking
DO $$
BEGIN
  IF EXISTS (SELECT FROM demo_orders d LEFT JOIN bookings b ON b.id=d.id WHERE b.id IS NULL)
    OR EXISTS (
      SELECT FROM demo_order_seats d LEFT JOIN tickets t ON t.id=d.ticket_id
      WHERE d.ticket_id IS NOT NULL AND t.id IS NULL
    )
    OR EXISTS (
      SELECT FROM demo_orders d JOIN bookings b ON b.id=d.id
      JOIN booking_items i ON i.booking_id=b.id
      GROUP BY b.id,b.subtotal_amount HAVING sum(i.unit_price)<>b.subtotal_amount
    )
  THEN RAISE EXCEPTION 'Demo bookings or ticket totals are incomplete'; END IF;
END $$;
SELECT (SELECT count(*) FROM demo_orders) AS bookings, (SELECT count(ticket_id) FROM demo_order_seats) AS tickets,
       (SELECT count(*) FROM demo_trip_seats) AS inventory_seats;
\endif

\if :payment
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM demo_prepaid_finance d LEFT JOIN payments p ON p.id=d.payment_id
    WHERE p.id IS NULL OR p.amount<>d.total
  ) OR EXISTS (
    SELECT FROM payments p JOIN demo_prepaid_finance d ON d.payment_id=p.id
    WHERE p.provider='SEPAY' AND p.status IN ('PENDING','PROCESSING','FAILED','CANCELLED')
  ) THEN RAISE EXCEPTION 'Demo payments are incomplete or eligible for an external lookup'; END IF;
END $$;
SELECT count(*) AS payments, count(*) FILTER (WHERE refund_due>0) AS refunds,
       sum(captured_amount)::bigint AS gross_vnd,sum(refunded_amount)::bigint AS refunded_vnd,
       sum(remaining_commission)::bigint AS commission_vnd,sum(operator_net)::bigint AS payable_vnd
FROM demo_prepaid_finance;
\endif

\if :reporting
-- Later activity on a demo booking has separate movement keys and must survive reruns.
CREATE TEMP VIEW demo_reporting_movements AS
SELECT m.*
FROM revenue_movements m JOIN demo_prepaid_finance d ON d.payment_id=m.payment_id
WHERE m.movement_key IN (
  'capture:' || d.payment_id, 'settlement-opening:' || d.settlement_id,
  'refund:' || d.refund_id, 'settlement-refund:' || d.refund_id
);

DO $$
DECLARE
  actual record;
  expected record;
BEGIN
  SELECT COALESCE(sum(m.amount) FILTER (WHERE m.kind='CAPTURE'),0) AS gross,
         COALESCE(sum(m.amount) FILTER (WHERE m.kind='REFUND'),0) AS refunded,
         COALESCE(sum(m.commission),0) AS commission,COALESCE(sum(m.payable),0) AS payable
  INTO actual FROM demo_reporting_movements m;
  SELECT sum(captured_amount) AS gross,sum(refunded_amount) AS refunded,
         sum(remaining_commission) AS commission,sum(operator_net) AS payable
  INTO expected FROM demo_prepaid_finance;
  IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Demo revenue movements differ from billing inputs'; END IF;
END $$;
SELECT count(*) AS revenue_movements FROM demo_reporting_movements;
\endif

\if :notification
DO $$
BEGIN
  IF EXISTS (SELECT FROM demo_notification_rows d LEFT JOIN notifications n ON n.id=d.id WHERE n.id IS NULL)
    THEN RAISE EXCEPTION 'Demo notification history is incomplete'; END IF;
END $$;
SELECT count(*) AS notifications FROM demo_notification_rows;
\endif
