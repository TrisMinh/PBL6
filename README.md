# PBL6 — Hệ thống đặt vé xe khách trực tuyến

Repository dùng SRS 2.0.1 làm baseline hiện hành để triển khai hệ thống bằng C# ASP.NET Core, React và React Native. Các SRS cũ và file Word được giữ lại như lịch sử/snapshot; không ghi đè để bảo toàn log thay đổi.

## Điểm bắt đầu

- [Mục lục tài liệu](./docs/README.md)
- [SRS 2.0.1 — active baseline](./docs/srs/v2/README.md)
- [Kết luận sẵn sàng triển khai](./docs/implementation/06-document-readiness-report.md)
- [Kế hoạch triển khai MVP](./docs/implementation/02-mvp-delivery-plan.md)
- [Roadmap, phân công và Kanban Markdown](./task-tracking/README.md)
- [Workspace mã nguồn và cấu hình build](./workspace/README.md)
- [OpenAPI/AsyncAPI/JSON Schema](./docs/contracts/README.md)
- [PostgreSQL migration baseline](./docs/database/README.md)

## Trạng thái

Baseline tài liệu MVP đã đủ để bắt đầu Slice 0 với mọi project backend target `.NET 10 / net10.0`. Identity Service đã được scaffold trong `workspace/src/`; các service còn lại tiếp tục theo cùng dependency rule. Docker Compose vẫn cần trước khi chạy full local stack và integration test; xem [development prerequisites](./docs/implementation/05-development-prerequisites.md).
