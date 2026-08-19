# Software Requirements Specification

## Online Bus Ticket Booking System

Bộ tài liệu mô tả sản phẩm từ phạm vi tổng quát đến yêu cầu triển khai và kiểm thử chi tiết. Kiến trúc hệ thống là **Microservices**, phục vụ chung cho Web End-user, Back-office Web và Mobile App.

## Cấu trúc tài liệu

### A. Hiểu sản phẩm và phạm vi

1. [Tổng quan sản phẩm](./01-product-overview.md)
2. [Phạm vi và bối cảnh hệ thống](./02-scope-and-context.md)
3. [Actor và phân quyền](./03-actors-and-authorization.md)
4. [Quy trình nghiệp vụ tổng quát](./04-business-processes.md)

### B. Hiểu yêu cầu và hành vi nghiệp vụ

5. [Yêu cầu chức năng](./05-functional-requirements.md)
6. [Business rules](./06-business-rules.md)
7. [Use cases](./07-use-cases.md)
8. [Mô hình trạng thái](./08-state-models.md)
9. [Mô hình miền và dữ liệu](./09-domain-and-data-model.md)

### C. Hiểu thiết kế kỹ thuật

10. [Kiến trúc Microservices](./10-microservices-architecture.md)
11. [Yêu cầu API và event](./11-api-and-events.md)
12. [Yêu cầu giao diện](./12-ui-requirements.md)

### D. Hiểu chất lượng, ngoại lệ và nghiệm thu

13. [Yêu cầu phi chức năng, bảo mật và vận hành](./13-non-functional-security-operations.md)
14. [Ngoại lệ và khả năng phục hồi](./14-exceptions-and-recovery.md)
15. [Acceptance criteria và traceability](./15-acceptance-and-traceability.md)
16. [Đặc tả đầu vào cho diagram](./16-diagram-specifications.md)

## Cách sử dụng

- Khi phân tích nghiệp vụ, đọc 01–07 theo thứ tự và chỉ đi tiếp khi phạm vi, actor, quy trình và business rule đã thống nhất.
- Khi vẽ diagram, mở tài liệu 16 và lần lượt vẽ Context → Use Case → Activity → Robustness → Sequence → State → Class/ERD → Architecture → Deployment.
- Khi thiết kế backend, dùng 08–11 để chốt state, data ownership, service boundary, API và event contract.
- Khi kiểm thử, dùng 13–15 để xây dựng test plan, failure test, load test và acceptance test.
- Khi nội dung thay đổi, cập nhật requirement ID và traceability trước khi sửa diagram để tránh tài liệu lệch nhau.

## Quy ước mức độ

- **MUST:** bắt buộc để nghiệm thu MVP.
- **SHOULD:** nên có, có thể lùi khi có phê duyệt phạm vi.
- **COULD:** hướng mở rộng.
- Mỗi yêu cầu có một ID ổn định để liên kết với Use Case, API và test.
