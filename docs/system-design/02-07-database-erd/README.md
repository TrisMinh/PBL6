# 2.7 Database ERD

Thiết kế dùng PostgreSQL theo mô hình database-per-service ở mức logic. Mỗi ERD chỉ chứa foreign key trong database của đúng owner; trường có hậu tố `_external` hoặc được ghi chú external reference tuyệt đối không có FK sang database khác.

## Danh mục

| Logical database | ERD | Owner |
|---|---|---|
| `identity_db` | [Identity ERD](./01-identity-db.md) | Identity Service |
| `transport_db` | [Transport ERD](./02-transport-db.md) | Transport Service |
| `booking_db` | [Booking ERD](./03-booking-db.md) | Booking Service |
| `payment_db` | [Payment ERD](./04-payment-db.md) | Payment Service |
| `notification_db` | [Notification ERD](./05-notification-db.md) | Notification Service |
| `reporting_db` | [Reporting ERD](./06-reporting-db.md) | Reporting Service |
| Mỗi database cần tích hợp message/audit | [Inbox, Outbox, Idempotency và Audit](./07-inbox-outbox-idempotency.md) | Từng service |

## Quy ước

- `PK`, `FK`, `UK` trên hình thể hiện vai trò chính; composite/partial/check constraint đầy đủ được ghi dưới từng ERD.
- Tiền dùng `numeric` cùng `currency char(3)`; thời gian dùng `timestamptz` và lưu UTC.
- Transaction entity không hard delete; record tham chiếu dùng `status`, `deleted_at` hoặc deactivation phù hợp.
- Tên vật lý dùng `snake_case`; tên trên Mermaid viết hoa để dễ đọc.
- Đây là logical physical design baseline; migration thực tế phải dùng expand-and-contract.
