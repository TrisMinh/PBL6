# 3.3 Physical Database Design

PostgreSQL logical database/schema per service; mỗi service có login role và migration history riêng. ERD tổng quan ở [2.7 Database ERD](../../system-design/02-07-database-erd/README.md); chương này khóa type, constraint, index, transaction pattern và lifecycle vật lý.

## Danh mục

- [3.3.1 PostgreSQL conventions và integration tables](./01-postgresql-conventions.md)
- [3.3.2 Identity database](./02-identity-database.md)
- [3.3.3 Transport database](./03-transport-database.md)
- [3.3.4 Booking database](./04-booking-database.md)
- [3.3.5 Payment database](./05-payment-database.md)
- [3.3.6 Notification database](./06-notification-database.md)
- [3.3.7 Reporting database](./07-reporting-database.md)
- [3.3.8 Migration, retention, backup và restore](./08-migration-retention-backup.md)

## Ownership

Không có cross-database FK, view, trigger, ORM relation hoặc transaction. ID ngoài service dùng hậu tố `_external` hoặc được ghi rõ external reference. Snapshot/projection phải có source version và `updated_at/data_as_of`.

