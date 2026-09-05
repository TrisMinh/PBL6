# Trip State Machine

Nguồn: SRS `6.7`, `BR-TRIP-*`. Owner: Transport Service.

```mermaid
stateDiagram-v2
    [*] --> SCHEDULED: Trip published
    SCHEDULED --> BOARDING: authorized actor<br/>[allowed boarding time]
    BOARDING --> DEPARTED: authorized driver/operator
    DEPARTED --> IN_TRANSIT: authorized driver/operator
    IN_TRANSIT --> ARRIVED: authorized driver/operator
    ARRIVED --> COMPLETED: authorized actor/configured job
    SCHEDULED --> CANCELLED: authorized operator/admin + reason
    BOARDING --> CANCELLED: authorized operator/admin + reason
    COMPLETED --> [*]
    CANCELLED --> [*]
```

## Invariant

- Hủy sau `DEPARTED` không thuộc transition thông thường nếu chưa có policy/quyền đặc biệt được phê duyệt.
- `sellable` là readiness flag phối hợp với inventory Booking, không phải Trip state.
- Mọi transition dùng expected version; xung đột phải reload thay vì ghi đè.
- `TripCancelled` được ghi vào outbox cùng transaction với state và audit.

