# PostgreSQL Migration Baseline

Các file SQL là reference migration được review cùng contract trước khi tạo EF Core migration tương đương. Mỗi service chạy migration trên logical database/schema và credential riêng; không có FK/view/trigger/query chéo database.

## Layout

- `_shared/000_integration_tables.sql`: template Outbox/Inbox/Idempotency/Audit; bootstrap chạy file này **trong từng logical database của service** trước `001_initial.sql`, không chạy một lần để dùng chung.
- `<service>/001_initial.sql`: schema nghiệp vụ MVP của service.

Các migration hiện có: Identity, Transport, Booking, Payment, Notification và Reporting. Promotion, Review, SupportCase, Notification Preference và Export Job không nằm trong migration MVP vì là scope `SHOULD`/P1.

Thứ tự bootstrap cho mỗi database: `_shared/000_integration_tables.sql` → `<service>/001_initial.sql`. Khi code được scaffold, mỗi service đưa cả hai phần vào EF Core migration/history riêng; production không dùng chung migration history hoặc bảng integration giữa các service.

## Gate

- Chạy được từ database rỗng và từ baseline trước.
- Constraint/index/state allow-list khớp SRS 2.0.
- Không có cross-service FK hoặc shared write table.
- Booking concurrency test chạy trên PostgreSQL thật.
- Migration production theo expand-and-contract; không rollback phá hủy dữ liệu.
- SQL/EF model drift test so sánh schema đã migrate với model snapshot.
