# Robustness — Check-in hành khách

Nguồn: `UC-OPS-06`, `UC-DRIVER-01`, `BP-05`.

```mermaid
flowchart LR
    D["◯<br/>╱│╲<br/>╱ ╲<br/>Driver/Operator"]:::actor

    MAN[["«boundary»<br/>Manifest UI"]]
    SCAN[["«boundary»<br/>QR Scanner / Code Input"]]
    API[["«boundary»<br/>Check-in API"]]

    AUTH(("«control»<br/>TripAccessPolicy"))
    VALID(("«control»<br/>TicketValidationController"))
    CHECK(("«control»<br/>CheckInController"))

    SNAP["«entity»<br/>TripSnapshot"]
    ASSIGN["«entity»<br/>AssignmentProjection"]
    TICKET["«entity»<br/>Ticket"]
    BOOK["«entity»<br/>BookingItem/Passenger"]
    AUDIT["«entity»<br/>CheckInAudit/Outbox"]

    D --> MAN
    D --> SCAN
    MAN --> AUTH
    SCAN --> API
    API --> AUTH
    API --> VALID
    API --> CHECK
    AUTH --> SNAP
    AUTH --> ASSIGN
    VALID --> SNAP
    VALID --> TICKET
    CHECK --> TICKET
    CHECK --> BOOK
    CHECK --> AUDIT

    classDef actor fill:transparent,stroke:transparent
```

## Trách nhiệm kiểm tra

- Access policy lọc manifest theo assignment/tenant trước khi trả PII tối thiểu.
- Validation xác minh QR/hash, đúng Trip và Ticket `ISSUED`; client scan không quyết định hợp lệ.
- Check-in dùng state/version guard; request lặp trả `checkedInAt` cũ.
- Outcome ghi audit/correlation và `PassengerCheckedIn` Outbox trong cùng transaction.

