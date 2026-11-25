ALTER TABLE tickets ADD COLUMN IF NOT EXISTS refund_request_id uuid;

-- Older customer cancellations recorded the group of tickets and the refund
-- event separately. Link only groups with a single matching request.
WITH cancellation_groups AS (
  SELECT booking_id, cancelled_at,
    LEAD(cancelled_at) OVER (PARTITION BY booking_id ORDER BY cancelled_at) AS next_cancellation
  FROM (
    SELECT DISTINCT booking_id, cancelled_at
    FROM tickets
    WHERE payment_channel = 'PREPAID' AND status = 'CANCELLED' AND cancelled_at IS NOT NULL
  ) groups
), candidates AS (
  SELECT t.id AS ticket_id, requested.id AS request_id
  FROM cancellation_groups g
  JOIN tickets t ON t.booking_id = g.booking_id AND t.cancelled_at = g.cancelled_at
  JOIN outbox_messages cancelled ON cancelled.aggregate_id = g.booking_id
    AND cancelled.message_type = 'BookingCancelled'
    AND cancelled.occurred_at >= g.cancelled_at
    AND (g.next_cancellation IS NULL OR cancelled.occurred_at < g.next_cancellation)
  JOIN outbox_messages requested ON requested.aggregate_id = cancelled.aggregate_id
    AND requested.correlation_id = cancelled.correlation_id
    AND requested.message_type = 'RefundRequested'
    AND requested.occurred_at >= cancelled.occurred_at
    AND (g.next_cancellation IS NULL OR requested.occurred_at < g.next_cancellation)
    AND requested.payload #>> '{payload,reason}' = 'CUSTOMER_CANCELLATION'
  WHERE t.refund_request_id IS NULL
    AND EXISTS (
      SELECT 1 FROM cancellation_previews preview WHERE preview.booking_id = g.booking_id
        AND preview.consumed_at = g.cancelled_at
        AND (t.booking_item_id = ANY(preview.booking_item_ids) OR t.id = ANY(preview.booking_item_ids))
        AND preview.refund_amount::text = requested.payload #>> '{payload,amount}'
    )
)
UPDATE tickets t SET refund_request_id = matches.request_id
FROM (
  SELECT ticket_id, (array_agg(DISTINCT request_id))[1] AS request_id
  FROM candidates
  GROUP BY ticket_id
  HAVING COUNT(DISTINCT request_id) = 1
) matches
WHERE t.id = matches.ticket_id AND t.refund_request_id IS NULL;
