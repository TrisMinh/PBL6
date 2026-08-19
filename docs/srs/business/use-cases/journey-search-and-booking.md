# Use Case: Tìm chuyến và đặt vé

## UC-SEARCH-01 — Tìm và xem chuyến

| Thuộc tính | Nội dung |
|---|---|
| Mục tiêu | Tìm chuyến phù hợp và xem tình trạng ghế trước khi đặt |
| Actor chính | Guest, Customer |
| Kích hoạt | Người dùng nhập tiêu chí tìm kiếm |
| Service chịu trách nhiệm | Transport Service, Booking read model |
| Tiền điều kiện | Dữ liệu tuyến và chuyến đã được công bố |
| Hậu điều kiện thành công | Danh sách chuyến hoặc chi tiết chuyến được hiển thị |
| Hậu điều kiện thất bại | Không làm thay đổi dữ liệu nghiệp vụ |

### Luồng chính

1. Người dùng chọn điểm đi, điểm đến, ngày và số hành khách.
2. API Gateway kiểm tra định dạng và chuyển yêu cầu đến Transport Service.
3. Service trả chuyến phù hợp, chính sách, giá cơ bản và bản chụp tình trạng ghế.
4. Người dùng lọc, sắp xếp hoặc chuyển trang kết quả.
5. Người dùng mở chi tiết chuyến và xem sơ đồ ghế.

### Luồng thay thế và ngoại lệ

- Không có chuyến: hệ thống trả danh sách rỗng và có thể gợi ý đổi ngày; đây không phải lỗi hệ thống.
- Ngày trong quá khứ hoặc điểm đi trùng điểm đến: hệ thống trả lỗi dữ liệu đầu vào.
- Dữ liệu tình trạng ghế đã cũ: giao diện vẫn có thể hiển thị, nhưng yêu cầu giữ ghế phải kiểm tra lại dữ liệu hiện thời.

## UC-BOOK-01 — Giữ ghế và tạo booking

| Thuộc tính | Nội dung |
|---|---|
| Mục tiêu | Giữ toàn bộ ghế đã chọn và tạo booking chờ thanh toán |
| Actor chính | Customer |
| Kích hoạt | Customer xác nhận các ghế đã chọn |
| Service chịu trách nhiệm | Booking Service |
| Tiền điều kiện | Customer đã đăng nhập; Trip còn mở bán; các ghế đang hiển thị là khả dụng |
| Hậu điều kiện thành công | Booking ở trạng thái `PENDING_PAYMENT`; toàn bộ TripSeat ở trạng thái `HELD` đến `expiresAt` |
| Hậu điều kiện thất bại | Không ghế nào trong yêu cầu được giữ và không booking mới nào được tạo |

### Luồng chính

1. Customer chọn một hoặc nhiều ghế trên giao diện.
2. Client gửi yêu cầu giữ ghế kèm `Idempotency-Key`.
3. Booking Service khóa và kiểm tra toàn bộ TripSeat trong cùng một transaction.
4. Service tạo SeatHold cho toàn bộ ghế, chụp giá tại thời điểm giữ và trả thời hạn giữ.
5. Customer nhập một Passenger cho mỗi ghế và chọn điểm đón, điểm trả.
6. Client gửi yêu cầu tạo booking với `holdToken` và idempotency key.
7. Service kiểm tra hold còn hiệu lực, tính lại tổng tiền và tạo Booking.
8. Service trả booking summary và thời hạn thanh toán.

### Luồng thay thế và ngoại lệ

- Một ghế không còn khả dụng: hệ thống rollback toàn bộ, trả `SEAT_UNAVAILABLE` và danh sách ghế lỗi.
- Hold hết hạn: hệ thống trả `SEAT_HOLD_EXPIRED` và không tạo booking.
- Số Passenger không khớp số ghế: hệ thống trả lỗi dữ liệu đầu vào.
- Yêu cầu lặp cùng idempotency key: hệ thống trả lại cùng SeatHold hoặc Booking, không tạo bản ghi mới.

> “Giữ ghế nguyên khối” có nghĩa là giữ được tất cả ghế trong một yêu cầu hoặc không giữ ghế nào; hệ thống không được chỉ giữ một phần mà người dùng không biết.

