# Booking State Machine

Nguồn: SRS `6.3`, `BR-BOOK-*`, `BR-PAY-*`. Owner: Booking Service.

```mermaid
stateDiagram-v2
    [*] --> PENDING_PAYMENT: Booking created
    PENDING_PAYMENT --> PAID: PaymentSucceeded verified<br/>[seat ownership valid]
    PENDING_PAYMENT --> EXPIRED: payment window elapsed
    PENDING_PAYMENT --> CANCELLED: cancelled before payment
    PAID --> COMPLETED: Trip completed<br/>[ticket obligations ended]
    PAID --> CANCELLED: valid customer/trip cancellation
    CANCELLED --> REFUND_PENDING: paid amount must be refunded
    REFUND_PENDING --> REFUNDED: required refunds succeeded
    EXPIRED --> [*]
    COMPLETED --> [*]
    REFUNDED --> [*]
```

## Invariant

- `PAID` không cho sửa trực tiếp Passenger hoặc TripSeat.
- Hủy từng Booking Item/Ticket được theo dõi ở mức item; Booking là trạng thái tổng hợp.
- Duplicate `PaymentSucceeded` không tạo lại transition, Ticket hoặc outbox event.
- `CANCELLED` có thể là điểm dừng khi không có khoản phải hoàn; nếu có tiền cần hoàn thì bắt buộc đi qua `REFUND_PENDING`.

