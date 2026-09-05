# 2.1.3 Components

## 1. Client và edge components

| Component | Trách nhiệm | Không chịu trách nhiệm |
|---|---|---|
| Customer Web | Search, seat selection, booking/payment UX, ticket và profile | Quyết định seat availability hoặc payment success |
| Mobile App | Customer flow, ticket/QR, push token và mobile session UX | Lưu business state làm nguồn sự thật |
| Back-office Web | Operator, Driver và Admin workflow theo role/tenant | Bỏ qua authorization phía backend |
| WAF/Reverse Proxy | TLS, request size limit, basic attack filtering, routing tới Gateway | Business authorization |
| API Gateway | Route, CORS, rate limit, token validation sơ bộ, correlation ID, access log | Business rule, transaction hoặc truy cập database |

## 2. Business components

| Component | Năng lực chính | State sở hữu |
|---|---|---|
| Identity Service | Đăng ký, đăng nhập, token, user, role, organization membership | User, credential, role, membership, refresh token, security audit |
| Transport Service | Nhà xe, xe/ghế vật lý, tài xế, tuyến, điểm dừng, chuyến và assignment | Organization, Bus, Seat, DriverProfile, Route, Stop, Trip, Assignment |
| Booking Service | Trip snapshot, TripSeat, SeatHold, pricing snapshot, booking, passenger, ticket, promotion, review và support case | Toàn bộ inventory theo chuyến, booking aggregate và support case liên quan giao dịch |
| Payment Service | Payment intent/attempt, webhook receipt, refund và reconciliation | Payment, PaymentAttempt, WebhookReceipt, Refund, ReconciliationCase |
| Notification Service | Template, preference, notification và delivery attempt | Notification, Template, Preference, DeliveryAttempt |
| Reporting Service | Revenue/booking/occupancy projection và export job | Read model, export metadata; không sở hữu transaction gốc |

## 3. Platform components

| Component | Vai trò | Quy tắc |
|---|---|---|
| RabbitMQ | Integration event, asynchronous command, retry và DLQ | Durable topology; publisher confirm; manual ack; least-privilege vhost user |
| PostgreSQL | Transactional source of truth | Logical DB/schema và role riêng cho từng service; không query chéo |
| Redis | Cache, rate-limit helper, SeatHold expiry helper | Dữ liệu có thể mất/rebuild; không quyết định invariant ghế |
| Object Storage | File export và backup artifact phù hợp | Private bucket/container; signed URL có hạn; audit download chứa PII |
| Observability | Log, metric, trace và alert | Redact secret/PII; correlation xuyên HTTP và AMQP |
| Secret Store | Phân phối credential/key theo workload | Không commit secret; rotate và audit truy cập |
| CI/CD | Build, test, scan, migrate và deploy | Một artifact/container image bất biến qua môi trường |

## 4. Component nội bộ chuẩn của một service

```text
Inbound adapters
├── REST controller / AMQP consumer / scheduled job
Application layer
├── command/query handler
├── use-case orchestration
└── transaction boundary
Domain layer
├── aggregate / entity / value object
├── domain service
└── invariant / policy
Outbound ports
├── repository
├── external API client
├── outbox writer
└── cache adapter
Infrastructure adapters
├── PostgreSQL
├── RabbitMQ
├── Redis
└── provider SDK/HTTP
```

Dependency đi từ adapter vào application/domain thông qua interface. Domain không phụ thuộc trực tiếp HTTP, AMQP, ORM hoặc provider SDK.

## 5. Cross-cutting libraries

Nhóm có thể dùng shared library cho các concern thuần kỹ thuật sau:

- Event envelope và trace/correlation propagation.
- Error envelope, validation convention và auth middleware.
- Logging/metrics bootstrap.
- Outbox/inbox primitives và test utilities.

Shared library **không** được chứa entity, rule hoặc DTO nghiệp vụ dùng chung giữa service. Contract được chia sẻ qua OpenAPI/event schema có version thay vì import source code của service khác.

## 6. Ownership rule

Một component có đúng một owner chịu trách nhiệm contract, migration, SLO và vận hành. Consumer không được yêu cầu producer mở database; nếu thiếu dữ liệu, hai bên bổ sung API hoặc event contract có version.
