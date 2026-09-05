# 2.6 Domain/Class Diagrams

Các sơ đồ mô tả mô hình miền logic, aggregate boundary và cardinality. Đây không phải ORM model hay schema vật lý; external reference giữa service chỉ là ID/snapshot và không tạo quan hệ object hoặc foreign key xuyên service.

## Danh mục

| Bounded context | Sơ đồ | Aggregate root chính |
|---|---|---|
| Identity | [Identity domain](./01-identity-domain.md) | User, Role |
| Transport | [Transport domain](./02-transport-domain.md) | Organization, Bus, Route, Trip |
| Booking | [Booking domain](./03-booking-domain.md) | SeatHold, Booking, Promotion |
| Payment | [Payment domain](./04-payment-domain.md) | Payment, Refund |
| Notification | [Notification domain](./05-notification-domain.md) | Notification, Template, UserPreference |
| Reporting | [Reporting domain](./06-reporting-domain.md) | ReportProjection, ExportJob |

## Quy ước

- `*--`: composition, vòng đời child nằm trong aggregate/root.
- `o--`: aggregation/reference trong cùng bounded context.
- `-->`: association hoặc external reference không sở hữu vòng đời.
- Cardinality thể hiện invariant nghiệp vụ, không phải số row hiện tại.
- Một aggregate chỉ được thay đổi qua hành vi của root; transaction không vượt service boundary.

