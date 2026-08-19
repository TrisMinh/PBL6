# Actor và phân quyền

## 1. Actor

### Guest

Người chưa đăng nhập. Được tìm kiếm, xem thông tin công khai, đăng ký và đăng nhập. Không được giữ ghế hoặc tạo booking.

### Customer

User đã xác thực, được quản lý hồ sơ, giữ ghế, đặt/thanh toán/hủy/đổi vé, xem lịch sử và đánh giá chuyến đã sử dụng.

### Operator Organization

Tổ chức nhà xe, không phải tài khoản đăng nhập. Sở hữu xe, tài xế, tuyến/chuyến, chính sách và dữ liệu vận hành thuộc tenant.

### Operator Staff

User thuộc một Operator Organization. Quyền chi tiết có thể gồm quản lý đội xe, lập lịch, vận hành, tài chính hoặc chỉ đọc.

### Driver

User tài xế thuộc một tổ chức. Chỉ được xem/chỉnh các chuyến được phân công, xem manifest tối thiểu cần thiết và check-in hành khách.

### Admin

User quản trị nền tảng. Được quản lý tổ chức, tài khoản, phân quyền, kiểm duyệt, tra cứu giao dịch và báo cáo; hành động nhạy cảm phải có audit.

### Payment Gateway

Hệ thống ngoài nhận yêu cầu thanh toán/refund và gửi webhook có chữ ký.

### Notification Provider

Hệ thống ngoài gửi email, SMS hoặc push. Không quyết định trạng thái nghiệp vụ.

## 2. Ma trận quyền cấp cao

| Chức năng | Guest | Customer | Driver | Operator Staff | Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| Tìm kiếm/xem chuyến public | ✓ | ✓ | ✓ | ✓ | ✓ |
| Giữ ghế, tạo booking |  | ✓ |  |  |  |
| Thanh toán/hủy/đổi vé của mình |  | ✓ |  |  |  |
| Xem manifest chuyến |  |  | Assigned only | Tenant only | ✓ |
| Check-in hành khách |  |  | Assigned only | Tenant only | ✓ |
| Quản lý xe/tài xế/tuyến/chuyến |  |  |  | Tenant only | ✓ |
| Quản lý booking nhà xe |  |  |  | Tenant only | ✓ |
| Xem doanh thu |  |  |  | Theo permission | ✓ |
| Quản lý tổ chức và role hệ thống |  |  |  |  | ✓ |
| Kiểm duyệt đánh giá/khiếu nại |  |  |  | Tenant scope | ✓ |
| Xem audit log |  |  |  | Tenant scope hạn chế | ✓ |

## 3. Yêu cầu authorization

| ID | Yêu cầu |
|---|---|
| AUTHZ-001 | Mọi endpoint không public MUST xác thực access token hợp lệ. |
| AUTHZ-002 | Service MUST kiểm tra quyền; không chỉ dựa vào API Gateway hoặc việc client ẩn nút. |
| AUTHZ-003 | Mọi truy vấn tenant MUST ràng buộc bằng `organization_id` lấy từ identity context, không lấy tin cậy từ body. |
| AUTHZ-004 | Customer chỉ xem/sửa Booking và Ticket thuộc `customer_id` của mình. |
| AUTHZ-005 | Driver chỉ truy cập Trip có assignment còn hiệu lực. |
| AUTHZ-006 | Admin action thay đổi role, khóa user, can thiệp payment/refund MUST tạo audit event. |
| AUTHZ-007 | Quyền xem PII trong manifest chỉ gồm dữ liệu tối thiểu cần cho vận hành chuyến. |
| AUTHZ-008 | Service-to-service request MUST có danh tính workload hoặc credential riêng, không dùng token của Admin. |

## 4. Role gợi ý

```text
CUSTOMER
DRIVER
OPERATOR_FLEET_MANAGER
OPERATOR_SCHEDULER
OPERATOR_OPERATIONS
OPERATOR_FINANCE
OPERATOR_VIEWER
PLATFORM_ADMIN
PLATFORM_SUPPORT
```

Một user có thể có nhiều role nhưng role operator phải gắn với một `organization_id`. Không mô hình hóa Admin, Driver và Customer thành ba bảng bắt buộc quan hệ 1–1 với User nếu không có dữ liệu profile riêng.
