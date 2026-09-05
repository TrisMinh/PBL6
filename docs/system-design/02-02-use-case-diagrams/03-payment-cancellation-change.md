# 2.2.3 Use Case Diagram — Payment, hủy và đổi vé

Nguồn đặc tả: [Payment, hủy và đổi vé](../../srs-v2/04-use-cases/03-payment-cancellation-change.md).

```mermaid
flowchart LR
    C["◯<br/>╱│╲<br/>╱ ╲<br/>Customer"]
    PG["Payment Gateway<br/>«external system»"]
    NP["Notification Provider<br/>«external system»"]

    subgraph SYS["Online Bus Ticket Booking System"]
        direction TB
        P1(["UC-PAY-01<br/>Thanh toán và nhận vé"])
        C1(["UC-CANCEL-01<br/>Hủy vé và hoàn tiền"])
        CH1(["UC-CHANGE-01<br/>Đổi vé"])
        VERIFY(["Xác minh kết quả thanh toán"])
        ISSUE(["Phát hành Ticket"])
        PREVIEW(["Xem trước phí và tiền hoàn"])
        REFUND(["Hoàn tiền"])
        NEW_HOLD(["Giữ ghế mới"])
        ADJUST(["Xử lý chênh lệch tài chính"])
        NOTIFY(["Gửi thông báo giao dịch"])

        P1 -. "«include»" .-> VERIFY
        P1 -. "«include»" .-> ISSUE
        P1 -. "«include»" .-> NOTIFY
        C1 -. "«include»" .-> PREVIEW
        C1 -. "«include»" .-> NOTIFY
        REFUND -. "«extend» khi đã thanh toán" .-> C1
        CH1 -. "«include»" .-> NEW_HOLD
        CH1 -. "«include»" .-> ADJUST
        CH1 -. "«include»" .-> NOTIFY
    end

    C --- P1
    C --- C1
    C --- CH1
    VERIFY --- PG
    REFUND --- PG
    ADJUST --- PG
    NOTIFY --- NP

    classDef actor fill:transparent,stroke:transparent
    class C actor
    style SYS fill:transparent
```

Payment Gateway chỉ hỗ trợ xử lý và xác minh giao dịch; hệ thống mới là bên quyết định Booking/Ticket. Hoàn tiền mở rộng hủy vé khi giao dịch đã thanh toán và refund amount lớn hơn 0.
