# 2.3.2 Tìm chuyến, Booking và Ticket

Nguồn nghiệp vụ: [SRS — Tìm chuyến, Booking và Ticket](../../srs-v2/04-use-cases/02-search-booking-ticket.md).

## UC-SEARCH-01 — Tìm và xem chuyến

```mermaid
sequenceDiagram
    autonumber
    actor U as Guest/Customer
    participant C as Web/Mobile Client
    participant GW as API Gateway
    participant TR as Transport Service
    participant TDB as Transport DB
    participant BK as Booking Service
    participant BDB as Booking DB

    U->>C: Nhập tiêu chí tìm kiếm
    C->>GW: Search trips
    GW->>TR: Tiêu chí + paging/sort
    TR->>TDB: Query Trip đang sellable
    alt Tiêu chí không hợp lệ
        TR-->>C: Validation error
    else Không có chuyến
        TR-->>C: Danh sách rỗng
    else Có kết quả
        TR-->>C: Danh sách Trip và fare summary
        U->>C: Mở chi tiết Trip
        C->>GW: Get trip detail
        GW->>TR: Load schedule, route và policy
        TR->>TDB: Read Trip snapshot
        TR-->>C: Trip detail
        C->>GW: Get current seat availability
        GW->>BK: Load TripSeat snapshot
        BK->>BDB: Read TripSeat state
        BK-->>C: Availability + dataAsOf
    end
```

## UC-BOOK-01 — Giữ ghế và tạo Booking

```mermaid
sequenceDiagram
    autonumber
    actor CUS as Customer
    participant C as Web/Mobile Client
    participant GW as API Gateway
    participant BK as Booking Service
    participant DB as Booking DB
    participant R as Redis
    participant MQ as RabbitMQ

    CUS->>C: Chọn một hoặc nhiều ghế
    C->>GW: Create SeatHold + Idempotency-Key
    GW->>BK: Customer identity + hold command
    BK->>DB: Lock TripSeat rows và kiểm tra AVAILABLE
    alt Có ghế không còn khả dụng
        BK->>DB: Rollback toàn bộ
        BK-->>C: SEAT_UNAVAILABLE
    else Tất cả ghế khả dụng
        BK->>DB: SeatHold=ACTIVE, TripSeat=HELD + Outbox
        BK->>R: Đặt TTL helper
        BK->>MQ: SeatHoldCreated
        BK-->>C: holdToken, expiresAt, price snapshot
        CUS->>C: Nhập Passenger và điểm đón/trả
        C->>GW: Create Booking + holdToken + Idempotency-Key
        GW->>BK: Booking command
        BK->>DB: Verify owner, hold, passengers, stops và expiry
        alt Hold hết hạn hoặc request không hợp lệ
            BK-->>C: SEAT_HOLD_EXPIRED hoặc validation error
        else Hợp lệ
            BK->>DB: Recalculate total, consume hold, create PENDING_PAYMENT + Outbox
            BK->>MQ: BookingCreated
            BK-->>C: Booking summary + payment expiry
        end
    end
```

## UC-BOOK-02 — Xem Booking và Ticket của tôi

```mermaid
sequenceDiagram
    autonumber
    actor CUS as Customer
    participant C as Client
    participant GW as API Gateway
    participant BK as Booking Service
    participant DB as Booking DB

    CUS->>C: Mở Booking/Vé của tôi
    C->>GW: List my bookings
    GW->>BK: Customer ID từ token
    BK->>DB: Query theo customer và trạng thái
    BK-->>C: Danh sách phân trang
    CUS->>C: Chọn Booking/Ticket
    C->>GW: Get detail
    GW->>BK: Customer ID + resource ID
    BK->>DB: Kiểm tra ownership và đọc aggregate/projection
    alt Không thuộc Customer
        BK-->>C: 404/403 theo disclosure policy
    else Thuộc Customer
        BK-->>C: Trip, passenger, seat, payment/refund summary, ticket
        C->>C: Chỉ bật action hợp lệ theo state
    end
```

## UC-TICKET-01 — Xem và sử dụng vé điện tử

```mermaid
sequenceDiagram
    autonumber
    actor CUS as Customer
    participant C as Mobile/Web Client
    participant GW as API Gateway
    participant BK as Booking Service
    participant DB as Booking DB

    CUS->>C: Mở Ticket
    C->>GW: Get ticket
    GW->>BK: Customer identity + ticket ID
    BK->>DB: Verify ownership và Ticket state
    alt Không sở hữu Ticket
        BK-->>C: Từ chối, không lộ PII
    else ISSUED
        BK-->>C: Ticket detail + QR token + public code
        opt Mobile cho phép lưu offline
            C->>C: Lưu bản giới hạn, có trạng thái và expiry
        end
    else CANCELLED, REFUNDED hoặc USED
        BK-->>C: Ticket detail không có QR hiệu lực
    end
    opt Client có mạng trở lại
        C->>GW: Refresh ticket state
        GW->>BK: Get latest state
        BK-->>C: Trạng thái hiện hành
    end
```
