# Use Case: Định danh và truy cập

## UC-AUTH-01 — Đăng ký và kích hoạt tài khoản

| Thuộc tính | Nội dung |
|---|---|
| Mục tiêu | Tạo tài khoản khách hàng đã được xác minh |
| Actor chính | Guest |
| Actor phụ | Notification Provider |
| Kích hoạt | Guest chọn đăng ký tài khoản |
| Service chịu trách nhiệm | Identity Service |
| Tiền điều kiện | Email hoặc số điện thoại chưa thuộc tài khoản đang hoạt động |
| Hậu điều kiện thành công | User được tạo và kích hoạt sau khi xác minh |
| Hậu điều kiện thất bại | Không có tài khoản hoạt động được tạo; dữ liệu chờ xác minh có thể được giữ theo chính sách |

### Luồng chính

1. Guest nhập họ tên, email, số điện thoại và mật khẩu.
2. Identity Service kiểm tra dữ liệu, tính duy nhất và chính sách mật khẩu.
3. Service tạo user ở trạng thái chờ xác minh và yêu cầu gửi OTP hoặc liên kết xác minh.
4. Guest gửi mã xác minh còn hiệu lực.
5. Service kích hoạt tài khoản và ghi audit.

### Luồng thay thế và ngoại lệ

- Dữ liệu trùng hoặc không hợp lệ: hệ thống từ chối và trả lỗi tại trường tương ứng.
- OTP sai hoặc hết hạn: hệ thống không kích hoạt tài khoản; Guest có thể yêu cầu gửi lại trong giới hạn tần suất.
- Notification Provider lỗi: user vẫn ở trạng thái chờ và có thể yêu cầu gửi lại.

## UC-AUTH-02 — Đăng nhập

| Thuộc tính | Nội dung |
|---|---|
| Mục tiêu | Tạo phiên truy cập đúng vai trò và phạm vi dữ liệu |
| Actor chính | Customer, Driver, Operator Staff, Admin |
| Kích hoạt | User gửi thông tin đăng nhập |
| Service chịu trách nhiệm | Identity Service |
| Tiền điều kiện | Tài khoản tồn tại; phương thức đăng nhập được hỗ trợ |
| Hậu điều kiện thành công | Access token và refresh token hợp lệ được cấp |
| Hậu điều kiện thất bại | Không tạo phiên mới; lần đăng nhập thất bại được ghi nhận khi cần |

### Luồng chính

1. User gửi định danh và mật khẩu.
2. Service kiểm tra giới hạn tần suất, thông tin xác thực, trạng thái user và membership.
3. Service phát hành token chứa subject, role và tenant scope phù hợp.
4. Client điều hướng đến giao diện theo role.

### Luồng thay thế và ngoại lệ

- Thông tin xác thực sai: hệ thống trả thông báo chung và tăng bộ đếm thất bại.
- Tài khoản bị khóa hoặc chưa xác minh: hệ thống từ chối với mã lỗi phù hợp.
- Vượt ngưỡng đăng nhập sai: hệ thống khóa tạm và ghi security audit.

