# 3.3.6 Notification Database

Logical DB/schema: `notification_db`; ERD: [Notification](../../system-design/02-07-database-erd/05-notification-db.md).

## Tables

| Table | Unique/check | Query/worker |
|---|---|---|
| `templates` | `(code,channel,locale,version)`; one active by policy | active code/channel/locale |
| `notifications` | source message/reference dedupe when applicable | user cursor inbox |
| `delivery_attempts` | `(notification_id,channel,attempt_no)` | status/next attempt |

## Index và channel policy

```sql
create index ix_notifications_user_cursor
  on notifications (user_id_external, created_at desc, id desc);

create index ix_delivery_ready
  on delivery_attempts (next_attempt_at, id)
  where status in ('PENDING','RETRYING');
```

Transaction consumer: Inbox + Notification + initial DeliveryAttempt commit, rồi ACK. Provider call xảy ra ngoài transaction. Outcome update attempt; transient failure đặt `RETRYING/next_attempt_at`, permanent/exhausted đặt `FAILED` và metric/alert.

MVP chỉ bật `IN_APP` và `EMAIL`; essential notification type được cấu hình allow-list có version. Template render chỉ nhận safe data schema theo notification type; unknown placeholder làm delivery fail permanent thay vì gửi nội dung sai.

`user_preferences` và push/SMS thuộc P1. Chỉ tạo bảng/route preference bằng migration mới khi requirement `FR-NOTIF-003` được đưa vào release; lúc đó preference không được disable mọi required channel ngoài policy.

Retention tách in-app notification, attempt metadata và provider reference; cleanup không xóa record đang retry/điều tra.
