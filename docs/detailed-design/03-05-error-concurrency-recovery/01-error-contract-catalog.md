# 3.5.1 Error Contract và Catalog

## Baseline/general codes

| Code | HTTP | Retry? | Meaning/action |
|---|---:|:---:|---|
| `VALIDATION_ERROR` | 400 | No | Field error allow-list |
| `AUTHENTICATION_REQUIRED` | 401 | Sau login/refresh | Missing/expired access context |
| `INVALID_CREDENTIALS` | 401 | Có rate limit | Generic login failure, không lộ identity |
| `ACCESS_DENIED` | 403 | No | Role/permission/tenant/ownership fail |
| `RESOURCE_NOT_FOUND` | 404 | No | Không thấy trong visible scope |
| `RATE_LIMITED` | 429 | Sau `Retry-After` | Quota/abuse control |
| `UPSTREAM_UNAVAILABLE` | 503 | Có kiểm soát | Dependency thiết yếu tạm lỗi |
| `VERSION_CONFLICT` | 409 | Reload rồi quyết định | Expected version/ETag cũ |

## Identity/session codes

| Code | HTTP | Public detail |
|---|---:|---|
| `IDENTITY_ALREADY_USED` | 409 | Chỉ dùng nơi policy cho phép; auth recovery vẫn generic |
| `VERIFICATION_INVALID` | 422 | Challenge không hợp lệ, không echo token |
| `VERIFICATION_EXPIRED` | 410 | Có thể resend theo rate limit |
| `PASSWORD_POLICY_VIOLATION` | 422 | Reason allow-list, không echo password |
| `ACCOUNT_LOCKED` | 423 | Retry time chung/an toàn |
| `SESSION_INVALID` | 401 | Đăng nhập lại |
| `SESSION_REUSE_DETECTED` | 401 | Session family revoked; đăng nhập lại |

## Idempotency/state/business codes

| Code | HTTP | Action |
|---|---:|---|
| `IDEMPOTENCY_KEY_REQUIRED` | 400 | Gửi key cho command bắt buộc |
| `IDEMPOTENCY_CONFLICT` | 409 | Không reuse key với payload khác |
| `IDEMPOTENCY_IN_PROGRESS` | 409 | Poll resource/status, không double-submit |
| `INVALID_STATE_TRANSITION` | 409 | Reload current state/version |
| `TRIP_NOT_SELLABLE` | 409 | Chọn Trip khác |
| `SCHEDULE_CONFLICT` | 409 | Điều chỉnh Bus/Driver/lịch trong scope |
| `SEAT_UNAVAILABLE` | 409 | Chọn lại toàn bộ/ghế phù hợp |
| `SEAT_HOLD_EXPIRED` | 410 | Tạo hold mới |
| `BOOKING_EXPIRED` | 410 | Không tạo Payment mới |
| `PROMOTION_INVALID` | 422 | Bỏ/chọn Promotion khác |
| `PROMOTION_QUOTA_EXHAUSTED` | 409 | Server tính lại giá không promotion |
| `CANCELLATION_NOT_ALLOWED` | 422 | Hiển thị policy/reason safe |
| `PREVIEW_STALE` | 409 | Lấy preview mới và xác nhận lại |
| `CHANGE_NOT_ALLOWED` | 422 | Giữ Ticket cũ |

## Payment/Ticket/Reporting codes

| Code | HTTP | Action |
|---|---:|---|
| `PAYMENT_PROCESSING` | 202 | Poll/backoff; không trả tiền lại ngay |
| `PAYMENT_VERIFICATION_FAILED` | 422/provider-specific | Không confirm Booking; security/reconcile record |
| `PAYMENT_NOT_REFUNDABLE` | 422 | Manual review nếu mismatch |
| `REFUND_LIMIT_EXCEEDED` | 409 | Không tạo Refund vượt cap |
| `TICKET_ALREADY_CHECKED_IN` | 409 | Trả state/time cũ, không transition |
| `TICKET_NOT_VALID_FOR_TRIP` | 422 | Không đổi Ticket |
| `ESSENTIAL_NOTIFICATION_REQUIRED` | 422 | Không tắt toàn bộ required channel |
| `EXPORT_NOT_READY` | 409 | Poll ExportJob |
| `EXPORT_EXPIRED` | 410 | Tạo export mới |

## Mapping rules

- DB unique/state constraint được map sang domain code, không trả constraint/SQLSTATE.
- Unknown exception trả generic internal error + correlation ID; không biến mọi lỗi thành `VALIDATION_ERROR`.
- `503` chỉ retry tự động cho safe/idempotent operation; mutation có unknown outcome phải query status/idempotency record.
- Public webhook response tuân provider contract, nhưng internal reason vẫn dùng safe error code/metric.

