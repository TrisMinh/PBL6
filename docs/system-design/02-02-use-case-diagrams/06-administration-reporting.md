# 2.2.6 Use Case Diagram — Quản trị và báo cáo

Nguồn đặc tả: [Quản trị và báo cáo](../../srs-v2/04-use-cases/06-administration-reporting.md).

```mermaid
flowchart LR
    A["◯<br/>╱│╲<br/>╱ ╲<br/>Admin"]
    F["◯<br/>╱│╲<br/>╱ ╲<br/>Operator Finance"]
    S["◯<br/>╱│╲<br/>╱ ╲<br/>Support Staff"]
    PG["Payment Gateway<br/>«external system»"]
    NP["Notification Provider<br/>«external system»"]

    subgraph SYS["Online Bus Ticket Booking System"]
        direction TB
        A1(["UC-ADMIN-01<br/>Quản lý User, Organization và quyền"])
        A2(["UC-ADMIN-02<br/>Tra cứu giao dịch và audit"])
        A3(["UC-ADMIN-03<br/>Quản lý khiếu nại"])
        R1(["UC-REPORT-01<br/>Xem và xuất báo cáo"])
        AUDIT(["Ghi audit hành động nhạy cảm"])
        LOOKUP(["Liên kết Booking / Payment / Refund"])
        RECON(["Đối soát giao dịch"])
        RESOLVE(["Ghi owner, trạng thái và resolution"])
        EXPORT(["Tạo Export Job"])
        DOWNLOAD(["Kiểm tra quyền và cấp link tải có hạn"])
        NOTIFY(["Thông báo export sẵn sàng"])

        A1 -. "«include»" .-> AUDIT
        A2 -. "«include»" .-> LOOKUP
        RECON -. "«extend» khi trạng thái chưa chắc chắn" .-> A2
        A3 -. "«include»" .-> RESOLVE
        LOOKUP -. "«extend» khi có giao dịch liên quan" .-> A3
        EXPORT -. "«extend» khi yêu cầu tải dữ liệu" .-> R1
        EXPORT -. "«include»" .-> DOWNLOAD
        EXPORT -. "«include»" .-> NOTIFY
    end

    A --- A1
    A --- A2
    A --- A3
    A --- R1
    F --- A2
    F --- R1
    S --- A3
    RECON --- PG
    NOTIFY --- NP

    classDef actor fill:transparent,stroke:transparent
    class A,F,S actor
    style SYS fill:transparent
```

Operator Finance luôn bị giới hạn theo tenant. Link export không tự trao quyền; hệ thống kiểm tra lại authorization tại thời điểm tải.
