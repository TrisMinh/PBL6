# 2.3 Sequence Diagrams

Bộ 28 sơ đồ tuần tự ánh xạ một-một với 28 mã Use Case trong [SRS v2](../../srs-v2/04-use-cases/README.md). Tất cả sơ đồ được viết bằng Mermaid trực tiếp trong Markdown; không phụ thuộc file Word, SVG, PNG hoặc HTML.

## 1. Danh mục

| Mục | Nhóm | Use Case |
|---|---|---|
| [2.3.1](./01-identity-and-profile.md) | Định danh và hồ sơ | `UC-AUTH-01..04`, `UC-PROFILE-01` |
| [2.3.2](./02-search-booking-ticket.md) | Tìm chuyến, Booking và Ticket | `UC-SEARCH-01`, `UC-BOOK-01..02`, `UC-TICKET-01` |
| [2.3.3](./03-payment-cancellation-change.md) | Payment, hủy và đổi vé | `UC-PAY-01`, `UC-CANCEL-01`, `UC-CHANGE-01` |
| [2.3.4](./04-operator-trip-checkin.md) | Vận hành nhà xe và Trip | `UC-OPS-01..06`, `UC-DRIVER-01`, `UC-TRIP-01` |
| [2.3.5](./05-promotion-review-notification.md) | Promotion, Review và Notification | `UC-PROMO-01`, `UC-REVIEW-01..02`, `UC-NOTIF-01` |
| [2.3.6](./06-administration-reporting.md) | Quản trị và báo cáo | `UC-ADMIN-01..03`, `UC-REPORT-01` |

## 2. Quy ước

| Ký pháp | Ý nghĩa |
|---|---|
| `->>` | Lời gọi/yêu cầu đồng bộ hoặc publish message |
| `-->>` | Response hoặc delivery bất đồng bộ |
| `alt/else` | Nhánh loại trừ nhau |
| `opt` | Hành vi chỉ xảy ra khi điều kiện đúng |
| `RabbitMQ` | Giao tiếp at-least-once; consumer phải idempotent |
| `DB + Outbox` | Business state và outbox được ghi trong cùng local transaction |
| `Inbox` | Consumer dedupe message trước khi tạo side effect |

Các nhãn message dùng tên nghiệp vụ để sơ đồ dễ đọc; endpoint và payload chính thức vẫn theo [Service Communication](../02-01-system-architecture/02-01-05-service-communication.md) và [RabbitMQ Design](../02-01-system-architecture/02-01-06-message-broker.md).

## 3. Nguyên tắc đọc

- Sơ đồ bổ sung, không thay thế luồng chính/ngoại lệ trong SRS.
- Gateway xác thực sơ bộ; service sở hữu nghiệp vụ vẫn kiểm tra role, ownership và tenant scope.
- Để giảm số mũi tên lặp, response từ service về Client đôi khi được rút gọn; đường truyền thực tế vẫn đi qua Gateway.
- Database trong mỗi sơ đồ là database riêng của service, không phải shared database.
- Message có thể giao lặp hoặc sai thứ tự; outbox/inbox, version guard và idempotency bảo vệ correctness.
- Notification và Reporting không nằm trên critical path của Booking/Payment.
- `UC-ADMIN-03` dùng tên “Administration capability” vì SRS chưa khóa deployable service sở hữu Complaint; đây là điểm cần ADR trước khi triển khai.

## 4. Nguồn quyết định

- [Danh mục và đặc tả 28 Use Case](../../srs-v2/04-use-cases/README.md)
- [Microservices Architecture](../02-01-system-architecture/02-01-04-microservices-architecture.md)
- [Service Communication](../02-01-system-architecture/02-01-05-service-communication.md)
- [Message Broker — RabbitMQ](../02-01-system-architecture/02-01-06-message-broker.md)
- [Database Architecture](../02-01-system-architecture/02-01-07-database-architecture.md)
