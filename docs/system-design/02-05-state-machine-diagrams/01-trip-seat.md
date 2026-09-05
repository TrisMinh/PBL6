# TripSeat State Machine

Nguồn: SRS `6.1`, `BR-SEAT-*`. Owner: Booking Service.

```mermaid
stateDiagram-v2
    [*] --> AVAILABLE: inventory initialized
    AVAILABLE --> HELD: SeatHold created atomically
    HELD --> AVAILABLE: hold expired/released<br/>[Trip still sellable]
    HELD --> BOOKED: verified payment/booking<br/>[same hold owner]
    AVAILABLE --> DISABLED: operator disables<br/>[not held/booked]
    DISABLED --> AVAILABLE: operator enables<br/>[Trip still sellable]
    BOOKED --> AVAILABLE: Ticket cancelled<br/>[Trip still resellable]
```

## Invariant

- `SELECTED` chỉ tồn tại ở UI, không phải state phía server.
- Một `TripSeat` không đồng thời thuộc hai `SeatHold ACTIVE` hoặc hai Ticket còn hiệu lực.
- `BOOKED` không tự về `AVAILABLE` khi TTL/cache hết hạn.
- Giữ nhiều ghế phải thành công toàn bộ hoặc rollback toàn bộ.

