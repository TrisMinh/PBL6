# Ticket State Machine

Nguồn: SRS `6.5`, `BR-TICKET-*`. Owner: Booking Service.

```mermaid
stateDiagram-v2
    [*] --> ISSUED: PREPAID paid item confirmed<br/>or PAY_LATER booking CONFIRMED
    ISSUED --> CHECKED_IN: valid QR/code<br/>[correct Trip and authorized actor]
    CHECKED_IN --> USED: Trip completed by policy
    ISSUED --> CANCELLED: valid customer/trip cancellation
    CANCELLED --> REFUNDED: related refund succeeded
    USED --> [*]
    REFUNDED --> [*]
```

## Invariant

- `CHECKED_IN` và `USED` không được Customer hủy bằng luồng thông thường.
- Check-in lặp trả kết quả/thời điểm cũ, không tạo transition thứ hai.
- `CANCELLED` là điểm dừng nếu không có khoản `PREPAID` phải hoàn. Ticket `PAY_LATER` không vào `REFUNDED`.
- QR của `CANCELLED`, `REFUNDED` hoặc `USED` không còn được trình bày như vé hiệu lực.

