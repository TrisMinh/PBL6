# 2.1.12 Architecture Decisions

## 1. Decision log

| ID | Quyết định | Trạng thái | Lý do chính |
|---|---|---|---|
| ADR-001 | Chia service theo sáu bounded context | Accepted | Ownership và vòng đời nghiệp vụ rõ; scale/deploy độc lập |
| ADR-002 | Mọi public business API đi qua API Gateway | Accepted | Một điểm kiểm soát TLS, route, rate limit và correlation |
| ADR-003 | Dùng REST cho request cần kết quả tức thời | Accepted | Semantics/error/timeout rõ; phù hợp Web/Mobile |
| ADR-004 | Dùng RabbitMQ cho integration event và async command | Accepted | Routing/fan-out/retry/DLQ phù hợp quy mô và yêu cầu hiện tại |
| ADR-005 | Database-per-service, có thể chung PostgreSQL cluster vật lý | Accepted | Giữ data ownership nhưng giảm chi phí vận hành ban đầu |
| ADR-006 | At-least-once + transactional outbox/inbox | Accepted | Tránh mất event sau commit và xử lý duplicate có chủ đích |
| ADR-007 | Không dùng distributed transaction; dùng saga choreography | Accepted | Giảm coupling/availability dependency giữa service |
| ADR-008 | Booking DB là nguồn chống double-book; Redis chỉ hỗ trợ | Accepted | Correctness không phụ thuộc cache/TTL process |
| ADR-009 | Reporting dùng projection/eventual consistency | Accepted | Query/report không gây tải và coupling lên transaction DB |
| ADR-010 | Container hóa; Docker Compose cho local | Accepted | Môi trường lặp lại được và phù hợp PBL6 |
| ADR-011 | Production topology vendor-neutral | Proposed | Chưa có yêu cầu cloud/budget/SLA đủ để khóa nhà cung cấp |
| ADR-012 | Java/Spring, React và Flutter là stack triển khai đề xuất | Proposed | Hệ sinh thái phù hợp nhưng codebase chưa khóa framework |
| ADR-013 | Transport sở hữu Organization profile; Identity sở hữu membership/role | Accepted | Tách tenant business profile khỏi identity/authorization nhưng giữ một authoritative owner cho mỗi dữ liệu |
| ADR-014 | Booking tạm sở hữu SupportCase liên quan giao dịch | Accepted | Đủ cho phạm vi hiện tại và tránh tạo service thứ bảy chưa có scale/lifecycle độc lập |

## 2. Chi tiết quyết định trọng yếu

### ADR-001 — Bounded-context Microservices

**Context:** hệ thống có identity, vận tải, inventory/booking, payment, notification và reporting với invariant/vòng đời khác nhau.

**Decision:** dùng sáu service tương ứng; Gateway không phải business service.

**Consequences:** ownership, scale và failure isolation tốt hơn; đổi lại cần contract, observability, deployment và eventual consistency. Không tách thêm service nếu chưa có động lực rõ.

### ADR-004 — RabbitMQ

**Context:** Payment/Booking cần reliable handoff; Notification/Reporting cần nằm ngoài critical path; một event có nhiều consumer.

**Decision:** dùng RabbitMQ với topic exchange cho event/command, durable queue, publisher confirm, manual ack, retry tier và DLQ.

**Consequences:** có thể fan-out, hấp thụ burst và replay có kiểm soát; đổi lại phải vận hành broker và xử lý duplicate/out-of-order. Kafka/event log không được chọn vì baseline không yêu cầu retention/replay stream lớn hoặc throughput ở quy mô đó.

### ADR-005 — Database per service

**Context:** shared database tạo coupling schema, quyền ghi không rõ và deploy khó độc lập.

**Decision:** logical DB/schema, migration và credential riêng; có thể dùng chung PostgreSQL server/cluster giai đoạn đầu.

**Consequences:** local transaction rõ và service tự chủ; đổi lại không join/FK chéo. Dữ liệu liên context phải qua API/event và projection.

### ADR-006 — Outbox và inbox

**Context:** commit DB rồi publish có thể mất message; publish rồi rollback có thể phát sự thật không tồn tại; RabbitMQ có thể redeliver.

**Decision:** producer ghi outbox cùng business transaction, consumer ghi inbox cùng side effect, xử lý at-least-once idempotent.

**Consequences:** không cần distributed transaction và không mất handoff đã commit; đổi lại có worker, bảng kỹ thuật, cleanup và lag cần theo dõi.

### ADR-007 — Saga choreography

**Context:** payment confirmation/cancellation thay đổi nhiều service và có bước provider không thể nằm trong DB transaction.

**Decision:** service phản ứng theo integration event/command và phát bước kế tiếp hoặc compensation.

**Consequences:** service ít phụ thuộc coordinator; đổi lại luồng khó quan sát hơn, cần correlation, trạng thái trung gian, timeout và reconciliation. Nếu số bước/nhánh tăng mạnh, đánh giá orchestrated saga bằng ADR mới.

### ADR-008 — PostgreSQL bảo vệ seat invariant

**Context:** Redis nhanh nhưng expiry/failover/cache loss không đủ làm nguồn sự thật cho quyền sở hữu ghế.

**Decision:** Booking transaction, row lock/state guard và constraint quyết định SeatHold/TripSeat; Redis chỉ hỗ trợ cache/expiry signal.

**Consequences:** correctness mạnh; đổi lại cần thiết kế index/transaction và load test contention. Không được chuyển invariant sang distributed lock Redis nếu chưa có ADR/bằng chứng.

### ADR-009 — Reporting projection

**Context:** báo cáo join dữ liệu nhiều context và query nặng, nhưng không cần nhất quán tức thời như booking.

**Decision:** Reporting consume event để dựng read model riêng; response công bố `dataAsOf`.

**Consequences:** query độc lập, không đọc DB chéo; đổi lại projection có lag và cần rebuild/reconciliation.

### ADR-013 — Organization profile và membership

**Context:** Organization là tenant root của vận hành, trong khi membership/role thuộc vòng đời identity. Để chung cả hai ở một service sẽ làm mờ owner hoặc buộc query/FK chéo.

**Decision:** Transport sở hữu Organization profile/status; Identity sở hữu User, Role và OrganizationMembership bằng `organizationId` external reference. Gateway route Organization CRUD đến Transport và route `/admin/organizations/{id}/members/**` cụ thể đến Identity.

**Consequences:** owner rõ và không có cross-DB FK; đổi lại Gateway cần route precedence và service phải xử lý membership projection/staleness an toàn.

### ADR-014 — SupportCase ownership

**Context:** `UC-ADMIN-03` cần state/history/assignee nhưng chưa có bounded context/service owner trong sáu service baseline.

**Decision:** Booking Service sở hữu SupportCase liên quan Booking/Ticket/Payment bằng external reference; không tạo service mới ở giai đoạn này.

**Consequences:** triển khai được UC và audit/history rõ; nếu support mở rộng thành capability độc lập, tạo ADR migration/service split thay vì chia sẻ Booking DB.

## 3. Rejected alternatives

| Phương án | Vì sao chưa chọn |
|---|---|
| Shared database cho mọi service | Mất ownership, FK/query chéo và deploy coupling |
| HTTP đồng bộ cho toàn bộ flow | Dễ cascade failure; Notification/Reporting chặn critical path |
| Exactly-once messaging | Không được RabbitMQ + DB bảo đảm end-to-end; idempotency thực tế và kiểm chứng được hơn |
| Redis distributed lock là nguồn chống double-book | Lock expiry/failover không thay được transaction và invariant DB |
| Event sourcing toàn hệ thống | Complexity cao, SRS không yêu cầu audit/replay ở mức aggregate history đầy đủ |
| Kubernetes bắt buộc cho local | Quá nặng cho vòng lặp phát triển PBL6; Compose đủ baseline local |
| Khóa cloud/payment vendor sớm | Chưa có dữ liệu budget, SLA, coverage và compliance để quyết định đúng |

## 4. Open decisions

Các mục sau cần ADR riêng trước production hoặc khi bắt đầu module liên quan:

1. Cloud/managed platform và region/data residency.
2. Payment Gateway cụ thể và reconciliation API.
3. Email/push provider và quota/delivery webhook.
4. Backend/frontend/mobile framework cuối cùng nếu khác stack đề xuất.
5. Secret store, CI/CD và observability backend.
6. PostgreSQL/RabbitMQ managed hay self-hosted.
7. Timeout, retry, prefetch và capacity threshold sau load test.
8. Retention chi tiết theo pháp lý/nhà trường/nghiệp vụ.

## 5. Mẫu ADR cho thay đổi tiếp theo

```markdown
# ADR-NNN — Tên quyết định

- Status: Proposed | Accepted | Superseded
- Date: YYYY-MM-DD
- Owners: ...

## Context
Vấn đề, constraint và bằng chứng.

## Decision
Quyết định cụ thể và phạm vi.

## Alternatives
Các phương án đã cân nhắc.

## Consequences
Lợi ích, chi phí, rủi ro và việc phải làm.

## Verification
Test/metric/runbook chứng minh quyết định hoạt động.
```

ADR không được sửa lịch sử sau khi `Accepted`; quyết định mới sẽ `Supersede` quyết định cũ và liên kết hai chiều.
