# 2.1.7 Database Architecture

## 1. Mô hình sở hữu

Hệ thống áp dụng database-per-service ở mức logic. Giai đoạn local/demo có thể dùng một PostgreSQL server, nhưng mỗi service có database/schema, migration history và login role riêng. Chia sẻ cùng server vật lý không cho phép query hoặc transaction chéo.

| Logical store | Owner | Dữ liệu chính | Đặc tính |
|---|---|---|---|
| `identity_db` | Identity | User, Role, Membership, RefreshToken, SecurityAudit | Bảo mật cao, lookup theo identity/tenant |
| `transport_db` | Transport | Organization, Bus, Seat, Driver, Route, Stop, Trip | Nhiều read/search, operator write |
| `booking_db` | Booking | TripSnapshot, TripSeat, SeatHold, Booking, Passenger, Ticket, Promotion, Review, SupportCase | Transaction contention và invariant ghế |
| `payment_db` | Payment | Payment, Attempt, WebhookReceipt, Refund, ReconciliationCase | Idempotency/audit cao, provider references |
| `notification_db` | Notification | Template, Preference, Notification, DeliveryAttempt | Retry lifecycle và retention riêng |
| `reporting_db` | Reporting | Revenue, Booking, Occupancy projection, ExportJob | Read-optimized, rebuild được từ nguồn/event |

## 2. Quy tắc dữ liệu xuyên service

- Chỉ lưu ID của aggregate ngoài context dưới dạng external reference, không foreign key xuyên DB.
- Dữ liệu cần đọc thường xuyên được sao chép thành snapshot/projection qua integration event.
- Snapshot ghi rõ `sourceVersion` và `updatedAt` để phát hiện stale/gap.
- Dữ liệu authoritative chỉ sửa qua API/command của owner.
- Reporting không được dùng quyền DB của service khác; rebuild bằng event/reconciliation API có kiểm soát.

## 3. Transaction và concurrency

### 3.1 SeatHold

Booking Service là concurrency boundary:

1. Bắt đầu transaction.
2. Lock các `trip_seats` theo thứ tự ổn định để giảm deadlock.
3. Xác minh tất cả ghế `AVAILABLE`, trip sellable và hold cũ đã hết hạn nếu có.
4. Insert SeatHold/items, price snapshot; cập nhật TripSeat thành `HELD`.
5. Insert outbox nếu có event, rồi commit.

Unique constraint/index bảo đảm định danh ghế theo chuyến; state transition và row lock bảo đảm chỉ một active owner. Redis TTL chỉ giúp đánh thức expiry worker, không thay transaction này.

### 3.2 Payment webhook

- `provider + externalEventId` và `provider + providerTransactionId` có unique constraint phù hợp.
- Duplicate webhook trả 2xx sau khi xác nhận kết quả đã persist, không phát event lần hai.
- Payment state và outbox event được commit cùng transaction.

### 3.3 Inbox/outbox

Mỗi service publish/consume message quan trọng có bảng tối thiểu:

```text
outbox_messages
  id, message_type, version, aggregate_id, payload,
  occurred_at, correlation_id, published_at, attempt_count

inbox_messages
  consumer_name, message_id, received_at, processed_at
  UNIQUE (consumer_name, message_id)
```

Payload outbox có retention và access control như business data tương ứng; không dùng outbox như event store vĩnh viễn.

## 4. Redis architecture

Redis dùng cho:

- Cache dữ liệu đọc có TTL và cache key có namespace/version.
- Rate-limit counter hoặc distributed helper phù hợp.
- SeatHold expiry signal/helper để giảm polling database.

Redis không dùng làm nguồn sự thật của TripSeat, Booking, Payment hoặc authorization. Cache miss/failure phải degrade về PostgreSQL trong giới hạn tải; invalidation dùng event hoặc TTL, chấp nhận eventual consistency cho dữ liệu không critical.

## 5. Indexing và query

- Index được quyết định từ query pattern và `EXPLAIN`, không tạo theo mọi column.
- Booking ưu tiên lookup theo `trip_id + state`, hold token, customer + created time và ticket code.
- Payment ưu tiên booking ID, provider transaction/event ID, state + updated time.
- Transport search có composite/geospatial strategy theo tiêu chí thực tế; khi quy mô vượt PostgreSQL baseline mới đánh giá search engine riêng bằng ADR.
- Pagination lớn dùng cursor/keyset thay offset sâu.

## 6. Migration

- Mỗi service tự chạy/version migration; migration phải tương thích rolling deployment.
- Dùng expand-and-contract: thêm schema → deploy code đọc/ghi tương thích → backfill → xóa sau.
- Không đổi tên/xóa column và deploy code phụ thuộc trong cùng một bước phá vỡ rollback.
- Migration destructive có backup/restore plan và approval.
- Seed data tách rõ reference data với test fixture.

## 7. Backup, recovery và retention

- Backup hằng ngày và point-in-time/WAL theo hạ tầng; mục tiêu RPO ≤ 15 phút, RTO ≤ 4 giờ.
- Restore test ít nhất mỗi học kỳ hoặc release lớn; ghi lại thời gian và checksum/integrity check.
- Retention theo SRS; legal/business retention của payment/audit không được rút ngắn bởi cleanup kỹ thuật.
- Backup được mã hóa, access-restricted và không dùng production dump thô ở local/test.

## 8. Data protection

- Mã hóa at rest theo capability hạ tầng và mã hóa cấp ứng dụng cho trường đặc biệt nhạy cảm khi cần.
- Mask CCCD/giấy phép, contact và provider reference trong UI/log.
- Không lưu CVV hoặc full card number; dùng token/reference của payment provider.
- Export PII có authorization, expiry, watermark/metadata và audit download.
- Quy trình xóa/anonymize phải tôn trọng quan hệ nghiệp vụ và retention bắt buộc.

## 9. Reporting consistency

Reporting projection có thể trễ. API report trả `generatedAt`/`dataAsOf` để người dùng biết độ mới. Reconciliation job so sánh projection với aggregate owner theo batch, không query join trực tiếp giữa các database production.
