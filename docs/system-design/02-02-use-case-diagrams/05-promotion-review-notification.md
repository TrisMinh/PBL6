# 2.2.5 Use Case Diagram — Promotion, Review và Notification

Nguồn đặc tả: [Promotion, Review và Notification](../../srs-v2/04-use-cases/05-promotion-review-notification.md).

```mermaid
flowchart LR
    OA["◯<br/>╱│╲<br/>╱ ╲<br/>Operator Staff / Admin"]
    C["◯<br/>╱│╲<br/>╱ ╲<br/>Customer"]
    M["◯<br/>╱│╲<br/>╱ ╲<br/>Moderator"]
    U["◯<br/>╱│╲<br/>╱ ╲<br/>User"]
    NP["Notification Provider<br/>«external system»"]

    subgraph SYS["Online Bus Ticket Booking System"]
        direction TB
        P1(["UC-PROMO-01<br/>Quản lý và áp dụng Promotion"])
        R1(["UC-REVIEW-01<br/>Tạo và cập nhật Review"])
        R2(["UC-REVIEW-02<br/>Kiểm duyệt Review"])
        N1(["UC-NOTIF-01<br/>Xem và cấu hình Notification"])
        PM(["Quản lý Promotion"])
        PA(["Áp dụng Promotion"])
        BOOK(["Giữ ghế và tạo Booking"])
        ELIGIBLE(["Kiểm tra Ticket USED và ownership"])
        MODERATE(["Lưu reason và audit kiểm duyệt"])
        PREF(["Cấu hình kênh tùy chọn"])
        DELIVER(["Gửi và theo dõi DeliveryAttempt"])

        PM -. "«extend» actor quản lý" .-> P1
        PA -. "«extend» Customer" .-> P1
        PA -. "«extend» khi có mã" .-> BOOK
        R1 -. "«include»" .-> ELIGIBLE
        R2 -. "«include»" .-> MODERATE
        N1 -. "«include»" .-> PREF
        N1 -. "«include»" .-> DELIVER
    end

    OA --- P1
    C --- P1
    C --- R1
    M --- R2
    U --- N1
    DELIVER --- NP

    classDef actor fill:transparent,stroke:transparent
    class OA,C,M,U actor
    style SYS fill:transparent
```

Áp dụng Promotion là hành vi tùy chọn khi Customer cung cấp mã. Notification Provider chỉ thực hiện delivery, không quyết định trạng thái Booking, Payment, Ticket hoặc Refund.
