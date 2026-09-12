# Tài liệu dự án PBL6

## Baseline và lịch sử phiên bản

- [SRS 2.0 — Active baseline](./srs-v2/README.md): nguồn quyết định hiện hành cho phạm vi, nghiệp vụ, yêu cầu, trạng thái và tiêu chí nghiệm thu.
- [SRS 1.x — Historical baseline](./srs/README.md): được giữ nguyên để truy vết lịch sử; không dùng để quyết định hành vi mới khi khác SRS 2.0.
- [Lịch sử baseline SRS](./SRS-CHANGELOG.md): ghi rõ quan hệ giữa SRS 1.0.0, SRS 2.0.0 và các bản Word phát hành.
- [Word SRS v001](./word-snapshots/releases/PBL6-SRS-v001.docx) là bản Word phát hành hiện hành; các file trong [`word-snapshots/`](./word-snapshots/) là bản đóng gói/báo cáo theo thời điểm. Markdown đã được phê duyệt mới là nguồn quyết định; Word được đồng bộ sau mỗi mốc phát hành tài liệu.

Không xóa hoặc ghi đè một baseline cũ. Khi thay đổi yêu cầu, tạo phiên bản/baseline mới, ghi lịch sử thay đổi và nêu rõ phiên bản active tại file này.

## Bộ tài liệu hiện hành

- [Software Requirements Specification](./srs-v2/README.md): đặc tả sản phẩm, nghiệp vụ, yêu cầu hệ thống, ràng buộc và tiêu chí nghiệm thu.
- [System Design](./system-design/README.md): thiết kế kiến trúc, giao tiếp dịch vụ, RabbitMQ, dữ liệu, bảo mật và triển khai.
- [Detailed Design](./detailed-design/README.md): API, event contract, physical database, authorization, recovery và test design có thể triển khai.
- [Diagram](./diagrams/README.md): sơ đồ tổng hợp, các sơ đồ chuyên biệt và đặc tả đầu vào để vẽ.
- [Implementation Baseline](./implementation/README.md): quyết định công nghệ, cấu trúc repository, thứ tự triển khai và Definition of Ready/Done.
- [Báo cáo readiness](./implementation/06-document-readiness-report.md): kết luận có thể bắt đầu code, evidence đã kiểm tra và các điều kiện toolchain còn thiếu.
- [Executable Contracts](./contracts/README.md): OpenAPI, AsyncAPI và JSON Schema active của MVP.
- [Database Migration Baseline](./database/README.md): schema PostgreSQL nghiệp vụ cho sáu service.
- [Word snapshots](./word-snapshots/): bản báo cáo/SRS đóng gói được giữ để truy vết lịch sử; chưa phải nguồn quyết định active.
- [QA artifacts](./qa-artifacts/final-all/): ảnh render đã kiểm tra của kiến trúc, luồng, state, sequence và data model.

SRS 2.0 là nguồn quyết định cho yêu cầu và quy tắc nghiệp vụ. System/Detailed Design quyết định cách triển khai nhưng không được tự tạo thêm hành vi. Diagram dùng để giải thích trực quan và phải truy vết về requirement ID tương ứng.
