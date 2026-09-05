# 2.3.4 Vận hành nhà xe, Trip và check-in

Nguồn nghiệp vụ: [SRS — Vận hành nhà xe, Trip và check-in](../../srs-v2/04-use-cases/04-operator-trip-checkin.md).

## UC-OPS-01 — Quản lý thông tin nhà xe

```mermaid
sequenceDiagram
    autonumber
    actor O as Operator Staff
    participant BO as Back-office Web
    participant GW as API Gateway
    participant TR as Transport Service
    participant DB as Transport DB

    O->>BO: Mở hồ sơ nhà xe
    BO->>GW: Get my organization
    GW->>TR: Identity + tenant scope
    TR->>DB: Read Organization theo membership
    TR-->>BO: Các trường được phép xem/sửa + version
    O->>BO: Lưu thay đổi
    BO->>GW: Update organization + version
    GW->>TR: Update command
    TR->>DB: Check permission, tenant và optimistic version
    alt Sai tenant, field bị cấm hoặc version cũ
        TR-->>BO: Forbidden, validation hoặc conflict
    else Hợp lệ
        TR->>DB: Update Organization + audit
        TR-->>BO: Organization version mới
    end
```

## UC-OPS-02 — Quản lý xe và sơ đồ ghế

```mermaid
sequenceDiagram
    autonumber
    actor FM as Fleet Manager
    participant BO as Back-office Web
    participant GW as API Gateway
    participant TR as Transport Service
    participant DB as Transport DB

    FM->>BO: Tạo/chọn Bus
    BO->>GW: Save Bus và Seat template
    GW->>TR: Tenant context + bus command
    TR->>DB: Check permission, plate và references
    TR->>DB: Validate seat codes, layout và enabled state
    alt Plate/seat code trùng hoặc dữ liệu sai
        TR-->>BO: Validation/conflict, không ghi một phần
    else Bus đã được Trip tương lai tham chiếu
        TR->>DB: Áp policy version/deactivate, không hard delete
        TR-->>BO: Kết quả và phạm vi ảnh hưởng
    else Hợp lệ
        TR->>DB: Save Bus + versioned Seat template
        TR-->>BO: Bus/template đã lưu
    end
    Note over TR,DB: Trip đã publish giữ nguyên seat snapshot
```

## UC-OPS-03 — Quản lý tài xế

```mermaid
sequenceDiagram
    autonumber
    actor O as Operator Staff
    participant BO as Back-office Web
    participant GW as API Gateway
    participant TR as Transport Service
    participant DB as Transport DB

    O->>BO: Tạo/cập nhật DriverProfile
    BO->>GW: Driver data + membership reference
    GW->>TR: Tenant context + command
    TR->>DB: Check permission, membership và unique license
    alt User khác tenant hoặc membership inactive
        TR-->>BO: Từ chối liên kết
    else Dữ liệu hợp lệ
        TR->>DB: Save profile, license expiry và status
        alt License hết hạn
            TR-->>BO: Lưu profile nhưng không cho assignment
        else License còn hiệu lực
            TR-->>BO: Driver sẵn sàng theo status
        end
    end
```

## UC-OPS-04 — Quản lý tuyến và điểm dừng

```mermaid
sequenceDiagram
    autonumber
    actor S as Operator Scheduler
    participant BO as Back-office Web
    participant GW as API Gateway
    participant TR as Transport Service
    participant DB as Transport DB

    S->>BO: Nhập Route và ordered Stops
    BO->>GW: Save Route version
    GW->>TR: Tenant context + route command
    TR->>TR: Validate endpoints, stop order và time offsets
    TR->>DB: Check references và optimistic version
    alt Route/stop không hợp lệ hoặc version conflict
        TR-->>BO: Validation/conflict, giữ dữ liệu cũ
    else Hợp lệ
        TR->>DB: Save Route + RouteStops atomically
        TR-->>BO: Route version mới
    end
    Note over TR,DB: Trip đã publish tiếp tục dùng route snapshot cũ
```

## UC-OPS-05 — Tạo và mở bán chuyến xe

```mermaid
sequenceDiagram
    autonumber
    actor S as Operator Scheduler
    participant BO as Back-office Web
    participant GW as API Gateway
    participant TR as Transport Service
    participant TDB as Transport DB
    participant MQ as RabbitMQ
    participant BK as Booking Service
    participant BDB as Booking DB

    S->>BO: Tạo draft và xác nhận publish
    BO->>GW: Publish Trip + Idempotency-Key
    GW->>TR: Tenant context + Trip command
    TR->>TDB: Validate Route, Bus, Driver, schedule, fare và policy
    alt Conflict lịch, resource inactive hoặc thời gian sai
        TR-->>BO: Từ chối publish với lỗi trong scope
    else Hợp lệ
        TR->>TDB: Trip=SCHEDULED + snapshots + Outbox(TripPublished)
        TR->>MQ: TripPublished
        MQ-->>BK: TripPublished at-least-once
        BK->>BDB: Inbox + tạo TripSnapshot/TripSeat + Outbox
        BK->>MQ: TripInventoryReady
        MQ-->>TR: TripInventoryReady
        TR->>TDB: Mark Trip sellable idempotently
        TR-->>BO: Trip đã mở bán
    end
```

## UC-OPS-06 — Vận hành Trip và danh sách hành khách

```mermaid
sequenceDiagram
    autonumber
    actor A as Operator/Driver
    participant BO as Back-office/Mobile
    participant GW as API Gateway
    participant TR as Transport Service
    participant TDB as Transport DB
    participant BK as Booking Service
    participant BDB as Booking DB
    participant MQ as RabbitMQ

    alt Xem manifest
        A->>BO: Mở Trip được phép
        BO->>GW: Get manifest
        GW->>BK: Actor, tenant và assignment claims
        BK->>BDB: Verify scope và read passenger/seat minimum
        BK-->>BO: Manifest + dataAsOf
    else Chuyển trạng thái Trip
        A->>BO: Chọn transition
        BO->>GW: Transition Trip + expected version
        GW->>TR: Actor context + command
        TR->>TDB: Check assignment, state guard và version
        alt Không có quyền hoặc transition invalid
            TR-->>BO: Forbidden hoặc invalid transition
        else Hợp lệ
            TR->>TDB: Update Trip + audit + Outbox
            TR->>MQ: TripStatusChanged
            MQ-->>BK: Cập nhật Trip snapshot
            TR-->>BO: Trip state/version mới
        end
    end
```

## UC-DRIVER-01 — Check-in hành khách

```mermaid
sequenceDiagram
    autonumber
    actor D as Driver/Operator
    participant C as Mobile/Back-office
    participant GW as API Gateway
    participant BK as Booking Service
    participant DB as Booking DB
    participant MQ as RabbitMQ

    D->>C: Quét QR hoặc nhập public code
    C->>GW: Validate/check-in Ticket
    GW->>BK: Actor, assignment claims và token/code
    BK->>DB: Lock Ticket, verify Trip, state và actor scope
    alt QR sai, khác Trip hoặc actor mất assignment
        BK-->>C: Từ chối, không lộ PII
    else Ticket đã check-in
        BK-->>C: Kết quả idempotent + thời điểm trước đó
    else Ticket ISSUED và hợp lệ
        BK->>DB: Ticket=CHECKED_IN + actor/time/audit + Outbox
        BK->>MQ: PassengerCheckedIn
        BK-->>C: Passenger/seat tối thiểu + thành công
    end
```

## UC-TRIP-01 — Hủy chuyến xe có vé đã bán

```mermaid
sequenceDiagram
    autonumber
    actor O as Operator/Admin
    participant BO as Back-office Web
    participant GW as API Gateway
    participant TR as Transport Service
    participant TDB as Transport DB
    participant MQ as RabbitMQ
    participant BK as Booking Service
    participant PAY as Payment Service
    participant N as Notification Service

    O->>BO: Chọn Trip, lý do và xác nhận
    BO->>GW: Cancel Trip + Idempotency-Key
    GW->>TR: Actor scope + cancellation command
    TR->>TDB: Check permission, Trip state và version
    alt Không được phép hoặc transition invalid
        TR-->>BO: Từ chối, Trip giữ nguyên
    else Được phép hủy
        TR->>TDB: Trip=CANCELLED + logical cancellation + Outbox
        TR->>MQ: TripCancelled
        MQ-->>BK: TripCancelled
        BK->>BK: Batch idempotent theo Booking/Ticket
        BK->>MQ: BookingCancelled + RefundRequested
        MQ-->>PAY: RefundRequested theo từng payment
        MQ-->>N: Thông báo Customer bị ảnh hưởng
        TR-->>BO: Cancellation accepted + progress
    end
    Note over BK,PAY: Batch resume từ checkpoint, Refund lỗi không khôi phục Trip/Ticket
```
