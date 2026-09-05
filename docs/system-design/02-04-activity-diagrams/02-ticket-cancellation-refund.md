# BP-02 — Hủy vé và hoàn tiền

Nguồn: `BP-02`, `UC-CANCEL-01`, `BR-CANCEL-*`, `BR-PAY-007..010`.

```mermaid
flowchart TB
    START((Bắt đầu)) --> A1["Customer: chọn Ticket/Booking Item cần hủy"]
    A1 --> A2["Booking Service: kiểm tra ownership, Ticket state, giờ đi và policy snapshot"]
    A2 --> D1{"Đủ điều kiện hủy?"}
    D1 -- Không --> N1["Trả lý do an toàn; không đổi dữ liệu"] --> END0((Kết thúc))
    D1 -- Có --> A3["Tính phí và refundable amount; tạo preview có thời hạn"]
    A3 --> A4["Client: hiển thị policy version, phí và tiền hoàn"]
    A4 --> D2{"Customer xác nhận?"}
    D2 -- Không --> END1((Không thay đổi))
    D2 -- Có --> A5["Gửi cancel command + Idempotency-Key + preview version"]
    A5 --> A6["Booking Service: kiểm tra lại quyền, state và preview"]
    A6 --> D3{"Preview còn hiệu lực?"}
    D3 -- Không --> N2["Tính lại và yêu cầu xác nhận lại"] --> A4
    D3 -- Có --> A7["Ticket CANCELLED; mở lại TripSeat nếu Trip còn bán; ghi Outbox"]
    A7 --> D4{"Refundable amount > 0?"}
    D4 -- Không --> A12["Notification: gửi xác nhận hủy"]
    D4 -- Có --> A8["Booking phát RefundRequested"]
    A8 --> A9["Payment Service: Inbox dedupe; kiểm tra tổng refund không vượt payment"]
    A9 --> A10["Payment Gateway: xử lý refund theo idempotency reference"]
    A10 --> D5{"Provider thành công?"}
    D5 -- Chưa chắc chắn --> N3["Refund PROCESSING; retry/reconcile có kiểm soát"] --> A10
    D5 -- Thất bại cuối --> N4["Refund FAILED; Ticket vẫn CANCELLED; tạo manual case"] --> A12
    D5 -- Có --> A11["Refund SUCCEEDED; Payment/Booking/Ticket hội tụ trạng thái hoàn"]
    A11 --> A12
    A12 --> END2((Hoàn tất))
```

## Điểm kiểm soát

- Preview không thay đổi trạng thái và phải được kiểm tra lại khi xác nhận.
- Refund thất bại không khôi phục quyền sử dụng Ticket.
- Tổng Refund thành công không vượt Payment đã thành công.

