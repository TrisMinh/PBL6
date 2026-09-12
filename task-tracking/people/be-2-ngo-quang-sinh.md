# Ngô Quang Sinh — Roadmap `BE-2`

## 1. Vai trò

- Primary: local infrastructure, PostgreSQL/RabbitMQ, contract gates, Booking, Payment, Ticket, Refund và Notification.
- Backup/reviewer: .NET architecture, authorization/tenant và Transport do Hoàng Minh Trí sở hữu.
- File ownership ban đầu: `workspace/src/infra/`, messaging/integration adapters, `workspace/src/services/booking/`, `payment/`, `notification/`, `reporting/` projection.
- Không thay đổi root .NET build policy hoặc public auth/transport contract mà chưa có Trí review.

## 2. Bắt đầu ngay — Sprint 0

Card đầu tiên: `S0-BE2-01` — 2 PD — `READY`. Card song song nhỏ sau khi WIP trống: `S0-BE2-04`.

1. Khởi động Docker Desktop; xác nhận `docker version` có phần Server.
2. Tạo branch `feature/s0-be2-01-local-compose` từ nhánh tích hợp.
3. Viết Compose cho PostgreSQL, RabbitMQ, Redis, Mailpit, payment simulator; thêm healthcheck.
4. Chạy `docker compose config` và smoke healthy; không commit secret/volume.
5. Mở PR, gắn Hoàng Minh Trí review; bàn giao lệnh start/stop/reset an toàn.
6. Sau merge làm `S0-BE2-04`, rồi `S0-BE2-02`; `S0-BE2-03` chờ primitives của Trí.

Checklist kỹ thuật đầy đủ: [Sprint 0 — Ngô Quang Sinh](../board/sprint-00-foundation.md#4-ngô-quang-sinh-be-2-checklist).

## 3. Roadmap theo sprint

| Sprint | Thời gian | P0 cards / PD | P1 stretch / PD | Kết quả phải bàn giao | Phụ thuộc chính |
|---|---|---|---|---|---|
| `S0` | 14/09–27/09/2026 | `S0-BE2-01..04` / 6.5 | — | Local stack, DB smoke, messaging smoke, contract gate | Docker engine; primitives từ Trí |
| `S1` | 28/09–11/10/2026 | `S1-BE2-02..05` / 9 | `S1-BE2-01` / 2 | Register/reset/profile, notification outbox và security fixtures | Identity schema/RBAC từ Trí |
| `S2` | 12/10–25/10/2026 | `S2-BE2-01,02,04,05` / 10 | `S2-BE2-03` / 2 | Driver/Route/Search và Trip inventory convergence | Trip publish từ Trí |
| `S3` | 26/10–08/11/2026 | `S3-BE2-01..03` / 8 | — | Atomic SeatHold, Booking/server price và idempotency | Inventory ready S2 |
| `S4` | 09/11–22/11/2026 | `S4-BE2-01..03` / 9 | — | Payment intent/webhook/saga/Ticket convergence | Booking S3; simulator S0 |
| `S5` | 23/11–06/12/2026 | `S5-BE2-01..03` / 8 | — | Cancellation, Refund, Notification delivery | Payment/Ticket S4 |
| `S6` | 07/12–20/12/2026 | `S6-BE2-01..02` / 4 | — | Trip cancellation event integration và reliability tests | Operations flow từ Trí |
| `S7` | 21/12/2026–03/01/2027 | `S7-BE2-01..02` / 6 | — | Reporting projection, dedupe/rebuild/lag evidence | Events S2..S6 |
| `S8` | 04/01–17/01/2027 | `S8-BE2-01` / 3 | — | Recovery, retry/DLQ, reconciliation và backup/restore evidence | Full integration stack |

`S1/S2/S4` có 9–10 PD P0: không nhận TEAM task trong các sprint này; báo rebalance ngay nếu card trễ hơn 1 ngày.

## 4. Exit checklist theo giai đoạn

### Foundation → Booking infrastructure

- [ ] Compose healthy và migration từ empty lặp lại được.
- [ ] Event validate schema, Inbox dedupe, Outbox retry, ACK sau commit.
- [ ] Contract gate fail với fixture sai và pass với baseline đúng.
- [ ] Sỹ/Đạt sinh được client từ cùng OpenAPI.

### Booking → Payment

- [ ] Multi-seat hold all-or-nothing và không double-book.
- [ ] Booking chỉ dùng giá server; idempotency same/different payload đúng.
- [ ] Expiry/release retry-safe và không gia hạn hold.
- [ ] Web/Mobile có fixture cho conflict, expired và retry.

### Payment → Cancellation

- [ ] Webhook xác minh raw payload/signature/amount/currency.
- [ ] Duplicate 100 lần vẫn một logical success/Ticket set.
- [ ] Client thấy `CONFIRMING` trong lúc hội tụ.
- [ ] Late success có Refund/manual compensation, không double-book.

### Notification/Reporting → Acceptance

- [ ] Provider fail không rollback giao dịch.
- [ ] Retry/DLQ/replay có audit và không duplicate effect.
- [ ] Projection rebuild/dedupe cho kết quả đúng và có `dataAsOf`.
- [ ] Broker-down, crash-after-commit, backup/restore có evidence.

## 5. Handoff bắt buộc

| Bàn giao cho | Khi nào | Artifact |
|---|---|---|
| Hoàng Minh Trí | Mỗi event/migration/saga đạt review | Schema, routing, transaction boundary, retry/compensation test |
| Đinh Công Trung Sỹ | Booking/Payment/Refund route sẵn sàng | OpenAPI diff, simulator cases, convergence/error matrix |
| Ngô Thành Đạt | Booking/payment/Ticket/cancel sẵn sàng | Deep-link callback cases, fixture và app-resume behavior |

## 6. Checklist cho mọi card backend integration

- [ ] Transaction boundary, idempotency key và duplicate behavior rõ.
- [ ] Inbox/Outbox/retry/DLQ áp dụng đúng nơi, không publish trước commit.
- [ ] Migration từ empty và upgrade test pass.
- [ ] Provider timeout/signature/wrong amount/failure có test nếu liên quan.
- [ ] Contract/event compatibility gate pass.
- [ ] Metric/log/correlation và manual recovery state đủ.
- [ ] PR có evidence và Hoàng Minh Trí review.
- [ ] Chuyển Kanban/ghi progress log sau merge.
