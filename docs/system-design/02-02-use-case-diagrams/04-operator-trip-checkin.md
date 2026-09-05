# 2.2.4 Use Case Diagram — Vận hành nhà xe, Trip và check-in

Nguồn đặc tả: [Vận hành nhà xe, Trip và check-in](../../srs-v2/04-use-cases/04-operator-trip-checkin.md).

```mermaid
flowchart LR
    ORG["◯<br/>╱│╲<br/>╱ ╲<br/>Organization Manager"]
    FLEET["◯<br/>╱│╲<br/>╱ ╲<br/>Fleet Manager"]
    HR["◯<br/>╱│╲<br/>╱ ╲<br/>HR / Operations Staff"]
    SCH["◯<br/>╱│╲<br/>╱ ╲<br/>Operator Scheduler"]
    OPS["◯<br/>╱│╲<br/>╱ ╲<br/>Operator Operations"]
    D["◯<br/>╱│╲<br/>╱ ╲<br/>Driver"]
    A["◯<br/>╱│╲<br/>╱ ╲<br/>Admin"]
    PG["Payment Gateway<br/>«external system»"]
    NP["Notification Provider<br/>«external system»"]

    subgraph SYS["Online Bus Ticket Booking System"]
        direction TB
        O1(["UC-OPS-01<br/>Quản lý thông tin nhà xe"])
        O2(["UC-OPS-02<br/>Quản lý xe và sơ đồ ghế"])
        O3(["UC-OPS-03<br/>Quản lý tài xế"])
        O4(["UC-OPS-04<br/>Quản lý tuyến và điểm dừng"])
        O5(["UC-OPS-05<br/>Tạo và mở bán chuyến xe"])
        O6(["UC-OPS-06<br/>Vận hành Trip và danh sách hành khách"])
        D1(["UC-DRIVER-01<br/>Check-in hành khách"])
        T1(["UC-TRIP-01<br/>Hủy chuyến xe có vé đã bán"])
        VALIDATE(["Xác minh Bus / Driver / Route / lịch"])
        INVENTORY(["Tạo TripSeat inventory"])
        MANIFEST(["Xem manifest đúng phạm vi"])
        TRANSITION(["Chuyển trạng thái Trip"])
        CHECK(["Xác minh Ticket và assignment"])
        AFFECTED(["Xử lý Booking/Ticket bị ảnh hưởng"])
        REFUND(["Khởi tạo Refund"])
        NOTIFY(["Thông báo hành khách"])

        O5 -. "«include»" .-> VALIDATE
        O5 -. "«include»" .-> INVENTORY
        O6 -. "«include»" .-> MANIFEST
        O6 -. "«include»" .-> TRANSITION
        D1 -. "«include»" .-> CHECK
        T1 -. "«include»" .-> AFFECTED
        T1 -. "«include»" .-> REFUND
        T1 -. "«include»" .-> NOTIFY
    end

    ORG --- O1
    FLEET --- O2
    HR --- O3
    SCH --- O4
    SCH --- O5
    OPS --- O6
    OPS --- D1
    OPS --- T1
    D --- O6
    D --- D1
    A --- T1
    REFUND --- PG
    NOTIFY --- NP

    classDef actor fill:transparent,stroke:transparent
    class ORG,FLEET,HR,SCH,OPS,D,A actor
    style SYS fill:transparent
```

Các actor Operator được tách theo permission thay vì coi mọi nhân viên nhà xe có cùng quyền. Driver chỉ truy cập Trip được assignment; Admin chỉ tham gia luồng hủy Trip khi có quyền tương ứng.
