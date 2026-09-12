# Use Case: Vận hành chuyến

## UC-OPS-01 — Tạo và phát hành chuyến

| Thuộc tính | Nội dung |
|---|---|
| Mục tiêu | Công bố một chuyến hợp lệ và sẵn sàng mở bán |
| Actor chính | Operator Scheduler |
| Kích hoạt | Staff xác nhận phát hành Trip nháp |
| Service chịu trách nhiệm | Transport Service, Booking Service |
| Tiền điều kiện | Route, Bus, Driver, lịch chạy, giá và chính sách hợp lệ trong tenant |
| Hậu điều kiện thành công | Trip `SCHEDULED`; kho ghế của Booking Service sẵn sàng trước khi chuyến được đánh dấu có thể bán |
| Hậu điều kiện thất bại | Trip không được mở bán |

### Luồng chính

1. Staff tạo draft Trip, chọn Route, Bus, Driver, thời gian, fare và policy.
2. Transport Service kiểm tra tenant, dữ liệu bắt buộc, license và xung đột lịch.
3. Staff xác nhận phát hành.
4. Transport Service chuyển Trip sang `SCHEDULED` và phát `TripPublished` chứa snapshot cần thiết.
5. Booking Service tạo TripSnapshot và TripSeat.
6. Khi projection sẵn sàng, chuyến xuất hiện trong tìm kiếm.

### Luồng thay thế và ngoại lệ

- Xe hoặc tài xế trùng lịch hay không còn active: hệ thống từ chối phát hành.
- Booking Service chưa tạo được snapshot: event được retry; Trip chưa được đánh dấu có thể bán cho đến khi đồng bộ thành công.

## UC-DRIVER-01 — Check-in hành khách

| Thuộc tính | Nội dung |
|---|---|
| Mục tiêu | Xác nhận một Ticket hợp lệ đã lên đúng chuyến |
| Actor chính | Driver, Operator Operations |
| Kích hoạt | Actor quét QR hoặc nhập mã vé |
| Service chịu trách nhiệm | Booking Service |
| Tiền điều kiện | Actor được phân công hoặc có quyền vận hành Trip |
| Hậu điều kiện thành công | Ticket chuyển từ `ISSUED` sang `CHECKED_IN`; thao tác được audit |
| Hậu điều kiện thất bại | Ticket giữ nguyên trạng thái |

### Luồng chính

1. Actor mở Trip được phân công hoặc thuộc phạm vi được phép.
2. Actor quét QR hoặc nhập mã vé.
3. Service kiểm tra quyền, Trip và trạng thái Ticket.
4. Service chuyển Ticket từ `ISSUED` sang `CHECKED_IN` và ghi audit.
5. Giao diện hiển thị thông tin hành khách và ghế tối thiểu cần thiết.

### Luồng thay thế và ngoại lệ

- Sai chuyến, vé đã hủy/hoàn tiền hoặc QR không hợp lệ: hệ thống từ chối và hiển thị lý do.
- Quét lặp: hệ thống trả trạng thái đã check-in và thời điểm thực hiện trước đó.

## UC-TRIP-01 — Hủy chuyến có vé đã bán

| Thuộc tính | Nội dung |
|---|---|
| Mục tiêu | Dừng chuyến, vô hiệu hóa vé liên quan và khởi tạo hoàn tiền an toàn |
| Actor chính | Operator Operations, Admin |
| Actor phụ | Payment Gateway, Notification Provider |
| Kích hoạt | Actor xác nhận hủy Trip và cung cấp lý do |
| Service chịu trách nhiệm | Transport, Booking, Payment, Notification |
| Tiền điều kiện | Actor có quyền trên Trip; Trip chưa hoàn thành hoặc đã hủy |
| Hậu điều kiện thành công | Trip `CANCELLED`; Ticket bị ảnh hưởng không còn sử dụng được; Refund được tạo theo chính sách |
| Hậu điều kiện thất bại | Không hủy một phần âm thầm; lỗi được retry hoặc chuyển xử lý thủ công có audit |

### Luồng chính

1. Actor nhập lý do và xác nhận hủy Trip.
2. Transport Service kiểm tra quyền và chuyển Trip sang `CANCELLED` theo cơ chế idempotent.
3. Transport Service phát `TripCancelled`.
4. Booking Service hủy các Ticket hoặc Booking bị ảnh hưởng và phát `RefundRequested` cho khoản đủ điều kiện.
5. Payment Service xử lý Refund.
6. Notification Service thông báo Customer; Reporting Service cập nhật projection.

