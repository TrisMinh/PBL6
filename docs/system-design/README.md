# 2. System Design

Tài liệu System Design chuyển các yêu cầu và ràng buộc trong SRS thành cấu trúc kỹ thuật có thể triển khai. SRS vẫn là nguồn quyết định cho hành vi nghiệp vụ; tài liệu này quyết định cách các thành phần được phân ranh giới, giao tiếp, lưu trữ, bảo vệ và vận hành.

## Nội dung

- [2.1 System Architecture](./02-01-system-architecture/README.md)
- [2.2 Use Case Diagrams](./02-02-use-case-diagrams/README.md)
- [2.3 Sequence Diagrams](./02-03-sequence-diagrams/README.md)
- [2.4 Activity Diagrams](./02-04-activity-diagrams/README.md)
- [2.5 State Machine Diagrams](./02-05-state-machine-diagrams/README.md)
- [2.6 Domain/Class Diagrams](./02-06-domain-class-diagrams/README.md)
- [2.7 Database ERD](./02-07-database-erd/README.md)
- [2.8 RabbitMQ Event Flow](./02-08-rabbitmq-event-flow/README.md)
- [2.9 Robustness Diagrams](./02-09-robustness-diagrams/README.md)

## Traceability

| Thiết kế | Nguồn quyết định chính |
|---|---|
| Activity, Use Case, Sequence, Robustness | SRS Chương 3–5 |
| State Machine | SRS Chương 6 |
| Domain/Class và ERD | SRS Chương 8 + service ownership tại 2.1 |
| RabbitMQ Event Flow | SRS integration contract + 2.1.5/2.1.6 |

Các sơ đồ được nhúng trực tiếp bằng Mermaid trong Markdown; thư mục System Design không phụ thuộc Word, SVG, PNG hoặc HTML.

## Quy ước trạng thái

| Trạng thái | Ý nghĩa |
|---|---|
| `Accepted` | Đã được chọn làm baseline kiến trúc. |
| `Proposed` | Đề xuất để triển khai; cần xác nhận khi bắt đầu coding hoặc chọn hạ tầng. |
| `Superseded` | Không còn áp dụng; phải trỏ đến quyết định thay thế. |

Thay đổi một quyết định `Accepted` phải được ghi lại trong [Architecture Decisions](./02-01-system-architecture/02-01-12-architecture-decisions.md), không chỉnh âm thầm ở một file riêng lẻ.
