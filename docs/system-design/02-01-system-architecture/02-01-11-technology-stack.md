# 2.1.11 Technology Stack

## 1. Nguyên tắc

Stack dưới đây là baseline đã được chốt cho MVP 2.0. Thay đổi framework hoặc runtime phải có ADR supersede trước khi thay code/contract.

Baseline backend được cập nhật ngày 2026-09-10: mọi project target `.NET 8 / net8.0`; web dùng React `19.2`; mobile dùng React Native `0.87`; toolchain client dùng Node.js `24` LTS và npm workspaces. SDK build được pin riêng trong `workspace/global.json`; dùng SDK mới hơn không được tự đổi Target Framework. Patch version thực tế phải pin trong manifest/lockfile và cập nhật bảo mật trong dòng nhóm đang duy trì.

## 2. Application stack

| Layer | Baseline | Trạng thái | Lý do |
|---|---|---|---|
| Customer Web | React 19.2 + TypeScript | Accepted | Typed OpenAPI client, responsive Web và hệ sinh thái kiểm thử UI |
| Back-office Web | React 19.2 + TypeScript | Accepted | Chia sẻ design tokens/component package thuần UI với Customer Web, không chia business state |
| Mobile | React Native 0.87 + TypeScript | Accepted | Giữ một ngôn ngữ client, tái sử dụng contract/type và hỗ trợ QR/deep link |
| Backend services | C# target .NET 8 (`net8.0`) + ASP.NET Core | Accepted | Tương thích toolchain hiện tại; transaction, authentication/authorization, OpenAPI, Worker Service và observability tích hợp tốt |
| API Gateway | ASP.NET Core + YARP | Accepted | Route precedence, auth filter, rate limit và correlation trong cùng hệ sinh thái .NET |
| API style | REST/JSON + OpenAPI | Accepted | Phù hợp request/response và đã được SRS yêu cầu |
| Event schema | JSON Schema + AsyncAPI catalog | Accepted | Contract review, versioning và CI compatibility check |

Framework không phải ràng buộc nghiệp vụ. Nếu implementation chọn stack khác, phải tạo ADR supersede trước rồi đồng bộ file này và contract/tooling liên quan.

## 3. Data và messaging

| Capability | Baseline | Trạng thái | Vai trò |
|---|---|---|---|
| Transaction database | PostgreSQL | Accepted | ACID source of truth, constraint, row lock, PITR |
| Message broker | RabbitMQ | Accepted | Topic routing, durable queue, quorum, retry và DLQ |
| Cache/TTL helper | Redis | Accepted (auxiliary) | Cache, rate-limit/TTL helper; không là source of truth |
| File/export | S3-compatible Object Storage | Proposed | Chỉ cần khi triển khai Export `SHOULD`; không thuộc MVP 2.0 |
| Migration | EF Core Migrations + SQL migration bundle/script kiểm soát | Accepted | Migration có version theo service, kiểm tra từ empty DB và phiên bản trước |

## 4. Platform và delivery

| Capability | Baseline | Trạng thái |
|---|---|---|
| Container | Docker/OCI image | Accepted |
| Local orchestration | Docker Compose | Accepted |
| Production orchestration | Kubernetes hoặc managed container platform | Proposed |
| Ingress/WAF | Vendor-neutral reverse proxy/load balancer/WAF | Proposed |
| CI/CD | Pipeline của Git hosting được nhóm chọn | Proposed |
| Secret management | Managed secret store hoặc Vault-compatible solution | Proposed |
| Infrastructure as Code | Terraform/OpenTofu hoặc platform-native equivalent | Proposed |

Production platform chưa khóa cloud vendor. Manifest phải tách config môi trường và không nhúng credential.

## 5. Observability

| Concern | Baseline | Trạng thái |
|---|---|---|
| Instrumentation | OpenTelemetry SDK cho ASP.NET Core/HttpClient/Npgsql và W3C trace context qua HTTP/AMQP | Accepted |
| Metrics | Prometheus exposition; local Prometheus | Accepted |
| Dashboard | Local Grafana; production backend có thể thay thế | Accepted local, backend production Proposed |
| Logs | Structured JSON, OpenTelemetry/Loki local, redaction middleware | Accepted local, backend production Proposed |
| Traces | OTLP qua OpenTelemetry Collector, Tempo local | Accepted local, backend production Proposed |
| Alerting | Prometheus rule + Alertmanager local; notification target production chưa khóa | Accepted local, target production Proposed |

Telemetry contract quan trọng hơn vendor: UTC timestamp, service, environment, correlation ID, trace ID, event/action và safe error code.

## 6. Security tooling

| Concern | Baseline |
|---|---|
| Authentication | Short-lived signed access token + rotating refresh token |
| Authorization | ASP.NET Core policy authorization + RBAC + tenant/resource handler |
| Password hashing | Argon2id qua adapter `Konscious.Security.Cryptography.Argon2`; PHC-format string, per-password salt, versioned parameters |
| Transport | TLS; mTLS/workload identity khi hạ tầng production hỗ trợ |
| Supply chain | SAST, dependency/container/secret scan trong CI |

## 6.1. Baseline thư viện và công cụ .NET/React

Minor baseline nêu ở đầu tài liệu; manifest/lockfile của code phải pin patch version chính xác. Không dùng RC/nightly cho MVP.

| Concern | Baseline |
|---|---|
| Backend API | ASP.NET Core Minimal API hoặc Controller theo service; ưu tiên Controller cho contract nghiệp vụ lớn |
| Persistence | EF Core + Npgsql; SQL constraint/index vẫn là nguồn bảo vệ invariant cuối |
| Messaging | RabbitMQ.Client qua adapter nội bộ; Outbox/Inbox do service sở hữu |
| Validation | FluentValidation hoặc validation pipeline tương đương, error code theo contract |
| Authentication | ASP.NET Core Authentication/JWT Bearer; refresh session do Identity Service sở hữu |
| Password hashing | Argon2id adapter; baseline `m=19456 KiB`, `t=2`, `p=1`, salt 16 byte, hash 32 byte; benchmark/rehash policy |
| Authorization | Policy-based authorization + resource/tenant handler trong từng service |
| Tests | xUnit, assertion library, Testcontainers for .NET, provider simulator |
| Web build | React 19.2 + TypeScript + Vite; Node.js 24 LTS, npm workspaces và một `package-lock.json` ở root |
| Web data | Generated OpenAPI client + query/cache library; server state không đưa vào global store tùy tiện |
| Web tests | Vitest, React Testing Library, Playwright cho E2E |
| Mobile | React Native 0.87 stable + TypeScript; secure storage, deep-link/QR adapter tách biệt |
| Load | k6 hoặc công cụ tương đương chạy được trong CI/release test |

## 7. Testing stack capabilities

Công cụ cụ thể theo ngôn ngữ, nhưng pipeline phải có:

- Unit/domain test cho invariant và state transition.
- API/message contract test.
- Integration test với PostgreSQL, RabbitMQ và Redis thật qua ephemeral container.
- Concurrency test cho SeatHold và duplicate webhook/event.
- E2E test cho booking–payment–ticket và cancellation–refund.
- Load test đối chiếu `NFR-PERF-*`; chaos/failure test tối thiểu cho broker/provider timeout.
- Migration test và security scan trước release.

## 8. Version và upgrade policy

- Pin exact version trong build/deployment manifest và commit lockfile.
- Ưu tiên runtime LTS và release line còn security support.
- Toàn bộ backend giữ `net8.0`; không trộn `net8.0`, `net9.0` hoặc `net10.0` giữa các service. Trước khi triển khai production phải đánh giá lại support lifecycle và có ADR nâng cấp nếu cần.
- Minor/patch upgrade qua automated test; major upgrade có ADR/compatibility plan nếu ảnh hưởng contract hoặc vận hành.
- Container base image tối giản, chạy non-root và rebuild định kỳ để nhận security patch.
- RabbitMQ/PostgreSQL upgrade phải kiểm tra data format, plugin/policy, client compatibility và rollback/restore plan.
