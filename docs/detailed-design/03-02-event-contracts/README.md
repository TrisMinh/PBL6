# 3.2 Event Contract

Contract RabbitMQ cho 15 event baseline của SRS và các technical/design message cần để workflow hội tụ an toàn. Đây là nguồn để sinh JSON Schema/AsyncAPI; tên type, routing key và required payload không được tự đổi trong code.

## Danh mục

- [3.2.1 Envelope, versioning và compatibility](./01-envelope-versioning.md)
- [3.2.2 Identity và Transport events](./02-identity-transport-events.md)
- [3.2.3 Booking, SeatHold và Ticket events](./03-booking-events.md)
- [3.2.4 Payment, Refund và compensation](./04-payment-refund-events.md)
- [3.2.5 Routing, queue và consumer matrix](./05-routing-consumer-matrix.md)

## Phân loại

| Loại | Exchange | Quy tắc |
|---|---|---|
| Integration event | `platform.events` | Sự thật đã commit, tên quá khứ, có thể nhiều consumer |
| Asynchronous command | `platform.commands` | Yêu cầu đúng một logical owner thực hiện |
| Retry/DLQ copy | `platform.retry`/`platform.dlx` | Giữ nguyên message identity/payload; thêm failure metadata ở AMQP header |

RabbitMQ cung cấp at-least-once. Contract không hứa exactly-once hoặc global ordering.

