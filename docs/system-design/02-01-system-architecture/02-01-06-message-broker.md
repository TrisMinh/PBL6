# 2.1.6 Message Broker — RabbitMQ

## 1. Mục đích

RabbitMQ là broker duy nhất trong baseline cho integration event và asynchronous command. RabbitMQ không thay thế database, không lưu business state dài hạn và không cung cấp exactly-once processing.

## 2. Topology baseline

### 2.1 Virtual host và exchanges

| Resource | Type | Durable | Mục đích |
|---|---|---:|---|
| vhost `/bus-ticket` | — | — | Cô lập topology, permission và quota của hệ thống |
| `platform.events` | `topic` | Yes | Fan-out sự thật nghiệp vụ đã xảy ra |
| `platform.commands` | `topic` | Yes | Route command tới đúng logical owner |
| `platform.retry` | `topic` | Yes | Retry queue theo consumer và delay tier |
| `platform.dlx` | `topic` | Yes | Message permanent failure hoặc hết retry |

Exchange không chứa version để tránh phải thay toàn topology khi một contract tăng version. Version nằm trong routing key và message envelope.

### 2.2 Routing key

```text
<bounded-context>.<aggregate-or-capability>.<action>.v<major>
```

Ví dụ:

```text
identity.user.registered.v1
transport.trip.published.v1
transport.trip.cancelled.v1
transport.trip.status-changed.v1
booking.booking.created.v1
booking.ticket.issued.v1
booking.trip-inventory.ready.v1
payment.payment.succeeded.v1
payment.refund.succeeded.v1
booking.refund.requested.v1
booking.payment.compensation-requested.v1
notification.delivery.send.v1
```

Routing key dùng chữ thường và dấu chấm; message type trong envelope dùng PascalCase để khớp event catalog của SRS.

### 2.3 Consumer queues

| Queue | Bind exchange/routing | Logical owner | Mục đích |
|---|---|---|---|
| `booking.trip-events.q` | `platform.events`: `transport.trip.*.v1` | Booking | Dựng/cập nhật TripSnapshot và TripSeat |
| `booking.payment-events.q` | `platform.events`: `payment.payment.*.v1`, `payment.refund.*.v1` | Booking | Hội tụ Booking/Ticket với kết quả payment/refund |
| `transport.inventory-events.q` | `platform.events`: `booking.trip-inventory.ready.v1` | Transport | Chỉ mark Trip sellable sau khi Booking đã tạo đủ inventory |
| `payment.refund-requests.q` | `platform.events`: `booking.booking.cancelled.v1`, `booking.refund.requested.v1`; `platform.commands`: `booking.payment.compensation-requested.v1` | Payment | Đóng payment chưa hoàn tất; xử lý refund/compensation chỉ từ message explicit tương ứng |
| `notification.integration-events.q` | `platform.events`: các User/Trip/Booking/Ticket/Payment/Refund event cần thông báo trong catalog | Notification | Tạo notification từ sự kiện nghiệp vụ đã commit |
| `notification.commands.q` | `platform.commands`: `notification.delivery.send.v1` | Notification | Yêu cầu gửi trực tiếp có một logical owner |
| `reporting.integration-events.q` | `platform.events`: các binding Identity/Trip/SeatHold/Booking/Ticket/Payment/Refund được khai báo rõ | Reporting | Cập nhật các projection đã khai báo, không subscribe `#` mặc định |

Queue thuộc consumer, không thuộc producer. Mỗi queue là durable; môi trường production ưu tiên quorum queue cho queue nghiệp vụ quan trọng. Nhiều replica của cùng service consume chung queue để competing-consumer; service khác cần queue riêng để nhận cùng event.

## 3. Message envelope

```json
{
  "eventId": "01J...",
  "eventType": "PaymentSucceeded",
  "version": 1,
  "occurredAt": "2026-08-19T03:05:42Z",
  "producer": "payment-service",
  "correlationId": "01J...",
  "causationId": "01J...",
  "aggregateId": "payment-123",
  "aggregateVersion": 4,
  "tenantId": "operator-456",
  "payload": {}
}
```

Integration event dùng `eventId`/`eventType` đúng contract SRS. Asynchronous command dùng `commandId`/`commandType` nhưng giữ các field version, producer, correlation, causation và payload tương đương. Trong phần còn lại, “message ID” là cách gọi chung cho đúng một trong hai ID; không đưa hai ID đồng nghĩa vào cùng envelope.

AMQP properties/headers tối thiểu:

| Thuộc tính | Giá trị |
|---|---|
| `message_id` | `eventId` hoặc `commandId` tương ứng |
| `type` | `eventType` hoặc `commandType` tương ứng |
| `content_type` | `application/json` |
| `content_encoding` | `utf-8` |
| `delivery_mode` | Persistent (`2`) |
| `correlation_id` | `correlationId` |
| Header `traceparent` | W3C trace context nếu có |
| Header `schema-version` | Major version dạng số |

Payload chỉ chứa dữ liệu consumer cần để xử lý; không đưa password, token, CVV, full card number hoặc PII không cần thiết vào message.

## 4. Publish flow

1. Application thay đổi aggregate và insert row `outbox_messages` trong cùng transaction.
2. Outbox worker claim batch bằng cơ chế tránh nhiều instance claim cùng row.
3. Worker publish tới exchange với persistent delivery và publisher confirm.
4. Chỉ sau confirm, worker đánh dấu `published_at`; publish timeout giữ row để thử lại.
5. Cleanup/archival outbox theo retention đã cấu hình.

Mandatory publish flag được bật cho message quan trọng; unroutable message được phát hiện qua `basic.return`, ghi metric và không đánh dấu outbox thành công.

## 5. Consume flow

1. Consumer nhận message với manual ack và prefetch hữu hạn.
2. Validate envelope, supported version và schema.
3. Mở local transaction; insert AMQP `message_id` vào inbox với unique constraint.
4. Nếu duplicate, commit/ack mà không lặp side effect.
5. Nếu mới, thực thi handler, persist state/outbox rồi commit.
6. Ack message sau commit.

Crash sau commit nhưng trước ack sẽ tạo redelivery; inbox biến redelivery thành no-op an toàn.

## 6. Retry và dead-letter

Không dùng immediate requeue vô hạn. Mỗi consumer queue có ba retry queue tương ứng, ví dụ:

```text
booking.payment-events.q.retry.5s
booking.payment-events.q.retry.30s
booking.payment-events.q.retry.5m
booking.payment-events.q.dlq
```

- Application republish tới `platform.retry` bằng routing key `<primary-queue>.<tier>`. Mỗi retry queue dùng TTL rồi dead-letter qua default exchange trực tiếp về đúng primary queue bằng `x-dead-letter-routing-key`; cách này không fan-out lại sang consumer khác.
- Transient failure đi qua các tier `5s → 30s → 5m`; số lần/tier là configuration theo use case.
- Republish vào retry/DLQ phải nhận publisher confirm trước khi ack bản gốc.
- Schema không hợp lệ, version không hỗ trợ hoặc invariant permanent failure đi thẳng DLQ.
- `x-death`/custom retry header chỉ phục vụ chẩn đoán; decision retry cuối cùng thuộc consumer policy.
- Chỉ operator role được replay DLQ; replay tạo audit và vẫn đi qua inbox dedupe.

DLQ record/headers phải cho phép xem message ID, type/version, queue nguồn, error code, first/last failure time, retry count và correlation ID. Không sửa payload trực tiếp rồi replay không kiểm soát; nếu cần correction, tạo message mới có audit liên kết message cũ.

## 7. Ordering và concurrency

- RabbitMQ giữ thứ tự trong một queue ở mức delivery, nhưng concurrent consumer/retry có thể làm thay đổi thứ tự hoàn tất.
- Handler dùng `aggregateVersion` và state guard; không phụ thuộc timestamp đơn thuần.
- Queue cần strict ordering có thể đặt single-active-consumer, nhưng chỉ sau khi chứng minh cần vì làm giảm throughput.
- Prefetch bắt đầu ở mức nhỏ cho payment/booking, đo processing time và tăng có kiểm soát.

## 8. Security

- TLS cho AMQP qua network không tin cậy; management UI chỉ ở private/admin network.
- Mỗi service có RabbitMQ user riêng, quyền configure/read/write đúng exchange/queue của nó.
- Producer không có quyền read queue; consumer không có quyền publish tùy ý ngoài outbox/retry/DLQ cần thiết.
- Credential lấy từ secret store, rotate được và không nằm trong image/repository.
- Vhost có connection/channel/message-size limit để giảm abuse và blast radius.

## 9. Observability và vận hành

Theo dõi tối thiểu:

- Ready/unacked message, oldest message age và publish/ack/redelivery rate theo queue.
- Consumer count, channel/connection, publisher confirm timeout và unroutable message.
- Retry/DLQ rate theo message type/error code.
- Outbox pending age/count và inbox duplicate count.
- Disk/memory alarm, node health và quorum status.

Alert dựa trên **tuổi message và backlog trend**, không chỉ queue length. Runbook phải chỉ ra owner queue, cách xác định poison message, cách pause consumer và quy trình replay có audit.

## 10. Capacity và availability baseline

- Local/demo: một RabbitMQ container có management plugin để quan sát.
- Production-like: cluster số node lẻ, quorum queue cho critical queue, persistent volume và anti-affinity giữa node.
- Không coi broker backup là cách replay business history lâu dài; database/outbox/audit vẫn là nguồn phục hồi.
- Đặt giới hạn message size; file/export artifact đi qua Object Storage, message chỉ mang metadata và object key.
