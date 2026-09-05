# 3.3.7 Reporting Database

Logical DB/schema: `reporting_db`; ERD: [Reporting](../../system-design/02-07-database-erd/06-reporting-db.md). Projection rebuild được, không phải nguồn transaction.

## Projection keys

| Table | Grain/unique key | Event nguồn |
|---|---|---|
| `booking_projections` | `booking_id` | BookingCreated/Paid/Cancelled |
| `revenue_projections` | `(organization,period_date,currency)` | BookingPaid, RefundSucceeded |
| `occupancy_projections` | `trip_id` | TripPublished, SeatHold, Booking, CheckIn |
| `export_jobs` | `id` | API command |
| `export_download_audits` | `id` | download action |
| `projection_checkpoints` | `projection_name` | projector progress |

## Idempotent projector

- Inbox message unique trước update.
- Aggregate projection chỉ apply event version mới hơn đúng expected rule; old version ACK no-op.
- Gap không được “nhảy qua” âm thầm: retry, park hoặc reconcile owner API.
- Revenue delta dùng event ID ledger/inbox để không cộng hai lần.
- `data_as_of` lấy event business/processing watermark đã định nghĩa, không giả realtime.

## Index baseline

- Revenue `(organization_id_external,period_date,currency)`.
- Booking `(organization_id_external,booked_at desc,status)` và transaction lookup.
- Occupancy `(organization_id_external,departure_at,status)` nếu departure denormalized.
- Export `(requested_by_external,created_at desc)` và partial `(status,created_at)` cho worker.
- Deep pagination dùng keyset/cursor; report query giới hạn date range.

Export job lưu `object_key`, không lưu CSV blob trong DB/RabbitMQ. Download signed URL ngắn hạn và audit. Rebuild projection vào shadow table/schema, validate count/checksum rồi switch atomically khi khả thi.

