# Use Case: Thanh toán, hủy và đổi vé

## UC-PAY-01 — Thanh toán booking

| Thuộc tính | Nội dung |
|---|---|
| Mục tiêu | Xác nhận thanh toán và phát hành vé đúng một lần |
| Actor chính | Customer |
| Actor phụ | Payment Gateway |
| Kích hoạt | Customer chọn phương thức thanh toán cho booking |
| Service chịu trách nhiệm | Payment Service, Booking Service |
| Tiền điều kiện | Booking ở trạng thái `PENDING_PAYMENT` và chưa hết hạn |
| Hậu điều kiện thành công | Payment `SUCCEEDED`, Booking `PAID`, TripSeat `BOOKED`, Ticket `ISSUED` |
| Hậu điều kiện thất bại | Không phát hành vé; giao dịch được giữ ở trạng thái phù hợp để retry, bù trừ hoặc đối soát |

### Luồng chính

1. Customer chọn phương thức và yêu cầu tạo payment intent.
2. Payment Service nhận booking payment snapshot đã ký nội bộ và tạo Payment.
3. Customer hoàn tất thanh toán tại Payment Gateway.
4. Payment Gateway gửi webhook có chữ ký.
5. Payment Service xác minh và lưu kết quả theo cơ chế idempotent.
6. Payment Service phát sự kiện `PaymentSucceeded`.
7. Booking Service nhận event, xác nhận ghế và booking trong một transaction, sau đó tạo Ticket.
8. Notification Service gửi xác nhận; client truy vấn và hiển thị trạng thái cuối.

### Luồng thay thế và ngoại lệ

- Customer quay lại ứng dụng trước khi webhook đến: giao diện hiển thị `PROCESSING` và polling có giới hạn.
- Webhook lặp: hệ thống trả thành công nhưng không xử lý nghiệp vụ lần nữa.
- Số tiền hoặc chữ ký sai: hệ thống không xác nhận thanh toán và ghi security/operations event.
- Hold đã hết hạn và ghế không còn: hệ thống tạo yêu cầu hoàn tiền hoặc chuyển đối soát thủ công; tuyệt đối không bán trùng ghế.

## UC-CANCEL-01 — Hủy vé và hoàn tiền

| Thuộc tính | Nội dung |
|---|---|
| Mục tiêu | Hủy quyền sử dụng vé và hoàn đúng số tiền theo chính sách |
| Actor chính | Customer |
| Actor phụ | Payment Gateway |
| Kích hoạt | Customer yêu cầu hủy một hoặc nhiều Ticket |
| Service chịu trách nhiệm | Booking Service, Payment Service |
| Tiền điều kiện | Customer sở hữu Ticket; Ticket và Trip còn đủ điều kiện hủy |
| Hậu điều kiện thành công | Ticket bị hủy; Refund được tạo khi có số tiền phải hoàn; ghế được mở lại nếu còn bán được |
| Hậu điều kiện thất bại | Vé giữ nguyên trạng thái hoặc được ghi nhận chờ xử lý nếu provider đã nhận yêu cầu |

### Luồng chính

1. Customer chọn các Ticket muốn hủy.
2. Booking Service kiểm tra ownership, trạng thái, giờ khởi hành và policy snapshot.
3. Service trả preview gồm phí hủy và số tiền hoàn.
4. Customer xác nhận bằng idempotency key.
5. Booking Service hủy quyền sử dụng vé, cập nhật ghế nếu còn bán được và phát `RefundRequested`.
6. Payment Service thực hiện refund và phát kết quả.
7. Booking Service và Notification Service cập nhật trạng thái, sau đó thông báo Customer.

### Luồng thay thế và ngoại lệ

- Không đủ điều kiện: hệ thống không thay đổi dữ liệu và trả lý do.
- Payment Gateway lỗi: Ticket giữ trạng thái hủy; Refund ở `FAILED` hoặc `PROCESSING` để retry hay xử lý thủ công.
- Yêu cầu lặp: hệ thống trả cùng Refund và không hoàn tiền hai lần.

## UC-CHANGE-01 — Đổi vé

| Thuộc tính | Nội dung |
|---|---|
| Mục tiêu | Chuyển hành khách sang chuyến hoặc ghế mới mà không làm mất vé cũ khi quy trình thất bại |
| Actor chính | Customer |
| Kích hoạt | Customer chọn đổi một Ticket còn hiệu lực |
| Mức ưu tiên | SHOULD |
| Service chịu trách nhiệm | Booking Service, Payment Service |
| Tiền điều kiện | Ticket đủ điều kiện đổi; chuyến hoặc ghế mới còn khả dụng |
| Hậu điều kiện thành công | Ticket mới được phát hành và Ticket cũ bị hủy; chênh lệch tài chính đã được xử lý |
| Hậu điều kiện thất bại | Hold mới được giải phóng và Ticket cũ tiếp tục có hiệu lực, trừ trường hợp đã chuyển sang quy trình bù trừ được audit |

### Luồng chính

1. Customer chọn Ticket và chuyến hoặc ghế mới.
2. Booking Service kiểm tra policy và tạo hold cho ghế mới.
3. Service tính phí đổi và chênh lệch.
4. Customer xác nhận; hệ thống thu thêm hoặc hoàn phần chênh lệch khi cần.
5. Khi phần tài chính thành công, hệ thống phát hành Ticket mới và hủy Ticket cũ bằng transaction hoặc saga.

### Bù trừ

Nếu không hoàn thành đổi vé, hệ thống giải phóng hold mới và giữ nguyên Ticket cũ, trừ khi đã có quyết định bù trừ được ghi audit.

