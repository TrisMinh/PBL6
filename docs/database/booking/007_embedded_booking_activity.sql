CREATE VIEW bi.embedded_booking_activity AS
SELECT a.organization_id_external::text AS organization_key,
       a.period_date, a.route_name, a.payment_channel, a.status,
       md5(a.organization_id_external::text || ':' || a.customer_id_external::text) AS customer_key,
       a.tickets, a.boarded
FROM bi.booking_activity a;

REVOKE ALL ON bi.embedded_booking_activity FROM PUBLIC;
