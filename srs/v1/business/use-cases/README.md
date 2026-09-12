# Danh mục Use Case

Use Case mô tả cách actor tương tác với hệ thống để đạt một mục tiêu nghiệp vụ. Tài liệu này không mô tả chi tiết HTTP, bảng dữ liệu, pod triển khai hoặc thuật toán nội bộ; các nội dung đó được liên kết sang đặc tả kỹ thuật tương ứng.

## Cách đọc

1. Đọc [Actor và phân quyền](../../overview/actors-and-permissions.md) để hiểu vai trò và phạm vi dữ liệu.
2. Đọc [Quy trình nghiệp vụ](../business-processes.md) để hiểu bối cảnh đầu-cuối.
3. Mở nhóm Use Case cần phân tích trong danh mục bên dưới.
4. Đối chiếu [Quy tắc nghiệp vụ](../business-rules.md) và [Yêu cầu trạng thái](../../requirements/state-requirements.md) khi cần xử lý nhánh lỗi hoặc chuyển trạng thái.

## Danh mục

| Nhóm nghiệp vụ | Use Case |
|---|---|
| [Định danh và truy cập](./identity-and-access.md) | `UC-AUTH-01`, `UC-AUTH-02` |
| [Tìm chuyến và đặt vé](./journey-search-and-booking.md) | `UC-SEARCH-01`, `UC-BOOK-01` |
| [Thanh toán, hủy và đổi vé](./payment-cancellation-and-change.md) | `UC-PAY-01`, `UC-CANCEL-01`, `UC-CHANGE-01` |
| [Vận hành chuyến](./trip-operations.md) | `UC-OPS-01`, `UC-DRIVER-01`, `UC-TRIP-01` |
| [Quản trị và báo cáo](./administration-and-reporting.md) | `UC-ADMIN-01`, `UC-REPORT-01` |

## Mẫu trình bày bắt buộc

Mỗi Use Case phải có:

- ID và tên thể hiện mục tiêu nghiệp vụ;
- actor chính và actor phụ nếu có;
- sự kiện kích hoạt;
- tiền điều kiện;
- hậu điều kiện thành công và trạng thái khi thất bại;
- luồng chính được đánh số;
- luồng thay thế, ngoại lệ và bù trừ nếu có;
- liên kết tới Business Rule, Functional Requirement và Acceptance Criteria trong ma trận truy vết.

