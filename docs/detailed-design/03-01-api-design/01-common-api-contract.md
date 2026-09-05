# 3.1.1 Common API Contract

## Transport và media type

| Thuộc tính | Quy định |
|---|---|
| Public protocol | HTTPS; HTTP chỉ được redirect tại edge |
| Base path | `/api/v1` |
| Media type | `application/json; charset=utf-8` |
| Authentication | `Authorization: Bearer <access-token>` trừ endpoint public/webhook |
| Correlation | Client có thể gửi `X-Correlation-ID`; Gateway tạo ULID/UUID nếu thiếu |
| Trace | Propagate W3C `traceparent`; không trả internal trace detail |
| Time | ISO-8601 có offset trong API; persist UTC |
| Money | `amount` là integer 64-bit theo đơn vị nhỏ nhất; MVP VND dùng nguyên đồng, luôn kèm `currency=VND` |
| Concurrency | `ETag: "<rowVersion>"`; mutation dùng `If-Match` hoặc `expectedVersion` đã đặc tả |
| Client compatibility | `X-Client-Version` khi cần enforce minimum mobile/web version |

## Status code

| Trường hợp | HTTP |
|---|---:|
| Tạo resource đồng bộ | `201 Created` + `Location` |
| Command nhận và xử lý bất đồng bộ | `202 Accepted` + resource/status URL |
| Query/update thành công | `200 OK` |
| Xóa/revoke không cần body | `204 No Content` |
| Validation/auth/permission/not found | `400/401/403/404` |
| State, version hoặc idempotency conflict | `409 Conflict` |
| Resource nghiệp vụ đã hết hạn | `410 Gone` |
| Business rule không thể xử lý | `422 Unprocessable Content` |
| Rate limit/dependency | `429/503` + `Retry-After` khi phù hợp |

Không trả `200` cho error. `202 PAYMENT_PROCESSING` là trạng thái hợp lệ, không phải error transport.

## Error envelope

```json
{
  "error": {
    "code": "SEAT_UNAVAILABLE",
    "message": "Một hoặc nhiều ghế không còn khả dụng.",
    "details": {
      "seatCodes": ["A1"]
    },
    "correlationId": "01J..."
  }
}
```

- `code` ổn định trong API major version; client không parse `message`.
- `details` dùng allow-list theo từng code; không chứa stack, SQL, secret, provider raw payload hoặc dữ liệu ngoài scope.
- Không tìm thấy resource ngoài ownership/tenant trả `RESOURCE_NOT_FOUND` hoặc `ACCESS_DENIED` theo policy nhất quán, không cho phép enumeration.

## Validation error

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dữ liệu không hợp lệ.",
    "details": {
      "fields": [
        {"field": "departureDate", "reason": "MUST_NOT_BE_IN_PAST"}
      ]
    },
    "correlationId": "01J..."
  }
}
```

Field reason là enum contract, không trả exception message.

## Pagination

Query thông thường dùng `page` bắt đầu từ 0, `size` mặc định 20 và tối đa 100:

```json
{
  "items": [],
  "page": 0,
  "size": 20,
  "totalElements": 0,
  "totalPages": 0
}
```

Audit/export hoặc danh sách lớn dùng cursor opaque: `cursor`, `limit`; response trả `nextCursor`. Sort field phải nằm trong allow-list để tránh query tùy ý.

## Idempotency contract

- Header `Idempotency-Key` bắt buộc cho create SeatHold, Booking, Payment, cancellation, ticket change, Trip publish/cancel và Refund.
- Scope unique: authenticated actor/service + operation + target resource + key.
- Server canonicalize request rồi lưu request hash; cùng key/hash trả lại status/body/resource reference trước đó.
- Cùng key khác hash trả `409 IDEMPOTENCY_CONFLICT`.
- Request đang xử lý trả `409 IDEMPOTENCY_IN_PROGRESS` hoặc resource status URL; không chạy song song cùng key.
- Retention tối thiểu 24 giờ; Payment/Refund giữ theo vòng đời đối soát.

## API compatibility

- Cùng major chỉ thêm optional field hoặc enum đã có fallback `UNKNOWN` ở consumer phù hợp.
- Xóa/rename/đổi semantics/đổi required field cần `/api/v2` hoặc migration overlap.
- OpenAPI CI lint operationId duy nhất, schema reference hợp lệ, example parse được và breaking-change check.

