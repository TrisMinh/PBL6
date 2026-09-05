# BP-05 — Vận hành chuyến và check-in

Nguồn: `BP-05`, `UC-OPS-06`, `UC-DRIVER-01`, `UC-REVIEW-01`, `AUTHZ-005..007`.

```mermaid
flowchart TB
    START((Bắt đầu)) --> A1["Driver/Operator: mở Trip được phân công hoặc thuộc tenant"]
    A1 --> A2["Booking Service: kiểm tra assignment/permission và tải manifest PII tối thiểu"]
    A2 --> D1{"Đủ quyền?"}
    D1 -- Không --> N1["Từ chối, không tiết lộ manifest"] --> END0((Kết thúc))
    D1 -- Có --> A3["Customer xuất trình QR hoặc public code"]
    A3 --> A4["Driver/Operator: quét QR hoặc nhập mã"]
    A4 --> A5["Booking Service: xác minh actor, Trip, signature/hash và Ticket state"]
    A5 --> D2{"Ticket hợp lệ cho Trip?"}
    D2 -- Đã CHECKED_IN --> N2["Trả thời điểm check-in trước đó; không tạo transition mới"] --> A7
    D2 -- Không --> N3["Hiển thị sai Trip/mã lỗi/hết hiệu lực; giữ nguyên Ticket"] --> A3
    D2 -- ISSUED hợp lệ --> A6["Ticket ISSUED → CHECKED_IN; audit + Outbox PassengerCheckedIn"]
    A6 --> A7["Hiển thị kết quả và manifest mới"]
    A7 --> D3{"Chuyển trạng thái Trip?"}
    D3 -- Chưa --> A3
    D3 -- Có --> A8["Transport Service: kiểm tra actor, state guard và expected version"]
    A8 --> D4{"Transition hợp lệ?"}
    D4 -- Không --> N4["Giữ state; yêu cầu tải lại khi conflict"] --> A7
    D4 -- Có --> A9["SCHEDULED → BOARDING → DEPARTED → IN_TRANSIT → ARRIVED → COMPLETED"]
    A9 --> D5{"Trip COMPLETED?"}
    D5 -- Không --> A7
    D5 -- Có --> A10["Booking Service: CHECKED_IN → USED theo policy"]
    A10 --> A11["Customer có thể tạo tối đa một Review cho Ticket USED"]
    A11 --> END1((Hoàn tất))
```

## Điểm kiểm soát

- Check-in là idempotent và luôn kiểm tra đúng Trip ở server.
- QR offline không được tự bỏ qua xác minh server nếu chưa có offline policy riêng.
- Transition Trip sai thứ tự hoặc sai version bị từ chối.

