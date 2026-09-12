# Implementation Baseline

Tài liệu này là cầu nối từ SRS/System Design/Detailed Design sang code. SRS 2.0 quyết định hành vi; ADR quyết định kiến trúc/công nghệ; contract và migration quyết định bề mặt tích hợp có thể kiểm thử.

## Baseline

- Backend: C# trên .NET 8 (`net8.0`), ASP.NET Core, EF Core/Npgsql.
- Gateway: ASP.NET Core + YARP.
- Web: React 19.2 + TypeScript + Vite; Node.js 24 LTS, npm workspaces.
- Mobile: React Native 0.87 stable + TypeScript.
- Data/messaging: PostgreSQL, RabbitMQ; Redis chỉ auxiliary.
- Contract: OpenAPI cho HTTP, JSON Schema/AsyncAPI cho message.
- Local: Docker Compose, Mailpit và payment provider simulator.
- Scope: toàn bộ `MUST`; `SHOULD/COULD` không map route và không hiện UI trong MVP.

## Tài liệu triển khai

1. [Cấu trúc repository và dependency rule](./01-repository-structure.md)
2. [Kế hoạch triển khai MVP theo vertical slice](./02-mvp-delivery-plan.md)
3. [Configuration baseline](./03-configuration-baseline.md)
4. [MVP traceability: requirement → code boundary](./04-mvp-traceability.md)
5. [Development prerequisites](./05-development-prerequisites.md)
6. [Báo cáo sẵn sàng triển khai code](./06-document-readiness-report.md)
7. [Nhật ký thay đổi implementation baseline](./07-baseline-change-log.md)
8. [UI screen map và trạng thái bắt buộc](../detailed-design/03-07-ui-ux-design/README.md)
9. [API contract](../contracts/openapi/README.md)
10. [Event contract](../contracts/asyncapi/README.md)
11. [Database migrations](../database/README.md)
12. [Roadmap, phân công và Kanban Markdown](../project-management/README.md)

## Thứ tự ưu tiên khi có mâu thuẫn

1. SRS 2.0 requirement/Business Rule/state/Acceptance Criteria.
2. ADR `Accepted`.
3. OpenAPI/JSON Schema và migration đã pass compatibility test.
4. Detailed Design.
5. Code hiện tại.

Không sửa code để “lách” contract. Nếu requirement thay đổi, cập nhật baseline và traceability trước hoặc trong cùng pull request.
