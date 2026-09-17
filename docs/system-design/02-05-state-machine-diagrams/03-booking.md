# Booking State Machine

Nguồn: SRS `6.3`, `BR-BOOK-*`, `BR-PAY-*`. Owner: Booking Service.

```mermaid
stateDiagram-v2
    [*] --> PENDING_PAYMENT: PREPAID booking created
    [*] --> CONFIRMED: PAY_LATER booking created<br/>[tickets issued]
    PENDING_PAYMENT --> PAID: PaymentSucceeded verified<br/>[seat ownership valid]
    PENDING_PAYMENT --> EXPIRED: payment window elapsed
    PENDING_PAYMENT --> CANCELLED: cancelled before payment
    PAID --> COMPLETED: Trip completed<br/>[ticket obligations ended]
    CONFIRMED --> COMPLETED: Trip completed<br/>[no platform refund]
    PAID --> CANCELLED: valid customer/trip cancellation
    CONFIRMED --> CANCELLED: cancel or no-show PAY_LATER
    CANCELLED --> REFUND_PENDING: PREPAID amount must be refunded
    REFUND_PENDING --> REFUNDED: required refunds succeeded
    EXPIRED --> [*]
    COMPLETED --> [*]
    REFUNDED --> [*]
    CANCELLED --> [*]
```

## Invariant

- `PAID`/`CONFIRMED` không cho sửa trực tiếp Passenger hoặc TripSeat.
- Duplicate `PaymentSucceeded` không tạo lại transition, Ticket hoặc outbox event.
- `CANCELLED` `PREPAID` có tiền cần hoàn thì bắt buộc `REFUND_PENDING`. `PAY_LATER` dừng ở `CANCELLED`.

