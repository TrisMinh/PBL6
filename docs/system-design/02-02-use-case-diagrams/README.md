# 2.2 Use Case Diagrams

Bộ sơ đồ Use Case của nền tảng đặt vé xe khách trực tuyến, bao phủ đủ 28 mã `UC-*` trong SRS. Actor nằm ngoài system boundary; use case nằm trong boundary; association không có hướng; quan hệ phụ thuộc dùng `«include»` hoặc `«extend»`.

Mermaid chưa có loại diagram UML Use Case native. Các file này dùng `flowchart` với use case dạng oval để giữ đúng ngữ nghĩa UML trong Markdown, không sinh hoặc phụ thuộc Word/SVG/PNG/HTML.

## Danh mục

| Mục | Sơ đồ | Use Case |
|---|---|---|
| [2.2.1](./01-identity-and-profile.md) | Định danh và hồ sơ | `UC-AUTH-01..04`, `UC-PROFILE-01` |
| [2.2.2](./02-search-booking-ticket.md) | Tìm chuyến, Booking và Ticket | `UC-SEARCH-01`, `UC-BOOK-01..02`, `UC-TICKET-01` |
| [2.2.3](./03-payment-cancellation-change.md) | Payment, hủy và đổi vé | `UC-PAY-01`, `UC-CANCEL-01`, `UC-CHANGE-01` |
| [2.2.4](./04-operator-trip-checkin.md) | Vận hành nhà xe và Trip | `UC-OPS-01..06`, `UC-DRIVER-01`, `UC-TRIP-01` |
| [2.2.5](./05-promotion-review-notification.md) | Promotion, Review và Notification | `UC-PROMO-01`, `UC-REVIEW-01..02`, `UC-NOTIF-01` |
| [2.2.6](./06-administration-reporting.md) | Quản trị và báo cáo | `UC-ADMIN-01..03`, `UC-REPORT-01` |

## Ký pháp

| Ký pháp | Ý nghĩa |
|---|---|
| Shape hình người ngoài boundary | Human actor tương tác với nền tảng |
| Hộp `«external system»` | Hệ thống ngoài đóng vai trò supporting actor |
| Oval trong boundary | Use Case hoặc hành vi dùng lại |
| Đường liền không mũi tên | Association giữa actor và Use Case |
| `«include»` | Use Case nguồn luôn dùng hành vi đích |
| `«extend» [điều kiện]` | Hành vi nguồn chỉ mở rộng Use Case đích khi điều kiện đúng |

Sơ đồ không hard-code màu nền; system boundary trong suốt và màu chữ/nút theo Mermaid theme của Markdown viewer.

Chi tiết thứ tự message/service/database nằm riêng tại [2.3 Sequence Diagrams](../02-03-sequence-diagrams/README.md); không dùng sequence diagram thay cho Use Case diagram.

## Nguồn

- [Danh mục 28 Use Case](../../srs-v2/04-use-cases/README.md)
- [Actor và phân quyền](../../srs-v2/02-tong-quan-san-pham.md)
- [Yêu cầu chức năng](../../srs-v2/05-yeu-cau-chuc-nang.md)
