# Payment Domain/Class Diagram

Owner: Payment Service. `bookingId` là external reference, không phải quan hệ đến Booking DB.

```mermaid
classDiagram
    class Payment {
        <<AggregateRoot>>
        +UUID id
        +UUID bookingId
        +Money amount
        +string currency
        +PaymentStatus status
        +string provider
        +string idempotencyKey
        +startAttempt()
        +applyVerifiedResult(result)
        +requestRefund(amount)
    }
    class PaymentAttempt {
        +UUID id
        +string providerTransactionId
        +string requestReference
        +AttemptStatus status
        +datetime createdAt
        +complete(result)
    }
    class WebhookReceipt {
        +UUID id
        +string provider
        +string externalEventId
        +string payloadHash
        +bool signatureVerified
        +datetime processedAt
        +markProcessed()
    }
    class Refund {
        <<AggregateRoot>>
        +UUID id
        +UUID bookingId
        +Money amount
        +string reason
        +RefundStatus status
        +string idempotencyKey
        +start()
        +succeed(providerRef)
        +fail(code)
        +retry(actor)
    }
    class ReconciliationCase {
        +UUID id
        +CaseType type
        +CaseStatus status
        +string providerStatus
        +string localStatus
        +open()
        +resolve(actor, resolution)
    }

    Payment "1" *-- "1..*" PaymentAttempt : attempts
    Payment "1" o-- "0..*" WebhookReceipt : evidence
    Payment "1" o-- "0..*" Refund : refunds
    Payment "1" o-- "0..*" ReconciliationCase : discrepancies
    Refund "0..1" --> "0..*" ReconciliationCase : may open
```

## Aggregate rules

- Provider event/transaction ID là unique trong phạm vi provider.
- Payment result và outbox được commit cùng local transaction.
- Refund dùng logical ID/idempotency ổn định qua retry; tổng refund thành công không vượt Payment amount.
- Provider outcome mâu thuẫn không ghi đè `SUCCEEDED`; tạo `ReconciliationCase` có audit.

