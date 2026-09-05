# BP-04 — Tạo và mở bán chuyến xe

Nguồn: `BP-04`, `UC-OPS-05`, `BR-TRIP-001..002`, `BR-SEAT-010`, `BR-TENANT-*`.

```mermaid
flowchart TB
    START((Bắt đầu)) --> A1["Operator Scheduler: tạo Trip draft, chọn Route, Bus, Driver, lịch, fare và policy"]
    A1 --> A2["Transport Service: lấy tenant từ identity context"]
    A2 --> A3["Kiểm tra dữ liệu bắt buộc, resource ACTIVE và license hợp lệ"]
    A3 --> D1{"Dữ liệu và tenant hợp lệ?"}
    D1 -- Không --> N1["Trả validation/authorization error; giữ draft"] --> A1
    D1 -- Có --> A4["Kiểm tra xung đột lịch Bus/Driver cùng buffer"]
    A4 --> D2{"Có xung đột?"}
    D2 -- Có --> N2["Từ chối publish và trả thông tin trong scope"] --> A1
    D2 -- Không --> A5["Operator xác nhận publish bằng Idempotency-Key"]
    A5 --> A6["Transport DB: Trip SCHEDULED, sellable=false, snapshot + Outbox TripPublished"]
    A6 --> A7["RabbitMQ: giao TripPublished at-least-once"]
    A7 --> A8["Booking Service: Inbox dedupe; tạo TripSnapshot và toàn bộ TripSeat"]
    A8 --> D3{"Inventory tạo đủ và commit?"}
    D3 -- Không --> N3["Retry; Trip chưa xuất hiện như chuyến có thể bán"] --> A7
    D3 -- Có --> A9["Booking phát technical event TripInventoryReady"]
    A9 --> A10["Transport Service: mark sellable=true theo tripId/version"]
    A10 --> A11["Search projection nhận Trip đã sẵn sàng bán"]
    A11 --> END((Hoàn tất))
```

## Điểm kiểm soát

- `SCHEDULED` là trạng thái nghiệp vụ; `sellable=false/true` là cờ readiness, không phải state mới.
- Trip chưa được search như có thể bán trước khi Booking DB có đủ `TripSeat`.
- `TripInventoryReady` là technical integration event của thiết kế, dùng để đóng khoảng nhất quán giữa hai service.

