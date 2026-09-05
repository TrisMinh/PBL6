# 3.3.8 Migration, Retention, Backup và Restore

## Migration ownership

- Mỗi service có migration directory/history/table riêng và credential chỉ trên DB/schema của mình.
- CI chạy migration từ empty DB và từ phiên bản production-like gần nhất.
- Application startup không tự chạy destructive migration ở production nếu chưa có orchestration/approval.

## Expand-and-contract

1. **Expand:** thêm nullable column/table/index concurrent hoặc contract mới tương thích.
2. Deploy code đọc cũ/ghi dual hoặc fallback phù hợp.
3. Backfill theo batch có checkpoint, throttling và metric.
4. Chuyển read path; xác nhận dữ liệu/checksum.
5. **Contract:** bỏ old column/contract ở release sau khi rollback window kết thúc.

Không rename/drop column và deploy code phụ thuộc trong cùng release. Index lớn dùng `CREATE INDEX CONCURRENTLY` ngoài transaction migration thích hợp.

## Retention jobs

| Data | Baseline/control |
|---|---|
| Audit/security | 12 tháng hoặc policy phê duyệt; append-only/access restricted |
| Application log | 30 ngày online, tối đa 90 ngày archive nếu cần |
| Idempotency | ≥24 giờ; Payment/Refund theo reconciliation lifecycle |
| Webhook receipt | 12 tháng hoặc provider/reconciliation policy |
| Expired SeatHold | 30 ngày hỗ trợ/debug rồi archive/delete theo policy |
| Booking/Payment/Ticket/Refund | Không tự xóa trước business/legal policy |
| Export file | Short expiry + automatic object deletion |

Cleanup chạy chunked, có dry-run/count/metric và không dùng broad unbounded delete trong giờ tải cao.

## Backup/restore

- Daily backup + WAL/PITR theo hạ tầng; mục tiêu RPO ≤15 phút, RTO ≤4 giờ.
- Backup mã hóa, access restricted; không dùng production dump thô cho dev/test.
- Restore rehearsal ít nhất mỗi học kỳ hoặc major release.
- Evidence: backup ID/time, restore start/end, target point, schema version, row/checksum validation, RPO/RTO result và người phê duyệt.
- RabbitMQ backup không thay transaction DB/Outbox; sau restore phải reconcile Outbox, queue và external provider trước mở traffic mutation.

