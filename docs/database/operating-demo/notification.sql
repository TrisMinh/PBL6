\ir common.sql

CREATE TEMP TABLE demo_notification_rows AS
SELECT pg_temp.demo_id(event.kind, b.id) AS id, b.customer_id, b.organization_id, b.id AS booking_id,
       b.booking_code, event.kind, event.title, event.body, event.happened_at, b.pattern
FROM demo_orders b
CROSS JOIN LATERAL (VALUES
  ('BOOKING_CREATED','Đơn đặt vé đã được tạo', 'Đơn ' || b.booking_code || ' đã được tạo.', b.created_at),
  ('PAYMENT_SUCCEEDED','Đã ghi nhận thanh toán', 'Đơn ' || b.booking_code || ' đã thanh toán ' || b.total || ' ₫.', b.paid_at),
  ('TICKET_ISSUED','Vé điện tử đã sẵn sàng', 'Mở Vé của tôi để xem mã QR của đơn ' || b.booking_code || '.',
    CASE WHEN b.status IN ('PAID','CONFIRMED','COMPLETED','REFUNDED','REFUND_PENDING')
         THEN coalesce(b.paid_at,b.created_at)+interval '15 seconds' END),
  ('BOOKING_CANCELLED','Đơn đặt vé đã hủy', 'Đơn ' || b.booking_code || ' đã được hủy.', b.cancelled_at),
  ('REFUND_SUCCEEDED','Đã hoàn tiền', 'Đơn ' || b.booking_code || ' được hoàn ' || b.refund_amount || ' ₫.', b.refunded_at)
) AS event(kind,title,body,happened_at)
WHERE event.happened_at IS NOT NULL
  AND (b.pattern%3=0 OR b.status IN ('REFUNDED','REFUND_PENDING') OR b.customer_email='customer.00001@demo.blue.example.test');

INSERT INTO notifications (
  id,user_id_external,organization_id_external,notification_type,source_message_id,source_reference,
  title,body,data,essential,created_at,read_at
)
SELECT id,customer_id,organization_id,kind,id::text,booking_code,title,body,
       jsonb_build_object('bookingId',booking_id,'bookingCode',booking_code), true,happened_at,
       CASE WHEN pattern%5<>0 AND happened_at < anchor-interval '2 hours' THEN happened_at+interval '2 hours' END
FROM demo_notification_rows CROSS JOIN demo_config
ON CONFLICT DO NOTHING;

-- Historical delivery records only. No pending e-mail or external notification is queued.
INSERT INTO delivery_attempts (
  id,notification_id,channel,attempt_no,destination_hash,provider_message_id,status,created_at,completed_at
)
SELECT pg_temp.demo_id('notification-delivery',id),id,'IN_APP',1,
       md5(customer_id::text),'LOCAL-DEMO-' || id,'DELIVERED',happened_at,happened_at
FROM demo_notification_rows WHERE pattern%4=0
ON CONFLICT DO NOTHING;

INSERT INTO customer_requests(id,kind,reference,payload,customer_id,created_at)
SELECT pg_temp.demo_id('support-request',id),'support','BLUE-SUP-DM-' || lpad(customer_no::text,5,'0'),
       jsonb_build_object('email',email,'message',(ARRAY[
         'Tôi muốn đổi điểm đón trên vé điện tử.',
         'Tôi cần kiểm tra lại trạng thái hoàn tiền của đơn.',
         'Tôi muốn bổ sung hành lý ký gửi cho chuyến sắp tới.',
         'Xin hướng dẫn cách xuất trình mã QR khi lên xe.'
       ])[1+customer_no%4]),id,anchor-make_interval(days => customer_no%45)
FROM demo_customers CROSS JOIN demo_config WHERE customer_no%83=0
ON CONFLICT DO NOTHING;
