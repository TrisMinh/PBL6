# 4.4.6. Nhóm Use Case — Quản trị và báo cáo

[← Danh mục Use Case](./README.md)

## UC-ADMIN-01 — Quản lý User, Organization và quyền

| Thuộc tính | Nội dung |
|---|---|
| Mục tiêu | Quản lý tài khoản, nhà xe, membership và role có kiểm soát. |
| Actor chính | Admin |
| Tiền điều kiện | Admin đã xác thực và có quyền cao hơn thao tác được yêu cầu. |
| Hậu điều kiện thành công | User/Organization/role/membership được cập nhật; phiên được thu hồi khi cần; có audit. |
| Hậu điều kiện thất bại | Dữ liệu quyền không thay đổi. |
| Liên kết | FR-IAM-008..009; FR-ADMIN-001; AUTHZ-006; AC-AUTH-002 |

### Luồng quản lý Organization

1. Admin tìm hoặc tạo Organization.
2. Admin nhập thông tin pháp lý, liên hệ và trạng thái.
3. Hệ thống kiểm tra tính duy nhất và quyền.
4. Hệ thống lưu Organization và ghi audit.
5. Khi khóa/deactivate Organization, quyền truy cập tenant và ảnh hưởng vận hành phải được hiển thị trước xác nhận.

### Luồng quản lý User và membership

1. Admin tìm User.
2. Admin khóa/mở khóa User hoặc tạo membership với Organization.
3. Admin gán/bỏ role phù hợp với scope.
4. Hệ thống kiểm tra privilege escalation, bảo vệ admin cuối cùng và quy tắc tenant.
5. Hệ thống lưu thay đổi, thu hồi phiên nếu cần và ghi audit.

### Ngoại lệ

- Admin không đủ quyền: từ chối và ghi security context khi phù hợp.
- Tự nâng quyền ngoài policy hoặc loại bỏ admin cuối cùng: từ chối.
- User/Organization không tồn tại/inactive: không cập nhật và trả lý do.
- Membership/role trùng: trả trạng thái hiện có hoặc conflict theo ngữ nghĩa thao tác.
- Request đồng thời: dùng version/concurrency check để tránh ghi đè âm thầm.

## UC-ADMIN-02 — Tra cứu giao dịch và audit

| Thuộc tính | Nội dung |
|---|---|
| Mục tiêu | Hỗ trợ tra cứu Booking, Payment, Refund và audit để xử lý hỗ trợ/đối soát. |
| Actor chính | Admin, Operator Finance theo phạm vi |
| Tiền điều kiện | Actor có permission tra cứu; bộ lọc hợp lệ. |
| Hậu điều kiện thành công | Giao dịch và lịch sử liên quan được hiển thị đúng scope. |
| Hậu điều kiện thất bại | Không lộ dữ liệu ngoài tenant/quyền và không sửa lịch sử. |
| Liên kết | FR-ADMIN-002; FR-PAY-009..010; BR-AUDIT-*; GOAL-007 |

### Luồng chính

1. Actor nhập Booking code, Ticket code, Payment/Refund ID, provider transaction ID hoặc correlation ID.
2. Hệ thống kiểm tra permission và tenant scope.
3. Hệ thống tìm và liên kết Booking, Payment, Ticket, Refund, Notification và audit liên quan.
4. Hệ thống hiển thị trạng thái, số tiền, thời điểm, actor/request source và sai lệch nếu có.
5. Nếu giao dịch chưa có kết quả cuối, actor có thể tạo/yêu cầu job reconciliation theo quyền.
6. Mọi hành động can thiệp hoặc replay phải có reason và audit riêng.

### Ngoại lệ

- Không tìm thấy trong scope: trả kết quả chung, không tiết lộ giao dịch tenant khác.
- Projection chậm: hiển thị thời điểm dữ liệu gần nhất và cho phép đọc nguồn giao dịch theo quyền.
- Provider không phản hồi khi đối soát: giữ case đang xử lý và retry theo policy.
- Lịch sử bất biến: giao diện không cung cấp chỉnh sửa trực tiếp Payment/Refund đã xác nhận.

## UC-ADMIN-03 — Quản lý khiếu nại

| Thuộc tính | Nội dung |
|---|---|
| Mục tiêu | Ghi nhận, phân công và xử lý khiếu nại có trạng thái và lịch sử. |
| Actor chính | Admin hoặc nhân sự hỗ trợ được cấp quyền |
| Tiền điều kiện | Actor có permission; khiếu nại tồn tại hoặc được tạo từ kênh hợp lệ. |
| Hậu điều kiện thành công | Khiếu nại có owner, trạng thái, kết quả và audit. |
| Hậu điều kiện thất bại | Không mất lịch sử hoặc gán ngoài quyền. |
| Mức ưu tiên | SHOULD |
| Liên kết | FR-ADMIN-003; BR-AUDIT-001 |

### Luồng chính

1. Actor tạo hoặc mở khiếu nại gắn với Customer/Booking/Ticket/Payment nếu có.
2. Hệ thống áp quyền và mask dữ liệu nhạy cảm.
3. Actor phân loại, đặt ưu tiên, phân công người xử lý và cập nhật trạng thái.
4. Actor ghi nhận trao đổi, bằng chứng và kết quả.
5. Khi đóng case, actor nhập resolution bắt buộc.
6. Hệ thống giữ lịch sử thay đổi và audit.

### Ngoại lệ

- Booking/giao dịch liên quan ngoài scope: không cho liên kết hoặc hiển thị.
- Chuyển trạng thái không hợp lệ: từ chối.
- Thiếu resolution khi đóng: không hoàn tất.
- Tệp/bằng chứng không an toàn: từ chối theo policy upload.

## UC-REPORT-01 — Xem và xuất báo cáo

| Thuộc tính | Nội dung |
|---|---|
| Mục tiêu | Xem chỉ số vận hành/tài chính đúng phạm vi và định nghĩa. |
| Actor chính | Admin, Operator Finance |
| Tiền điều kiện | Actor có permission; khoảng thời gian và bộ lọc hợp lệ. |
| Hậu điều kiện thành công | Báo cáo hoặc Export Job được tạo trong scope. |
| Hậu điều kiện thất bại | Không rò rỉ dữ liệu; độ trễ dữ liệu được trình bày rõ. |
| Liên kết | FR-REPORT-001..003; GOAL-007 |

### Luồng xem báo cáo

1. Actor chọn khoảng thời gian, timezone và bộ lọc.
2. Hệ thống áp tenant scope; Admin có thể chọn phạm vi nếu được phép.
3. Hệ thống trả gross revenue, net revenue, Booking, Refund và occupancy cùng định nghĩa metric.
4. Giao diện hiển thị đơn vị, timezone, thời điểm dữ liệu gần nhất và phạm vi lọc.
5. Actor có thể drill-down/tra cứu giao dịch khi có permission.

### Luồng export

1. Actor yêu cầu export CSV với cùng bộ lọc.
2. Hệ thống ước lượng kích thước.
3. Export nhỏ có thể trả trực tiếp; export lớn tạo Export Job bất đồng bộ.
4. Hệ thống tạo file có thời hạn tải xuống và audit nếu chứa PII.
5. Actor được Notification khi file sẵn sàng.

### Ngoại lệ

- Khoảng thời gian sai hoặc quá lớn: từ chối/đề nghị thu hẹp.
- Projection đang chậm: hiển thị thời điểm cập nhật, không trình bày như dữ liệu thời gian thực.
- Export lỗi: job FAILED có lý do an toàn và khả năng retry.
- Actor mất quyền trước khi tải: từ chối tải dù link còn thời hạn.
- Operator cố xem tenant khác: từ chối.

[← Danh mục Use Case](./README.md)
