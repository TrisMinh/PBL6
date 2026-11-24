CREATE OR REPLACE FUNCTION enqueue_payment_booking_link(payment payments)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO outbox_messages (id, message_type, schema_version, aggregate_id, payload, correlation_id, occurred_at, attempt_count)
  SELECT event.id, 'PaymentBookingLinked', 1, payment.id,
    jsonb_build_object('eventId', event.id, 'eventType', 'PaymentBookingLinked', 'version', 1,
      'occurredAt', NOW(), 'producer', 'payment', 'correlationId', event.id,
      'aggregateId', payment.id, 'tenantId', payment.organization_id_external,
      'payload', jsonb_build_object('paymentId', payment.id, 'bookingId', payment.booking_id_external)),
    event.id, NOW(), 0
  FROM (SELECT gen_random_uuid() AS id) event;
$$;

CREATE OR REPLACE FUNCTION publish_payment_booking_link() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.succeeded_at IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.succeeded_at IS NULL) THEN
    PERFORM enqueue_payment_booking_link(NEW);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER reporting_payment_booking_link AFTER INSERT OR UPDATE OF succeeded_at ON payments
FOR EACH ROW EXECUTE FUNCTION publish_payment_booking_link();

SELECT enqueue_payment_booking_link(payment) FROM payments payment WHERE payment.succeeded_at IS NOT NULL;
