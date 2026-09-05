# Robustness — Hủy vé và hoàn tiền

Nguồn: `UC-CANCEL-01`, `BP-02`.

```mermaid
flowchart LR
    C["◯<br/>╱│╲<br/>╱ ╲<br/>Customer"]:::actor

    PAGE[["«boundary»<br/>Ticket Detail / Cancel UI"]]
    API[["«boundary»<br/>Cancellation API"]]

    PREVIEW(("«control»<br/>CancellationPreviewController"))
    CANCEL(("«control»<br/>CancelTicketController"))
    REFUND(("«control»<br/>RefundRequestPublisher"))

    POLICY["«entity»<br/>PolicySnapshot"]
    TICKET["«entity»<br/>Ticket"]
    BOOK["«entity»<br/>Booking/BookingItem"]
    SEAT["«entity»<br/>TripSeat"]
    CP["«entity»<br/>CancellationPreview"]
    OUTBOX["«entity»<br/>OutboxMessage"]

    C --> PAGE
    PAGE --> API
    API -->|preview| PREVIEW
    API -->|confirm + idempotency key| CANCEL
    PREVIEW --> POLICY
    PREVIEW --> TICKET
    PREVIEW --> BOOK
    PREVIEW --> CP
    CANCEL --> CP
    CANCEL --> TICKET
    CANCEL --> BOOK
    CANCEL --> SEAT
    CANCEL --> REFUND
    REFUND --> OUTBOX

    classDef actor fill:transparent,stroke:transparent
```

## Trách nhiệm kiểm tra

- Preview kiểm tra ownership/state/time/policy nhưng không thay đổi Ticket.
- Confirm kiểm tra lại preview version và điều kiện trong transaction; preview cũ buộc tính lại.
- Seat chỉ được release khi vẫn thuộc Ticket/Booking đó và Trip còn bán.
- Refund publisher ghi Outbox cùng transaction hủy; lỗi Payment không phục hồi Ticket.

