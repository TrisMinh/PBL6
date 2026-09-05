# 3.2.1 Envelope, Versioning và Compatibility

## Integration event envelope

```json
{
  "eventId": "01J...",
  "eventType": "PaymentSucceeded",
  "version": 1,
  "occurredAt": "2026-09-04T08:30:00Z",
  "producer": "payment-service",
  "correlationId": "01J...",
  "causationId": "01J...",
  "aggregateId": "payment-123",
  "aggregateVersion": 4,
  "tenantId": "organization-456",
  "payload": {}
}
```

## Asynchronous command envelope

```json
{
  "commandId": "01J...",
  "commandType": "PaymentCompensationRequested",
  "version": 1,
  "occurredAt": "2026-09-04T08:30:01Z",
  "producer": "booking-service",
  "correlationId": "01J...",
  "causationId": "payment-event-id",
  "aggregateId": "payment-123",
  "aggregateVersion": 1,
  "tenantId": "organization-456",
  "payload": {}
}
```

Event chỉ có `eventId/eventType`; command chỉ có `commandId/commandType`. Không đưa cả hai cặp đồng nghĩa vào cùng message.

## Field contract

| Field | Required | Quy định |
|---|:---:|---|
| Message ID | Có | ULID/UUID globally unique; map vào AMQP `message_id` |
| Type | Có | PascalCase; map AMQP `type`; immutable semantics trong major version |
| `version` | Có | Positive integer major schema version |
| `occurredAt` | Có | UTC ISO-8601; không dùng làm ordering authority |
| `producer` | Có | Stable service identifier |
| `correlationId` | Có | Nối toàn bộ business transaction/request |
| `causationId` | Có | Message/request trực tiếp gây ra message hiện tại; root có thể null |
| `aggregateId` | Có | ID owner aggregate/capability |
| `aggregateVersion` | Khi ordering quan trọng | Monotonic version từ owner transaction |
| `tenantId` | Khi thuộc tenant | Lấy từ authoritative context, không từ untrusted request |
| `payload` | Có | Object chứa minimum data cho consumer đã công bố |

## AMQP properties

| Property/header | Value |
|---|---|
| `message_id` | eventId hoặc commandId |
| `type` | eventType hoặc commandType |
| `content_type` | `application/json` |
| `content_encoding` | `utf-8` |
| `delivery_mode` | `2` persistent |
| `correlation_id` | correlationId |
| `traceparent` | W3C trace context nếu có |
| `schema-version` | major integer |

## Versioning rules

- Cùng v1 chỉ thêm optional field có default semantics; consumer bỏ qua field chưa biết.
- Đổi tên/xóa/đổi kiểu/đổi meaning/biến optional thành required tạo v2 routing key và schema.
- Producer phát overlap v1/v2 trong migration window; mỗi consumer xác nhận version hỗ trợ trước khi v1 bị ngừng.
- Schema registry/catalog CI kiểm tra example, required field và backward compatibility.
- Unsupported version hoặc schema invalid là permanent failure và vào consumer DLQ.

## Ordering và deduplication

- Inbox unique `(consumerName,messageId)`; duplicate ACK như no-op sau transaction.
- Event cùng aggregate dùng `aggregateVersion`; old/duplicate version bỏ qua, version gap retry/reconcile.
- Không dùng `occurredAt` thay version và không giả định ordering giữa hai aggregate/queue.

## Data classification

Message không chứa password, OTP/reset/access/refresh token, CVV/PAN, QR secret, full identity document hoặc provider raw credential. Passenger/contact chỉ đưa khi consumer có mục đích bắt buộc; ưu tiên ID/safe reference rồi query owner qua scoped API.

