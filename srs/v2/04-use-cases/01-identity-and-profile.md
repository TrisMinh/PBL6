# 4.4.1. Nhóm Use Case — Định danh và hồ sơ

[← Danh mục Use Case](./README.md)

## UC-AUTH-01 — Đăng ký và kích hoạt tài khoản

| Thuộc tính | Nội dung |
|---|---|
| Mục tiêu | Tạo một tài khoản Customer đã được xác minh. |
| Actor chính | Guest |
| Actor phụ | Notification Provider |
| Kích hoạt | Guest chọn đăng ký. |
| Tiền điều kiện | Email/số điện thoại chưa thuộc tài khoản đang hoạt động; Guest chưa đăng nhập. |
| Hậu điều kiện thành công | User được kích hoạt và có thể đăng nhập. |
| Hậu điều kiện thất bại | Không có tài khoản active được tạo; bản ghi chờ xác minh được xử lý theo retention policy. |
| Liên kết | FR-IAM-001..002; AC-AUTH-001 |

### Luồng chính

1. Guest nhập họ tên, email, số điện thoại và mật khẩu.
2. Hệ thống chuẩn hóa và kiểm tra định dạng, tính duy nhất và chính sách mật khẩu.
3. Hệ thống tạo tài khoản ở trạng thái chờ xác minh.
4. Hệ thống gửi OTP hoặc liên kết xác minh có thời hạn.
5. Guest gửi mã/token xác minh còn hiệu lực.
6. Hệ thống kích hoạt Customer và ghi sự kiện audit cần thiết.
7. Hệ thống thông báo đăng ký thành công và cho phép đăng nhập.

### Luồng thay thế và ngoại lệ

- Email/số điện thoại trùng: không tạo User thứ hai và trả lỗi an toàn.
- Dữ liệu không hợp lệ: trả lỗi theo trường.
- OTP/token sai hoặc hết hạn: không kích hoạt; cho phép yêu cầu gửi lại trong giới hạn tần suất.
- Notification Provider lỗi: giữ trạng thái chờ; không kích hoạt âm thầm và cho phép gửi lại.
- Gửi lặp request đăng ký: không tạo nhiều tài khoản active cho cùng định danh.

## UC-AUTH-02 — Đăng nhập

| Thuộc tính | Nội dung |
|---|---|
| Mục tiêu | Tạo phiên truy cập đúng User, role và tenant scope. |
| Actor chính | Customer, Driver, Operator Staff, Admin |
| Kích hoạt | User gửi thông tin đăng nhập. |
| Tiền điều kiện | Tài khoản tồn tại; phương thức đăng nhập được hỗ trợ. |
| Hậu điều kiện thành công | Access token/session và refresh token hợp lệ được cấp. |
| Hậu điều kiện thất bại | Không tạo phiên mới; lần đăng nhập thất bại được ghi nhận khi cần. |
| Liên kết | FR-IAM-003, FR-IAM-007; AUTHZ-001 |

### Luồng chính

1. User nhập email/số điện thoại và mật khẩu.
2. Hệ thống kiểm tra rate limit và trạng thái chống abuse.
3. Hệ thống xác minh thông tin đăng nhập và trạng thái tài khoản.
4. Hệ thống xác định role, membership và tenant scope hiện hành.
5. Hệ thống phát hành phiên truy cập theo policy.
6. Client điều hướng đến giao diện phù hợp với role nhưng không dùng việc ẩn giao diện thay cho authorization server.

### Luồng thay thế và ngoại lệ

- Sai thông tin: trả thông báo chung, không tiết lộ định danh có tồn tại.
- Tài khoản chưa xác minh: từ chối và cung cấp luồng gửi lại xác minh nếu phù hợp.
- Tài khoản inactive/locked: từ chối bằng mã lỗi phù hợp.
- Vượt ngưỡng thất bại: khóa/chậm tạm thời và ghi security audit.
- Membership tenant bị thu hồi: không cấp scope đã hết hiệu lực.

## UC-AUTH-03 — Refresh phiên và đăng xuất

| Thuộc tính | Nội dung |
|---|---|
| Mục tiêu | Duy trì hoặc kết thúc phiên truy cập an toàn. |
| Actor chính | User đã đăng nhập |
| Kích hoạt | Access token sắp/hết hạn hoặc User chọn đăng xuất. |
| Tiền điều kiện | Có refresh token/session đã được cấp. |
| Hậu điều kiện thành công | Refresh tạo phiên mới hợp lệ; logout thu hồi token theo policy. |
| Hậu điều kiện thất bại | Không cấp phiên mới và yêu cầu đăng nhập lại. |
| Liên kết | FR-IAM-004; NFR-SEC-003 |

### Luồng refresh

1. Client gửi refresh token theo kênh bảo mật.
2. Hệ thống kiểm tra hash, expiry, revoke state, User và membership.
3. Hệ thống thu hồi/rotate refresh token cũ theo policy.
4. Hệ thống cấp access token và refresh token mới.

### Luồng logout

1. User chọn đăng xuất.
2. Client gửi yêu cầu thu hồi phiên hiện tại.
3. Hệ thống đánh dấu refresh token/session đã revoke.
4. Client xóa credential cục bộ và trở về trạng thái chưa đăng nhập.

### Ngoại lệ

- Refresh token sai, hết hạn, đã revoke hoặc bị reuse: từ chối và có thể thu hồi token family.
- User/tenant bị khóa sau khi phiên được cấp: không phát hành phiên mới.
- Logout lặp: trả kết quả thành công idempotent.

## UC-AUTH-04 — Quên và đặt lại mật khẩu

| Thuộc tính | Nội dung |
|---|---|
| Mục tiêu | Cho phép User đặt mật khẩu mới mà không làm lộ sự tồn tại tài khoản. |
| Actor chính | Guest/User |
| Actor phụ | Notification Provider |
| Kích hoạt | User chọn “Quên mật khẩu”. |
| Tiền điều kiện | Kênh khôi phục được hỗ trợ. |
| Hậu điều kiện thành công | Mật khẩu được thay đổi; token khôi phục và phiên cũ bị vô hiệu theo policy. |
| Hậu điều kiện thất bại | Mật khẩu không thay đổi. |
| Liên kết | FR-IAM-005; NFR-SEC-004 |

### Luồng chính

1. User nhập email hoặc số điện thoại.
2. Hệ thống luôn trả thông báo chung, bất kể tài khoản có tồn tại.
3. Nếu tài khoản hợp lệ, hệ thống tạo token/OTP một lần có thời hạn và gửi qua kênh đã xác minh.
4. User gửi token/OTP và mật khẩu mới.
5. Hệ thống kiểm tra token, rate limit và password policy.
6. Hệ thống cập nhật password hash, vô hiệu token khôi phục và xử lý các phiên cũ theo policy.

### Ngoại lệ

- Token sai/hết hạn/đã dùng: từ chối và không đổi mật khẩu.
- Vượt giới hạn yêu cầu: trả rate-limit response.
- Notification lỗi: token không được xem là đã giao; User có thể yêu cầu gửi lại theo giới hạn.

## UC-PROFILE-01 — Xem và cập nhật hồ sơ

| Thuộc tính | Nội dung |
|---|---|
| Mục tiêu | Cho phép Customer quản lý thông tin hồ sơ của chính mình. |
| Actor chính | Customer |
| Kích hoạt | Customer mở hồ sơ hoặc lưu thay đổi. |
| Tiền điều kiện | Customer đã xác thực. |
| Hậu điều kiện thành công | Hồ sơ được cập nhật; định danh thay đổi đã được xác minh lại khi cần. |
| Hậu điều kiện thất bại | Dữ liệu cũ được giữ nguyên. |
| Liên kết | FR-IAM-006; AUTHZ-004 |

### Luồng chính

1. Customer mở hồ sơ.
2. Hệ thống trả dữ liệu được phép hiển thị và mask trường nhạy cảm khi cần.
3. Customer thay đổi họ tên hoặc thông tin được phép.
4. Hệ thống kiểm tra định dạng và cập nhật dữ liệu.
5. Nếu email/số điện thoại thay đổi, hệ thống đánh dấu chờ xác minh và gửi OTP/link.
6. Chỉ sau khi xác minh thành công, định danh mới trở thành giá trị đăng nhập/nhận thông báo chính thức.

### Ngoại lệ

- Định danh mới đã được dùng: từ chối thay đổi.
- Dữ liệu không hợp lệ: trả lỗi theo trường.
- Xác minh thất bại/hết hạn: giữ định danh cũ có hiệu lực.
- Customer cố sửa role, tenant hoặc trạng thái hệ thống: từ chối.

[← Danh mục Use Case](./README.md)
