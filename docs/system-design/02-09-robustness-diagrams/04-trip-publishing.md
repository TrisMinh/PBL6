# Robustness — Tạo và mở bán Trip

Nguồn: `UC-OPS-05`, `BP-04`.

```mermaid
flowchart LR
    O["◯<br/>╱│╲<br/>╱ ╲<br/>Operator Scheduler"]:::actor
    BK["«external actor»<br/>Booking Service / RabbitMQ"]

    EDIT[["«boundary»<br/>Trip Editor UI"]]
    API[["«boundary»<br/>Operator Trip API"]]
    EVENT[["«boundary»<br/>TripInventoryReady Consumer"]]

    VALID(("«control»<br/>TripValidationController"))
    SCHED(("«control»<br/>ScheduleConflictPolicy"))
    PUB(("«control»<br/>PublishTripController"))
    READY(("«control»<br/>InventoryReadinessController"))

    ORG["«entity»<br/>Organization"]
    ROUTE["«entity»<br/>Route"]
    BUS["«entity»<br/>Bus/Seat"]
    DRIVER["«entity»<br/>DriverProfile/Assignment"]
    TRIP["«entity»<br/>Trip"]
    OUTBOX["«entity»<br/>OutboxMessage"]

    O --> EDIT
    BK --> EVENT
    EDIT --> API
    EVENT --> READY
    API --> VALID
    API --> PUB
    VALID --> ORG
    VALID --> ROUTE
    VALID --> BUS
    VALID --> DRIVER
    VALID --> SCHED
    SCHED --> TRIP
    PUB --> TRIP
    PUB --> OUTBOX
    READY --> TRIP

    classDef actor fill:transparent,stroke:transparent
```

## Trách nhiệm kiểm tra

- Validation kiểm tra tenant/resource/license/time; conflict policy kiểm tra interval và buffer Bus/Driver.
- Publish ghi `SCHEDULED`, `sellable=false`, immutable snapshot và `TripPublished` Outbox.
- Inventory readiness chỉ mark sellable khi nhận `TripInventoryReady` đúng trip/source version.
- Command publish lặp không tạo snapshot hoặc inventory lần hai.
