# 2.8 RabbitMQ Event Flow

RabbitMQ là broker duy nhất của baseline. Các sơ đồ trong mục này làm rõ topology, vòng đời message, event choreography, fan-out và failure path; chúng phải được đọc cùng [2.1.6 Message Broker](../02-01-system-architecture/02-01-06-message-broker.md).

## Danh mục

| Chủ đề | Sơ đồ |
|---|---|
| Exchange, queue và owner | [RabbitMQ topology](./01-topology.md) |
| Outbox → broker → Inbox/ACK | [Message lifecycle](./02-message-lifecycle.md) |
| Publish/cập nhật/hủy Trip | [Trip lifecycle events](./03-trip-lifecycle-events.md) |
| Payment xác nhận Booking/Ticket | [Payment–Booking event flow](./04-payment-booking-events.md) |
| Hủy vé/Trip và Refund | [Cancellation–Refund event flow](./05-cancellation-refund-events.md) |
| Notification và Reporting fan-out | [Non-critical consumers](./06-notification-reporting-fanout.md) |
| Transient/permanent failure | [Retry và DLQ](./07-retry-dlq.md) |
| Event/routing key/consumer | [Routing catalog](./08-event-routing-catalog.md) |

## Contract bắt buộc

- Delivery là **at-least-once**; duplicate và out-of-order là trường hợp bình thường phải xử lý.
- Producer dùng transactional Outbox và publisher confirm.
- Consumer dùng manual ACK, Inbox unique constraint và chỉ ACK sau local commit.
- Message có `message_id`, type/version, correlation/causation, aggregate ID/version và payload tối thiểu.
- File/export không đi qua broker; message chỉ mang metadata và object key.

