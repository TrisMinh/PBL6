# Event Flow — Vòng đời Trip

Nguồn: `UC-OPS-05`, `UC-OPS-06`, `UC-TRIP-01`, `BP-04..06`.

```mermaid
flowchart LR
    TR[Transport Service] --> TDB[(Transport DB<br/>Trip + Outbox)]
    TDB -.->|transport.trip.published.v1| MQ{{platform.events}}
    MQ -.->|at-least-once| BQ[(booking.trip-events.q)]
    MQ -.->|at-least-once| RQ[(reporting.integration-events.q)]
    BQ --> BK["Booking Service:<br/>Inbox + TripSnapshot + TripSeat"]
    BK --> BDB[(Booking DB + Outbox)]
    BDB -.->|booking.trip-inventory.ready.v1| MQ
    MQ -.->|ready| TQ[(transport.inventory-events.q)]
    TQ --> TR2["Transport: mark sellable=true<br/>idempotent by trip/version"]

    TR -.->|transport.trip.updated.v1| MQ
    TR -.->|transport.trip.status-changed.v1| MQ
    MQ -.->|snapshot/state update| BQ

    TR -.->|transport.trip.cancelled.v1| MQ
    MQ -.->|close inventory/cancel tickets| BQ
    MQ -.->|inform customers| NQ[(notification.integration-events.q)]
    MQ -.->|update metrics| RQ
```

## Consistency rules

- Trip được persist `SCHEDULED, sellable=false` trước khi `TripPublished` được phát.
- Chỉ `TripInventoryReady` đúng trip/source version mới cho Transport mark `sellable=true`.
- `TripUpdated` chỉ thay snapshot field được phép; dữ liệu Booking/Ticket lịch sử không bị rewrite.
- `TripCancelled` đóng inventory trước, sau đó Booking xử lý affected booking theo batch/checkpoint.
