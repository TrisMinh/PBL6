# 3. Detailed Design

Chương này chuyển System Design thành contract và quy tắc triển khai có thể kiểm thử. SRS quyết định hành vi nghiệp vụ; System Design quyết định boundary; Detailed Design quyết định endpoint, message schema, constraint vật lý, authorization enforcement và test evidence.

## Nội dung

- [3.1 API Design](./03-01-api-design/README.md)
- [3.2 Event Contract](./03-02-event-contracts/README.md)
- [3.3 Physical Database Design](./03-03-physical-database-design/README.md)
- [3.4 Security & Authorization Design](./03-04-security-authorization-design/README.md)
- [3.5 Error, Concurrency & Recovery](./03-05-error-concurrency-recovery/README.md)
- [3.6 Test Design](./03-06-test-design/README.md)

## Baseline và trạng thái

| Nội dung | Baseline |
|---|---|
| API | REST/JSON, `/api/v1`, OpenAPI-compatible |
| Message | RabbitMQ, JSON Schema/AsyncAPI-compatible, at-least-once |
| Database | PostgreSQL database/schema-per-service, Redis chỉ là auxiliary |
| Security | Access token ngắn hạn, rotating refresh token, RBAC + tenant/ownership |
| Consistency | Local ACID + Outbox/Inbox + idempotent consumer + saga choreography |
| Verification | Unit, integration, contract, concurrency, security, E2E và load/failure test |

Provider, timeout nghiệp vụ và một số policy sản phẩm chưa được phê duyệt vẫn được biểu diễn bằng configuration key, không hard-code giá trị giả làm quyết định cuối.

## Quy tắc thay đổi

- API/message breaking change phải tăng major version hoặc có migration plan.
- Schema migration dùng expand-and-contract và tương thích rolling deployment.
- Thay đổi owner dữ liệu/service boundary phải cập nhật ADR trước.
- Mọi contract MUST phải truy vết được về UC/FR/BR/AC hoặc NFR.

