# 2.2.2 Use Case Diagram — Tìm chuyến, Booking và Ticket

Nguồn đặc tả: [Tìm chuyến, Booking và Ticket](../../srs-v2/04-use-cases/02-search-booking-ticket.md).

```mermaid
flowchart LR
    G["◯<br/>╱│╲<br/>╱ ╲<br/>Guest"]
    C["◯<br/>╱│╲<br/>╱ ╲<br/>Customer"]

    subgraph SYS["Online Bus Ticket Booking System"]
        direction TB
        S1(["UC-SEARCH-01<br/>Tìm và xem chuyến"])
        B1(["UC-BOOK-01<br/>Giữ ghế và tạo Booking"])
        B2(["UC-BOOK-02<br/>Xem Booking và Ticket của tôi"])
        T1(["UC-TICKET-01<br/>Xem và sử dụng vé điện tử"])
        HOLD(["Giữ toàn bộ ghế đã chọn"])
        PRICE(["Tính giá và lưu snapshot"])
        OWNER(["Kiểm tra ownership"])

        B1 -. "«include»" .-> HOLD
        B1 -. "«include»" .-> PRICE
        B2 -. "«include»" .-> OWNER
        T1 -. "«include»" .-> OWNER
        T1 -. "«extend» khi chọn Ticket" .-> B2
    end

    G --- S1
    C --- S1
    C --- B1
    C --- B2
    C --- T1

    classDef actor fill:transparent,stroke:transparent
    class G,C actor
    style SYS fill:transparent
```

Guest chỉ tìm/xem chuyến. Giữ ghế, Booking và Ticket yêu cầu Customer đã xác thực; hệ thống luôn kiểm tra ownership ở server.
