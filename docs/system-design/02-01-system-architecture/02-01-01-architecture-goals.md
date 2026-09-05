# 2.1.1 Architecture Goals

## 1. Mục tiêu ưu tiên

| Ưu tiên | Mục tiêu | Cách kiến trúc đáp ứng | Chỉ báo kiểm chứng |
|---:|---|---|---|
| 1 | Không bán trùng ghế hoặc phát hành vé trùng | Booking Service là single writer cho TripSeat; dùng transaction, row lock/constraint và idempotency | Load test không có double-booking hay duplicate ticket/payment (`NFR-PERF-007`) |
| 2 | Thanh toán đúng và có thể phục hồi | Payment webhook được verify, persist trước khi ack; outbox, inbox và compensation xử lý lỗi liên service | Webhook hợp lệ được persist/ack trong p95 ≤ 2 giây; replay không tạo logical result lần hai |
| 3 | Ranh giới nghiệp vụ rõ | Service theo bounded context, database-per-service, không đọc DB chéo | Có thể build/deploy/migrate từng service độc lập |
| 4 | Luồng đặt vé phản hồi nhanh | REST trên critical path; cache/read model cho dữ liệu đọc; async cho Notification/Reporting | Search p95 ≤ 2 giây; SeatHold p95 ≤ 1 giây ở tải baseline |
| 5 | Chịu lỗi cục bộ | Timeout, circuit breaker, RabbitMQ retry/DLQ; Notification/Reporting ngoài critical path | Lỗi provider/broker không rollback transaction nghiệp vụ đã commit |
| 6 | Scale theo điểm nóng | Service stateless; consumer cạnh tranh trong cùng queue; Booking, Payment, Search scale riêng | Scale ngang không đổi contract hoặc correctness |
| 7 | Bảo mật và truy vết | Zero-trust giữa boundary, RBAC + tenant scope, audit, correlation/trace ID | Đáp ứng nhóm `NFR-SEC-*` và `NFR-OBS-*` trong SRS |
| 8 | Phù hợp năng lực nhóm PBL6 | Local chạy bằng Docker Compose; production topology không khóa cloud vendor | Một lệnh dựng được môi trường local; cùng container image dùng qua các môi trường |

## 2. Quality attribute scenarios

### QA-01 — Tranh chấp ghế

- **Kích thích:** hai request giữ cùng một ghế đến gần đồng thời.
- **Môi trường:** tải bình thường hoặc cao điểm.
- **Phản hồi:** chỉ một transaction chuyển `TripSeat` từ `AVAILABLE` sang `HELD`; request còn lại nhận `409 SEAT_UNAVAILABLE`.
- **Đo lường:** không có hai active hold hoặc hai ticket hợp lệ cho cùng TripSeat.

### QA-02 — RabbitMQ tạm ngừng

- **Kích thích:** broker không khả dụng sau khi service đã commit dữ liệu nghiệp vụ.
- **Phản hồi:** transaction vẫn hoàn tất cùng bản ghi outbox; publisher tiếp tục retry khi broker hồi phục.
- **Đo lường:** không mất event đã commit; queue lag trở về ngưỡng bình thường sau phục hồi.

### QA-03 — Event giao lặp

- **Kích thích:** consumer nhận lại cùng `eventId`.
- **Phản hồi:** inbox nhận diện duplicate và acknowledge mà không lặp side effect.
- **Đo lường:** một `eventId` chỉ sinh một logical state transition.

### QA-04 — Notification Provider lỗi

- **Kích thích:** email/push provider timeout hoặc trả lỗi.
- **Phản hồi:** Booking/Payment đã commit không bị rollback; Notification retry rồi đưa DLQ nếu quá ngưỡng.
- **Đo lường:** người dùng vẫn truy xuất được ticket trong hệ thống; sự cố có alert và khả năng replay.

## 3. Ràng buộc

- Public traffic phải đi qua API Gateway.
- Không dùng distributed transaction hoặc foreign key xuyên service.
- API phải có OpenAPI; event phải có schema và version.
- Mọi remote call có timeout; retry chỉ dùng cho operation an toàn/idempotent.
- Access token ngắn hạn; service tự thực thi authorization, không chỉ tin Gateway.
- RPO baseline ≤ 15 phút và RTO ≤ 4 giờ cho database nghiệp vụ.

## 4. Non-goals của baseline

- Không tối ưu cho multi-region active-active.
- Không cam kết exactly-once delivery; correctness đạt bằng at-least-once + idempotency.
- Không xây service mesh hoặc event sourcing toàn hệ thống ở giai đoạn đầu.
- Không tách thêm service chỉ để phù hợp sơ đồ; chỉ tách khi có ownership, tải hoặc vòng đời triển khai độc lập.
- Không dùng Redis làm nguồn đảm bảo chống double-booking.

## 5. Thứ tự ưu tiên khi đánh đổi

`Correctness giao dịch` → `Bảo mật` → `Khả năng phục hồi` → `Hiệu năng` → `Chi phí` → `Tiện lợi phát triển`.

Một tối ưu làm yếu tính đúng đắn của ghế, payment hoặc tenant isolation không được chấp nhận nếu chưa có ADR và bằng chứng kiểm thử tương ứng.
