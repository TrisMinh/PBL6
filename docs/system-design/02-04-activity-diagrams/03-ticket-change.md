# BP-03 — Đổi vé

Nguồn: `BP-03`, `UC-CHANGE-01` (`SHOULD`), `BR-CANCEL-001..002`, `BR-CANCEL-005..007`, `BR-PAY-*`.

```mermaid
flowchart TB
    START((Bắt đầu)) --> A1["Customer: chọn Ticket cũ và yêu cầu đổi"]
    A1 --> A2["Booking Service: kiểm tra ownership, Ticket ISSUED, thời gian và policy"]
    A2 --> D1{"Được phép đổi?"}
    D1 -- Không --> N1["Từ chối; Ticket cũ giữ nguyên"] --> END0((Kết thúc))
    D1 -- Có --> A3["Customer: chọn Trip/TripSeat mới"]
    A3 --> A4["Booking Service: giữ ghế mới trước khi tác động vé cũ"]
    A4 --> D2{"SeatHold mới ACTIVE?"}
    D2 -- Không --> N2["Không đổi vé cũ; yêu cầu chọn lại"] --> A3
    D2 -- Có --> A5["Tính giá mới, phí đổi và chênh lệch"]
    A5 --> A6["Client: hiển thị toàn bộ tác động tài chính"]
    A6 --> D3{"Customer xác nhận?"}
    D3 -- Không --> N3["Release hold mới; Ticket cũ còn hiệu lực"] --> END1((Không thay đổi))
    D3 -- Có --> D4{"Chênh lệch tài chính"}
    D4 -- Thu thêm --> A7["Payment Service: xử lý payment bổ sung"]
    A7 --> D5{"Payment bổ sung SUCCEEDED?"}
    D5 -- Không --> N4["Release hold mới; giữ Ticket cũ"] --> END2((Đổi vé thất bại))
    D5 -- Có --> A9["Booking Service: commit đổi vé idempotent"]
    D4 -- Hoàn lại --> A8["Ghi yêu cầu refund chênh lệch theo policy"] --> A9
    D4 -- Bằng nhau --> A9
    A9 --> A10["Phát hành Ticket mới ISSUED"]
    A10 --> A11["Hủy Ticket cũ và giải phóng ghế cũ nếu còn bán"]
    A11 --> D6{"Commit đầy đủ?"}
    D6 -- Không --> N5["Chạy compensation: hoàn khoản thu thêm/manual case; không để hai vé hiệu lực"] --> END3((Cần phục hồi))
    D6 -- Có --> A12["Notification và Reporting cập nhật bất đồng bộ"]
    A12 --> END4((Hoàn tất))
```

## Điểm kiểm soát

- Ghế mới luôn được giữ trước; Ticket cũ chỉ bị hủy tại điểm commit.
- Command lặp trả logical change hiện có, không tạo thêm Ticket/Payment/Refund.
- Nếu thu thêm tiền nhưng không phát hành được vé mới, phải compensation hoặc mở manual case.

