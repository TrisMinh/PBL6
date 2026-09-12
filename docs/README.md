# Tài liệu thiết kế và triển khai PBL6

Thư mục `docs/` chỉ chứa tài liệu kỹ thuật phục vụ thiết kế, triển khai và kiểm thử. Toàn bộ đặc tả yêu cầu, lịch sử baseline và file Word SRS được quản lý riêng tại [`srs/`](../srs/README.md).

## Bộ tài liệu hiện hành

- [System Design](./system-design/README.md): thiết kế kiến trúc, giao tiếp dịch vụ, RabbitMQ, dữ liệu, bảo mật và triển khai.
- [Detailed Design](./detailed-design/README.md): API, event contract, physical database, authorization, recovery và test design có thể triển khai.
- [Diagram](./diagrams/README.md): sơ đồ tổng hợp, các sơ đồ chuyên biệt và đặc tả đầu vào để vẽ.
- [Implementation Baseline](./implementation/README.md): quyết định công nghệ, cấu trúc repository, thứ tự triển khai và Definition of Ready/Done.
- [Báo cáo readiness](./implementation/06-document-readiness-report.md): kết luận có thể bắt đầu code, evidence đã kiểm tra và các điều kiện toolchain còn thiếu.
- [Executable Contracts](./contracts/README.md): OpenAPI, AsyncAPI và JSON Schema active của MVP.
- [Database Migration Baseline](./database/README.md): schema PostgreSQL nghiệp vụ cho sáu service.

[SRS 2.0](../srs/v2/README.md) là nguồn quyết định cho yêu cầu và quy tắc nghiệp vụ. System/Detailed Design quyết định cách triển khai nhưng không được tự tạo thêm hành vi. Diagram dùng để giải thích trực quan và phải truy vết về requirement ID tương ứng.
