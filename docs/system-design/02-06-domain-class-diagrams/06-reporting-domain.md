# Reporting Domain/Class Diagram

Owner: Reporting Service. Tất cả projection đều có thể rebuild từ event/reconciliation API và không sửa transaction nguồn.

```mermaid
classDiagram
    class RevenueProjection {
        <<ReadModel>>
        +UUID organizationId
        +date period
        +Money gross
        +Money refund
        +Money net
        +datetime dataAsOf
        +apply(event)
    }
    class BookingProjection {
        <<ReadModel>>
        +UUID bookingId
        +UUID organizationId
        +BookingStatus status
        +Money total
        +datetime createdAt
        +datetime dataAsOf
        +apply(event)
    }
    class OccupancyProjection {
        <<ReadModel>>
        +UUID tripId
        +UUID organizationId
        +int totalSeats
        +int heldSeats
        +int bookedSeats
        +decimal occupancyRate
        +datetime dataAsOf
        +apply(event)
    }
    class ExportJob {
        <<AggregateRoot>>
        +UUID id
        +UUID requestedBy
        +string scope
        +string filterJson
        +ExportStatus status
        +string objectKey
        +datetime expiresAt
        +queue()
        +complete(objectKey)
        +fail(code)
    }
    class ExportDownloadAudit {
        <<AppendOnly>>
        +UUID exportJobId
        +UUID actorId
        +datetime downloadedAt
        +UUID correlationId
    }
    class IntegrationEvent {
        <<Contract>>
        +UUID messageId
        +string eventType
        +UUID aggregateId
        +long aggregateVersion
        +datetime occurredAt
    }

    IntegrationEvent --> RevenueProjection : updates idempotently
    IntegrationEvent --> BookingProjection : updates idempotently
    IntegrationEvent --> OccupancyProjection : updates idempotently
    ExportJob "1" *-- "0..*" ExportDownloadAudit : download audit
    ExportJob "0..*" --> "0..*" RevenueProjection : reads
    ExportJob "0..*" --> "0..*" OccupancyProjection : reads
```

## Aggregate rules

- API luôn trả `generatedAt/dataAsOf`; eventual-consistency lag phải quan sát được.
- Consumer inbox ngăn một event cộng doanh thu hoặc occupancy hai lần.
- Export lớn chạy bất đồng bộ, lưu object key thay vì payload trong RabbitMQ.
- Quyền được kiểm tra lúc tạo job và kiểm tra lại lúc tải; file có expiry.
