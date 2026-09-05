# Notification Domain/Class Diagram

Owner: Notification Service. Delivery lifecycle độc lập với transaction Booking/Payment.

```mermaid
classDiagram
    class Notification {
        <<AggregateRoot>>
        +UUID id
        +UUID userId
        +NotificationType type
        +string safeReference
        +string title
        +string body
        +ReadStatus readStatus
        +datetime createdAt
        +markRead()
        +planDeliveries(preferences)
    }
    class DeliveryAttempt {
        +UUID id
        +Channel channel
        +string providerReference
        +DeliveryStatus status
        +int attemptNo
        +string safeErrorCode
        +start()
        +succeed(reference)
        +fail(code)
    }
    class Template {
        <<AggregateRoot>>
        +UUID id
        +string code
        +Channel channel
        +int version
        +TemplateStatus status
        +render(safeData)
        +activate()
    }
    class UserPreference {
        <<AggregateRoot>>
        +UUID userId
        +NotificationType type
        +Channel channel
        +bool enabled
        +change(enabled)
    }

    Notification "1" *-- "0..*" DeliveryAttempt : delivery history
    Template "1" --> "0..*" Notification : renders
    UserPreference "0..*" --> "0..*" Notification : controls optional channels
```

## Aggregate rules

- Thông báo thiết yếu không bị tắt ngoài policy.
- Push/email body không chứa secret, full token hoặc PII không cần thiết.
- Provider lỗi tạo retry có giới hạn; không rollback transaction nguồn.
- Mỗi delivery attempt giữ safe error code và provider reference để vận hành.

