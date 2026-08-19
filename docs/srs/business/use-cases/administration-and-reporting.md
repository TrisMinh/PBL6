# Use Case: Quản trị và báo cáo

## UC-ADMIN-01 — Quản lý user và tenant

| Thuộc tính | Nội dung |
|---|---|
| Mục tiêu | Quản lý tài khoản, tổ chức và quyền truy cập có kiểm soát |
| Actor chính | Platform Admin |
| Kích hoạt | Admin chọn một user hoặc organization để quản lý |
| Service chịu trách nhiệm | Identity Service |
| Tiền điều kiện | Admin đã xác thực và có quyền cao hơn thao tác được yêu cầu |
| Hậu điều kiện thành công | Role, membership hoặc trạng thái được cập nhật; phiên bị thu hồi khi cần; thay đổi được audit |
| Hậu điều kiện thất bại | Dữ liệu quyền không thay đổi |

### Luồng chính

1. Admin tìm user hoặc organization.
2. Admin tạo hoặc thay đổi role, membership hay trạng thái.
3. Service kiểm tra quyền cao hơn và chính sách bảo vệ admin cuối cùng.
4. Service lưu thay đổi, thu hồi phiên nếu cần và ghi audit.

### Luồng thay thế và ngoại lệ

- Admin không đủ quyền: hệ thống từ chối và ghi security audit khi phù hợp.
- Thao tác loại bỏ admin cuối cùng: hệ thống từ chối theo chính sách.
- User hoặc organization không tồn tại/không còn active: hệ thống không cập nhật và trả lý do.

## UC-REPORT-01 — Xem báo cáo

| Thuộc tính | Nội dung |
|---|---|
| Mục tiêu | Xem chỉ số vận hành và tài chính đúng phạm vi dữ liệu |
| Actor chính | Admin, Operator Finance |
| Kích hoạt | Actor chọn khoảng thời gian và bộ lọc báo cáo |
| Service chịu trách nhiệm | Reporting Service |
| Tiền điều kiện | Actor có quyền báo cáo; read model đã được khởi tạo |
| Hậu điều kiện thành công | Báo cáo hoặc yêu cầu export được tạo trong tenant scope |
| Hậu điều kiện thất bại | Không rò rỉ dữ liệu ngoài tenant; hệ thống thông báo tình trạng dữ liệu nếu projection chậm |

### Luồng chính

1. Actor chọn khoảng thời gian, múi giờ và bộ lọc.
2. Reporting Service áp tenant scope và truy vấn read model.
3. Service trả gross revenue, net revenue, refund, booking và occupancy kèm định nghĩa metric.
4. Actor có thể yêu cầu export CSV bất đồng bộ nếu có quyền.

### Luồng thay thế và ngoại lệ

- Khoảng thời gian không hợp lệ: hệ thống từ chối trước khi truy vấn.
- Projection đang chậm: hệ thống hiển thị thời điểm dữ liệu gần nhất, không trình bày như dữ liệu thời gian thực.
- Export lớn: hệ thống tạo job bất đồng bộ và thông báo khi file sẵn sàng.

