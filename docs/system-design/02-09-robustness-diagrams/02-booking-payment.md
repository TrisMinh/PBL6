# Robustness — Đặt vé và thanh toán

Nguồn: `UC-SEARCH-01`, `UC-BOOK-01`, `UC-PAY-01`, `UC-TICKET-01`.

```mermaid
flowchart LR
    C["◯<br/>╱│╲<br/>╱ ╲<br/>Customer"]:::actor
    PSP["«external actor»<br/>Payment Gateway"]

    SEARCH[["«boundary»<br/>Search/Trip UI"]]
    SEAT[["«boundary»<br/>Seat & Passenger UI"]]
    CHECKOUT[["«boundary»<br/>Checkout UI/API"]]
    WEBHOOK[["«boundary»<br/>PaymentWebhookEndpoint"]]

    SC(("«control»<br/>SearchTripController"))
    HC(("«control»<br/>SeatHoldController"))
    BC(("«control»<br/>CreateBookingController"))
    PC(("«control»<br/>PaymentResultController"))
    TC(("«control»<br/>TicketIssuanceController"))

    TS["«entity»<br/>TripSnapshot"]
    TSEAT["«entity»<br/>TripSeat"]
    HOLD["«entity»<br/>SeatHold"]
    BOOK["«entity»<br/>Booking"]
    ITEM["«entity»<br/>BookingItem/Passenger"]
    PAY["«entity»<br/>Payment"]
    TICKET["«entity»<br/>Ticket"]

    C --> SEARCH
    C --> SEAT
    C --> CHECKOUT
    PSP --> WEBHOOK
    SEARCH --> SC
    SEAT --> HC
    SEAT --> BC
    CHECKOUT --> BC
    CHECKOUT --> PC
    WEBHOOK --> PC
    SC --> TS
    HC --> TSEAT
    HC --> HOLD
    BC --> HOLD
    BC --> BOOK
    BC --> ITEM
    PC --> PAY
    PC --> TC
    TC --> BOOK
    TC --> TSEAT
    TC --> TICKET

    classDef actor fill:transparent,stroke:transparent
```

## Trách nhiệm kiểm tra

- `SeatHoldController` lock mọi TripSeat theo thứ tự ổn định và commit all-or-nothing.
- `CreateBookingController` tin giá server/snapshot, không tin total từ client.
- `PaymentResultController` chỉ nhận kết quả đã xác minh/deduplicate; redirect UI không gọi phát hành vé.
- `TicketIssuanceController` idempotent theo Booking Item và xác nhận seat ownership trước khi `BOOKED`.

