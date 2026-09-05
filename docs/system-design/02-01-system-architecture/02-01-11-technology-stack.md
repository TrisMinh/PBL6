# 2.1.11 Technology Stack

## 1. Nguyên tắc

Stack dưới đây là baseline để nhóm bắt đầu thiết kế/triển khai. Thành phần đã được SRS hoặc yêu cầu hiện tại khóa được đánh dấu `Accepted`; framework chưa được codebase chứng minh được đánh dấu `Proposed` và có thể đổi bằng ADR.

Không khóa minor/patch version trong tài liệu kiến trúc. Version deploy thực tế phải pin trong manifest, còn runtime/framework chọn dòng còn được hỗ trợ và cập nhật bảo mật.

## 2. Application stack

| Layer | Baseline | Trạng thái | Lý do |
|---|---|---|---|
| Customer Web | React + TypeScript | Proposed | Component ecosystem, typed client, responsive Web |
| Back-office Web | React + TypeScript | Proposed | Chia sẻ design system/tooling với Customer Web, không chia business state |
| Mobile | Flutter/Dart | Proposed | Một codebase mobile, QR/push integration tốt |
| Backend services | Java LTS + Spring Boot | Proposed | Transaction, security, AMQP, validation và observability ecosystem mạnh |
| API Gateway | Spring Cloud Gateway hoặc gateway tương đương | Proposed | Routing, auth filter, rate limit và correlation; chọn cùng runtime giúp vận hành đơn giản |
| API style | REST/JSON + OpenAPI | Accepted | Phù hợp request/response và đã được SRS yêu cầu |
| Event schema | JSON Schema, quản lý theo AsyncAPI-compatible catalog | Proposed | Contract review, versioning và CI compatibility check |

React/Flutter/Java không phải ràng buộc nghiệp vụ. Nếu repository implementation chọn stack khác, cập nhật ADR trước rồi đồng bộ file này.

## 3. Data và messaging

| Capability | Baseline | Trạng thái | Vai trò |
|---|---|---|---|
| Transaction database | PostgreSQL | Accepted | ACID source of truth, constraint, row lock, PITR |
| Message broker | RabbitMQ | Accepted | Topic routing, durable queue, quorum, retry và DLQ |
| Cache/TTL helper | Redis | Accepted (auxiliary) | Cache, rate-limit/TTL helper; không là source of truth |
| File/export | S3-compatible Object Storage | Proposed | Private export artifact và signed URL |
| Migration | Flyway/Liquibase hoặc tool tương đương | Proposed | Migration có version theo service |

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
| Instrumentation | OpenTelemetry | Proposed |
| Metrics | Prometheus-compatible metrics | Proposed |
| Dashboard | Grafana-compatible dashboard | Proposed |
| Logs | Structured JSON + centralized log backend | Accepted về contract, backend Proposed |
| Traces | OpenTelemetry-compatible trace backend | Proposed |
| Alerting | Metrics/log-based alert manager | Proposed |

Telemetry contract quan trọng hơn vendor: UTC timestamp, service, environment, correlation ID, trace ID, event/action và safe error code.

## 6. Security tooling

| Concern | Baseline |
|---|---|
| Authentication | Short-lived signed access token + rotating refresh token |
| Authorization | Spring Security/policy middleware tương đương + RBAC + tenant/resource checks |
| Password hashing | Argon2id hoặc bcrypt được benchmark |
| Transport | TLS; mTLS/workload identity khi hạ tầng production hỗ trợ |
| Supply chain | SAST, dependency/container/secret scan trong CI |

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
- Minor/patch upgrade qua automated test; major upgrade có ADR/compatibility plan nếu ảnh hưởng contract hoặc vận hành.
- Container base image tối giản, chạy non-root và rebuild định kỳ để nhận security patch.
- RabbitMQ/PostgreSQL upgrade phải kiểm tra data format, plugin/policy, client compatibility và rollback/restore plan.
