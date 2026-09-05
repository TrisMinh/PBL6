# 2.5 State Machine Diagrams

Bộ sơ đồ này là hình biểu diễn trực tiếp của [Chương 6 — Yêu cầu trạng thái nghiệp vụ](../../srs-v2/06-yeu-cau-trang-thai.md). Transition không xuất hiện trong các sơ đồ dưới đây phải bị server từ chối.

## Danh mục

| Aggregate/Entity | Sơ đồ | Owner |
|---|---|---|
| TripSeat | [Trạng thái ghế theo chuyến](./01-trip-seat.md) | Booking Service |
| SeatHold | [Vòng đời phiên giữ ghế](./02-seat-hold.md) | Booking Service |
| Booking | [Vòng đời Booking](./03-booking.md) | Booking Service |
| Payment | [Vòng đời Payment](./04-payment.md) | Payment Service |
| Ticket | [Vòng đời Ticket](./05-ticket.md) | Booking Service |
| Refund | [Vòng đời Refund](./06-refund.md) | Payment Service |
| Trip | [Vòng đời Trip](./07-trip.md) | Transport Service |

## Quy tắc thực thi chung

- Mọi command kiểm tra actor, ownership/tenant, source state và concurrency version.
- Transition thành công ghi timestamp, actor/service identity, reason khi cần và correlation ID.
- Command lặp cùng idempotency key không tạo transition hoặc side effect lần hai.
- Event đến trễ không được làm state quay ngược; consumer kiểm tra state guard và `aggregateVersion`.

