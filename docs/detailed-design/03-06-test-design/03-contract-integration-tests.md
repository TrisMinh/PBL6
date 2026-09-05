# 3.6.3 API, Event Contract và Integration Tests

## OpenAPI contract tests

- Mọi public operation có unique `operationId`, auth scheme, required header, request/response/error schema và example parse được.
- Request thiếu/invalid field trả `VALIDATION_ERROR` với field reason allow-list.
- Protected endpoint có 401/403/404 negative behavior đúng policy.
- Idempotent command khai báo `Idempotency-Key`; versioned mutation khai báo `If-Match/expectedVersion`.
- Pagination max enforced; sort/filter allow-list; no unbounded list.
- Breaking-change diff fail CI cho remove/rename/type/required/semantics incompatibility.
- Gateway route contract test gửi request nhận diện được tới từng pattern trong 3.1, gồm cả collection root và descendant: payment-under-booking, trip seats/holds/reviews, operator manifest/promotions và organization membership phải đến đúng downstream owner, không rơi vào wildcard Transport/Booking khác.

## Event schema tests

- 15 baseline và approved design message validate envelope + payload v1.
- Producer example/golden fixture được consumer contract test đọc thành công.
- Consumer bỏ qua optional unknown field; missing required/wrong type/unsupported version vào permanent failure path.
- Routing key, message type/version và exchange khớp catalog.
- Data classification test fail nếu payload chứa token/password/PAN/CVV/QR secret/full document field.

## Integration matrix

| Integration | Happy path | Failure/edge |
|---|---|---|
| Identity–Notification | UserRegistered tạo delivery | duplicate/provider failure/rate |
| Transport–Booking | TripPublished tạo exact TripSeat count | redelivery/version gap/partial DB rollback |
| Booking–Payment | Booking snapshot/payment intent | expired Booking/wrong amount/service timeout |
| Payment–Booking | PaymentSucceeded tạo one ticket/item | duplicate/out-of-order/seat lost |
| Booking–Notification/Reporting | paid/ticket/cancel events fan-out | one consumer down does not block other |
| Cancellation–Payment | RefundRequested creates one Refund | cap exceeded/duplicate/provider unknown |
| Trip cancellation | batch Ticket/Refund processing | crash/resume/duplicate event |

## Infrastructure integration

Use real PostgreSQL transaction/constraint, RabbitMQ exchange/queue/confirm/redelivery/DLQ, Redis expiry/cache behavior and provider simulator with signed fixtures. Test must prove Outbox survives broker down and Inbox handles crash-after-commit-before-ACK.
