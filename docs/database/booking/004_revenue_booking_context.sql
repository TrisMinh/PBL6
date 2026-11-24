CREATE OR REPLACE VIEW booking_revenue_context AS
SELECT b.id AS booking_id, b.organization_id_external, b.booking_code,
       COALESCE(NULLIF(trip.route_snapshot ->> 'Name', ''),
                NULLIF(trip.route_snapshot ->> 'name', ''),
                'Tuyến ' || left(trip.route_id_external::text, 8)) AS route_name
FROM bookings b
JOIN trip_snapshots trip ON trip.trip_id = b.trip_id
  AND trip.organization_id_external = b.organization_id_external;

CREATE OR REPLACE FUNCTION enqueue_booking_revenue_context(context booking_revenue_context)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO outbox_messages (id, message_type, schema_version, aggregate_id, payload, correlation_id, occurred_at, attempt_count)
  SELECT event.id, 'BookingRevenueContextRecorded', 1, context.booking_id,
    jsonb_build_object('eventId', event.id, 'eventType', 'BookingRevenueContextRecorded', 'version', 1,
      'occurredAt', NOW(), 'producer', 'booking', 'correlationId', event.id,
      'aggregateId', context.booking_id, 'tenantId', context.organization_id_external,
      'payload', jsonb_build_object('bookingId', context.booking_id,
        'bookingCode', context.booking_code, 'routeName', context.route_name)),
    event.id, NOW(), 0
  FROM (SELECT gen_random_uuid() AS id) event;
$$;

CREATE OR REPLACE FUNCTION publish_booking_revenue_context() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM enqueue_booking_revenue_context(context)
  FROM booking_revenue_context context WHERE context.booking_id = NEW.id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER reporting_booking_context AFTER INSERT ON bookings
FOR EACH ROW EXECUTE FUNCTION publish_booking_revenue_context();

SELECT enqueue_booking_revenue_context(context) FROM booking_revenue_context context;
