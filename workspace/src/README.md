# Application source

Thư mục này là nơi scaffold toàn bộ mã nguồn trong Sprint 0 theo [repository structure](../../docs/implementation/01-repository-structure.md).

- `apps/`: Customer Web, Back-office Web và Mobile.
- `gateway/`: API Gateway.
- `services/`: các backend bounded context.
- `building-blocks/`: primitive kỹ thuật dùng chung.
- `infra/`: Docker Compose, RabbitMQ và observability.
- `tests/`: contract, integration, end-to-end, performance và architecture tests.

Identity Service đã có skeleton `Api/Application/Domain/Infrastructure` target `net10.0`. Các project còn lại được scaffold theo card đã gán trong [Sprint 0](../../task-tracking/board/sprint-00-foundation.md).
