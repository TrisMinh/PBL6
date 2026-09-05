# BP-06 — Hủy chuyến xe có vé đã bán

Nguồn: `BP-06`, `UC-TRIP-01`, `BR-TRIP-004..006`, `BR-CANCEL-008`, `BR-PAY-007..008`.

```mermaid
flowchart TB
    START((Bắt đầu)) --> A1["Operator Operations/Admin: chọn Trip và nhập reason"]
    A1 --> A2["Hệ thống: kiểm tra quyền, tenant, Trip state/version và đếm ảnh hưởng"]
    A2 --> D1{"Được phép hủy?"}
    D1 -- Không --> N1["Từ chối; không tiết lộ dữ liệu ngoài scope"] --> END0((Kết thúc))
    D1 -- Có --> A3["Client: hiển thị Booking/Ticket/Payment bị ảnh hưởng"]
    A3 --> D2{"Actor xác nhận?"}
    D2 -- Không --> END1((Không thay đổi))
    D2 -- Có --> A4["Gửi command với Idempotency-Key và expected version"]
    A4 --> A5["Transport DB: Trip → CANCELLED, audit + Outbox TripCancelled"]
    A5 --> A6["Booking Service: Inbox dedupe; đóng inventory và xử lý theo batch/checkpoint"]
    A6 --> A7["Hủy Ticket còn hiệu lực; không áp phí hủy Customer"]
    A7 --> D3{"Có Payment cần hoàn?"}
    D3 -- Không --> A11["Phát BookingCancelled/TicketCancelled"]
    D3 -- Có --> A8["Phát RefundRequested idempotent cho từng logical refund"]
    A8 --> A9["Payment Service/Provider: xử lý và đối soát Refund"]
    A9 --> D4{"Refund kết thúc?"}
    D4 -- Chưa/FAILED --> N2["Retry hoặc manual case; không khôi phục Trip/Ticket"] --> A11
    D4 -- SUCCEEDED --> A10["Booking/Ticket hội tụ trạng thái REFUNDED"] --> A11
    A11 --> A12["Notification thông báo; Reporting cập nhật eventual consistency"]
    A12 --> END2((Hoàn tất hoặc đang theo dõi refund))
```

## Điểm kiểm soát

- Hủy sau `DEPARTED` không đi qua luồng thông thường.
- Batch có checkpoint để tiếp tục sau sự cố; mỗi Booking/Refund có idempotency riêng.
- Refund/Notification lỗi không làm Trip quay lại trạng thái trước.

