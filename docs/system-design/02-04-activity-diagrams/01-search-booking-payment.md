# BP-01 — Tìm chuyến, đặt vé và thanh toán

Nguồn: `BP-01`, `UC-SEARCH-01`, `UC-BOOK-01`, `UC-PAY-01`, `UC-TICKET-01`, `BR-SEAT-*`, `BR-BOOK-*`, `BR-PAY-*`.

```mermaid
flowchart TB
    START((Bắt đầu)) --> A1["Guest/Customer: nhập điểm đi, điểm đến, ngày và số khách"]
    A1 --> A2["Client: gửi tiêu chí tìm kiếm"]
    A2 --> A3["Transport Service: lọc Trip còn bán, paging và sort"]
    A3 --> D1{"Có Trip phù hợp?"}
    D1 -- Không --> N1["Client: hiển thị empty state và gợi ý đổi tiêu chí"] --> END0((Kết thúc))
    D1 -- Có --> A4["Customer: chọn Trip, điểm đón/trả và ghế"]
    A4 --> A5["Booking Service: khóa các TripSeat theo thứ tự ổn định"]
    A5 --> D2{"Tất cả ghế AVAILABLE?"}
    D2 -- Không --> N2["Rollback toàn bộ; trả danh sách ghế không khả dụng"] --> A4
    D2 -- Có --> A6["Tạo SeatHold ACTIVE, price snapshot và expiresAt"]
    A6 --> A7["Customer: nhập một Passenger cho mỗi ghế và Promotion tùy chọn"]
    A7 --> A8["Booking Service: kiểm tra hold, passenger, stop và tính giá phía server"]
    A8 --> D3{"SeatHold còn ACTIVE và dữ liệu hợp lệ?"}
    D3 -- Không --> N3["Không tạo Booking; release/expire hold phù hợp"] --> A4
    D3 -- Có --> A9["Tạo Booking PENDING_PAYMENT và consume SeatHold"]
    A9 --> A10["Customer: chọn phương thức thanh toán"]
    A10 --> A11["Payment Service: tạo Payment và provider intent bằng Idempotency-Key"]
    A11 --> A12["Payment Gateway: xử lý và gửi signed webhook"]
    A12 --> A13["Payment Service: xác minh signature, replay key, amount và currency"]
    A13 --> D4{"Kết quả cuối hợp lệ?"}
    D4 -- Chưa chắc chắn --> N4["Giữ PROCESSING; poll/reconcile, không phát hành vé"] --> A13
    D4 -- Thất bại --> N5["Payment FAILED; Booking chờ thử lại hoặc hết hạn"] --> END1((Kết thúc chưa mua vé))
    D4 -- Thành công --> A14["Payment SUCCEEDED + Outbox PaymentSucceeded"]
    A14 --> A15["Booking Service: Inbox dedupe, xác nhận đúng hold/booking"]
    A15 --> D5{"Ghế vẫn thuộc Booking?"}
    D5 -- Không --> N6["Không chiếm lại ghế; yêu cầu compensation Refund/manual case"] --> END2((Kết thúc cần xử lý))
    D5 -- Có --> A16["Booking PAID; TripSeat BOOKED; Ticket ISSUED"]
    A16 --> A17["Notification gửi vé; Reporting cập nhật bất đồng bộ"]
    A17 --> END3((Hoàn tất))
```

## Điểm kiểm soát

- Giữ nhiều ghế là all-or-nothing và được bảo vệ bởi transaction/lock của Booking DB.
- Client không được tin payment redirect hoặc query parameter.
- Duplicate HTTP command, webhook và RabbitMQ delivery không tạo thêm Booking, Payment hoặc Ticket.
- Notification lỗi không rollback Booking đã `PAID`.

