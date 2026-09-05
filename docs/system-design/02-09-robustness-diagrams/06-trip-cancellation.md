# Robustness — Hủy Trip

Nguồn: `UC-TRIP-01`, `BP-06`.

```mermaid
flowchart LR
    OA["◯<br/>╱│╲<br/>╱ ╲<br/>Operator/Admin"]:::actor
    MQ["«external actor»<br/>RabbitMQ"]

    PAGE[["«boundary»<br/>Trip Operation UI"]]
    API[["«boundary»<br/>Trip Cancellation API"]]
    EVENT[["«boundary»<br/>TripCancelled Consumer"]]

    IMPACT(("«control»<br/>CancellationImpactQuery"))
    CANCEL(("«control»<br/>CancelTripController"))
    BATCH(("«control»<br/>AffectedBookingProcessor"))
    REFUND(("«control»<br/>RefundRequestPublisher"))

    TRIP["«entity»<br/>Transport.Trip"]
    JOB["«entity»<br/>CancellationCheckpoint"]
    SNAP["«entity»<br/>Booking.TripSnapshot"]
    TICKET["«entity»<br/>Booking/Ticket"]
    OUTBOX["«entity»<br/>OutboxMessage"]

    OA --> PAGE
    MQ --> EVENT
    PAGE --> API
    EVENT --> BATCH
    API -->|preview impact| IMPACT
    API -->|confirm + reason| CANCEL
    IMPACT --> TRIP
    IMPACT --> SNAP
    CANCEL --> TRIP
    CANCEL --> OUTBOX
    BATCH --> JOB
    BATCH --> SNAP
    BATCH --> TICKET
    BATCH --> REFUND
    REFUND --> OUTBOX

    classDef actor fill:transparent,stroke:transparent
```

## Trách nhiệm kiểm tra

- Transport control kiểm tra permission/tenant/state/version; hủy thông thường chỉ từ `SCHEDULED/BOARDING`.
- `TripCancelled` kích hoạt Booking processor; batch checkpoint cho phép resume mà không hủy/refund lặp.
- Booking thu hồi Ticket trước khi request Refund; nhà xe hủy không áp phí hủy Customer.
- Notification/Reporting không nằm trong transaction hủy.
