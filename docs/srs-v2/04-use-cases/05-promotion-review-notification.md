# 4.4.5. Nhóm Use Case — Promotion, Review và Notification

[← Danh mục Use Case](./README.md)

## UC-PROMO-01 — Quản lý và áp dụng Promotion

| Thuộc tính | Nội dung |
|---|---|
| Mục tiêu | Cho phép tạo Promotion có kiểm soát và áp dụng discount chính xác phía server. |
| Actor chính | Operator Staff/Admin khi quản lý; Customer khi áp dụng |
| Tiền điều kiện | Actor quản lý có permission; Customer có Booking/SeatHold phù hợp. |
| Hậu điều kiện thành công | Promotion được lưu hoặc discount snapshot được áp dụng đúng một lần. |
| Hậu điều kiện thất bại | Không vượt quota và không giảm sai total. |
| Mức ưu tiên | SHOULD |
| Liên kết | FR-PROMO-001..002; FR-BOOK-006 |

### Luồng quản lý

1. Actor có quyền tạo Promotion với code, phạm vi tenant/toàn nền tảng, loại giảm, giá trị, thời hạn, quota và điều kiện.
2. Hệ thống kiểm tra code, phạm vi, thời gian, giá trị và quyền actor.
3. Hệ thống lưu Promotion ở trạng thái phù hợp và audit thay đổi.
4. Actor có thể cập nhật/deactivate Promotion nếu không phá vỡ discount snapshot đã dùng.

### Luồng áp dụng

1. Customer nhập/chọn mã Promotion trong quá trình tạo Booking.
2. Hệ thống xác minh trạng thái, thời hạn, phạm vi, điều kiện, quota và lịch sử sử dụng.
3. Hệ thống tính discount phía server và trả lại Booking summary.
4. Khi Booking được tạo/xác nhận, hệ thống lưu Promotion redemption và discount snapshot theo cơ chế chống vượt quota.

### Ngoại lệ

- Mã không tồn tại, hết hạn hoặc không đúng phạm vi: không áp dụng và trả lý do phù hợp.
- Quota vừa hết do request đồng thời: chỉ các request commit hợp lệ được hưởng discount.
- Client gửi discount/total tự tính: bỏ qua và tính lại phía server.
- Booking bị hủy/hết hạn: việc trả quota tuân theo policy Promotion đã được duyệt.

## UC-REVIEW-01 — Tạo và cập nhật Review

| Thuộc tính | Nội dung |
|---|---|
| Mục tiêu | Customer đánh giá chuyến đã sử dụng đúng một lần. |
| Actor chính | Customer |
| Tiền điều kiện | Customer sở hữu Ticket USED; còn trong thời hạn Review. |
| Hậu điều kiện thành công | Review được tạo/cập nhật và liên kết Ticket. |
| Hậu điều kiện thất bại | Không tạo Review trùng hoặc cho Ticket không hợp lệ. |
| Mức ưu tiên | SHOULD |
| Liên kết | FR-REVIEW-001; BR-REVIEW-001 |

### Luồng chính

1. Customer mở Ticket đã sử dụng.
2. Hệ thống kiểm tra ownership, Ticket state và thời hạn Review.
3. Customer nhập rating và nội dung.
4. Hệ thống kiểm tra rating, độ dài và nội dung theo policy.
5. Hệ thống tạo Review gắn duy nhất với Ticket.
6. Trong thời hạn cho phép, Customer có thể cập nhật Review của mình.

### Ngoại lệ

- Ticket chưa USED, không thuộc Customer hoặc đã có Review khác: từ chối.
- Nội dung vi phạm giới hạn: trả validation/moderation result phù hợp.
- Hết thời hạn cập nhật: giữ Review cũ.

## UC-REVIEW-02 — Kiểm duyệt Review

| Thuộc tính | Nội dung |
|---|---|
| Mục tiêu | Ẩn/khôi phục Review vi phạm mà vẫn bảo toàn lịch sử. |
| Actor chính | Admin, Operator Staff có permission |
| Tiền điều kiện | Actor có quyền trong phạm vi Review. |
| Hậu điều kiện thành công | Review đổi trạng thái; moderator, reason và timestamp được lưu. |
| Hậu điều kiện thất bại | Review giữ nguyên và không bị xóa lịch sử. |
| Mức ưu tiên | SHOULD |
| Liên kết | FR-REVIEW-002; BR-REVIEW-002; BR-AUDIT-001 |

### Luồng chính

1. Actor tra cứu Review trong phạm vi được phép.
2. Actor chọn hành động ẩn/khôi phục và nhập reason bắt buộc.
3. Hệ thống kiểm tra permission và tenant scope.
4. Hệ thống cập nhật trạng thái mà không xóa nội dung lịch sử.
5. Hệ thống ghi moderator, reason, thời điểm và audit.

### Ngoại lệ

- Operator thao tác Review ngoài tenant: từ chối.
- Reason trống hoặc không hợp lệ: không thay đổi trạng thái.
- Request lặp: không tạo nhiều logical moderation action ngoài audit cần thiết.

## UC-NOTIF-01 — Xem và cấu hình Notification

| Thuộc tính | Nội dung |
|---|---|
| Mục tiêu | Cung cấp thông báo giao dịch đáng tin cậy và cho phép User cấu hình kênh tùy chọn. |
| Actor chính | User |
| Actor phụ | Notification Provider |
| Tiền điều kiện | User đã xác thực cho in-app/preferences; sự kiện giao dịch đã phát sinh cho delivery. |
| Hậu điều kiện thành công | Notification được lưu/hiển thị và DeliveryAttempt được theo dõi. |
| Hậu điều kiện thất bại | Giao dịch nghiệp vụ không rollback do lỗi Notification. |
| Liên kết | FR-NOTIF-001..003; NFR-REL-004 |

### Sự kiện bắt buộc tạo Notification

- Booking đã thanh toán.
- Ticket đã phát hành.
- Payment thất bại hoặc cần chờ xử lý.
- Ticket được đổi sang chuyến hoặc ghế mới.
- Trip thay đổi/hủy.
- Booking/Ticket bị hủy.
- Refund hoàn tất hoặc cần hỗ trợ.

### Luồng xem Notification

1. User mở trung tâm thông báo.
2. Hệ thống áp User identity và trả danh sách có phân trang.
3. User mở hoặc đánh dấu Notification đã đọc.
4. Hệ thống cập nhật read state theo cơ chế idempotent.

### Luồng cấu hình

1. User mở Notification preference.
2. Hệ thống trả các kênh có thể tùy chỉnh.
3. User bật/tắt kênh không bắt buộc.
4. Hệ thống ngăn tắt hoàn toàn thông báo giao dịch thiết yếu nếu policy yêu cầu.
5. Hệ thống lưu preference.

### Luồng gửi và ngoại lệ

1. Khi có sự kiện giao dịch, hệ thống tạo Notification bền vững trước khi gọi provider.
2. Hệ thống chọn kênh theo loại thông báo và preference.
3. DeliveryAttempt được tạo và gửi đến provider.
4. Thành công/thất bại được ghi nhận.
5. Lỗi tạm thời được retry có backoff và giới hạn.
6. Lỗi cuối cùng được ghi nhận/cảnh báo nhưng không đảo giao dịch đã commit.

[← Danh mục Use Case](./README.md)
