# Ngoại lệ và khả năng phục hồi

## 1. Danh mục lỗi nghiệp vụ

| Code | HTTP | Tình huống | Hành vi |
|---|---:|---|---|
| VALIDATION_ERROR | 400 | Dữ liệu không hợp lệ | Trả field errors |
| AUTHENTICATION_REQUIRED | 401 | Thiếu/hết hạn token | Yêu cầu đăng nhập/refresh |
| ACCESS_DENIED | 403 | Sai role/tenant/ownership | Không tiết lộ dữ liệu tồn tại ngoài scope |
| RESOURCE_NOT_FOUND | 404 | Không tìm thấy trong scope | Trả mã chung |
| IDEMPOTENCY_CONFLICT | 409 | Cùng key nhưng payload khác | Không thực hiện command |
| TRIP_NOT_SELLABLE | 409 | Chuyến đã đóng bán/khởi hành/hủy | Yêu cầu chọn chuyến khác |
| SEAT_UNAVAILABLE | 409 | Ghế không còn available | Trả seat code bị ảnh hưởng |
| SEAT_HOLD_EXPIRED | 410 | Hold hết hạn | Giải phóng UI và yêu cầu giữ lại |
| BOOKING_EXPIRED | 410 | Booking hết thời gian thanh toán | Không tạo payment mới |
| PAYMENT_PROCESSING | 202 | Chưa có kết quả cuối | Client polling có backoff |
| PAYMENT_VERIFICATION_FAILED | 422/ops | Webhook không hợp lệ/mismatch | Không xác nhận booking, tạo log/case |
| CANCELLATION_NOT_ALLOWED | 422 | Không thỏa policy | Trả lý do và policy snapshot |
| TICKET_ALREADY_CHECKED_IN | 409 | Scan lặp | Trả thời điểm check-in cũ |
| UPSTREAM_UNAVAILABLE | 503 | Dependency thiết yếu lỗi | Retry-After nếu phù hợp |
| RATE_LIMITED | 429 | Vượt rate limit | Trả Retry-After |

## 2. Kịch bản phục hồi bắt buộc

### Payment Gateway timeout

1. Payment giữ `PROCESSING`, không đánh dấu thất bại ngay nếu kết quả chưa chắc chắn.
2. Client nhận trạng thái đang xử lý.
3. Payment Service chờ webhook hoặc chạy reconciliation.
4. Không gửi lại charge không idempotent một cách mù quáng.

### Webhook lặp

1. Kiểm tra `externalEventId/providerTransactionId`.
2. Nếu đã xử lý, trả 2xx theo hợp đồng provider.
3. Không phát logical event hoặc ticket lần hai.

### Payment thành công sau khi hold hết hạn

1. Payment Service ghi nhận payment hợp lệ và phát event.
2. Booking Service không chiếm TripSeat đã thuộc booking khác.
3. Booking Service phát compensation request kèm reason.
4. Payment Service refund; nếu thất bại, mở ReconciliationCase và cảnh báo vận hành.

### Message broker tạm ngừng

- Producer lưu outbox cùng transaction nghiệp vụ.
- Outbox publisher retry khi broker trở lại.
- API không tuyên bố event đã phát nếu outbox chưa được lưu.
- Consumer deduplicate khi nhận lại.

### Notification provider lỗi

- Notification được đánh dấu retrying/failed.
- Booking/Payment đã thành công không rollback.
- Customer vẫn xem được trạng thái/ticket trong ứng dụng.

### Service dependency lỗi

- Remote call có timeout ngắn phù hợp.
- Retry có exponential backoff và jitter chỉ cho request idempotent.
- Circuit breaker có thể áp dụng cho provider ngoài.
- Không retry vô hạn trong request của người dùng.

### Trip cancelled hàng loạt

- Xử lý theo batch/event, có progress và khả năng resume.
- Mỗi booking/refund có idempotency key riêng.
- Reporting và Notification có thể eventual consistency nhưng phải hoàn tất sau khi dependency phục hồi.

## 3. Dead-letter queue

Message vào DLQ phải lưu:

- Event ID/type/version.
- Consumer/service.
- Correlation ID.
- Số lần thử và lỗi cuối.
- Thời điểm thử lại gần nhất.

Chỉ role vận hành được replay; replay phải tạo audit và vẫn qua inbox deduplication.

## 4. Thông báo lỗi cho người dùng

- Không hiển thị stack trace, query, tên bảng, secret hoặc payload provider.
- Nêu hành động tiếp theo: thử lại, chọn ghế khác, chờ xử lý hoặc liên hệ hỗ trợ.
- Payment chưa rõ kết quả phải dùng thông điệp “đang xử lý”, không nói “thất bại” hoặc yêu cầu trả tiền lần nữa ngay.
- Có correlation ID để support tra cứu.
