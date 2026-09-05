# Payment State Machine

Nguồn: SRS `6.4`, `BR-PAY-*`. Owner: Payment Service.

```mermaid
stateDiagram-v2
    [*] --> PENDING: Payment created
    PENDING --> PROCESSING: request accepted/sent to provider
    PENDING --> CANCELLED: cancelled before processing
    PROCESSING --> SUCCEEDED: verified final success
    PROCESSING --> FAILED: provider final failure
    PROCESSING --> CANCELLED: provider/customer cancellation<br/>[not succeeded]
    SUCCEEDED --> REFUND_PENDING: refund processing starts
    REFUND_PENDING --> PARTIALLY_REFUNDED: successful refund total<br/>is less than payment amount
    REFUND_PENDING --> REFUNDED: all required amount refunded
    PARTIALLY_REFUNDED --> REFUNDED: remaining refund succeeded
    CANCELLED --> [*]
    FAILED --> [*]
    REFUNDED --> [*]
```

## Invariant

- Timeout/redirect không phải final failure; trạng thái chưa chắc chắn giữ `PROCESSING`.
- `SUCCEEDED` không đổi thành `FAILED` do callback đến trễ hoặc mâu thuẫn; mở reconciliation case.
- `(provider, externalEventId)` và `(provider, providerTransactionId)` được deduplicate.
- Tổng Refund thành công không vượt amount của Payment.

