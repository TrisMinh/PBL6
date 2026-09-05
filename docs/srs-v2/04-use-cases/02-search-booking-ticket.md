# 4.4.2. Nhóm Use Case — Tìm chuyến, Booking và Ticket

[← Danh mục Use Case](./README.md)

## UC-SEARCH-01 — Tìm và xem chuyến

| Thuộc tính | Nội dung |
|---|---|
| Mục tiêu | Tìm Trip phù hợp và xem đủ thông tin trước khi đặt. |
| Actor chính | Guest, Customer |
| Kích hoạt | Người dùng nhập tiêu chí tìm kiếm hoặc mở chi tiết Trip. |
| Tiền điều kiện | Dữ liệu Route/Trip đã được công bố. |
| Hậu điều kiện thành công | Danh sách hoặc chi tiết Trip được hiển thị. |
| Hậu điều kiện thất bại | Không thay đổi dữ liệu giao dịch. |
| Liên kết | FR-SEARCH-001..007; BR-TRIP-001 |

### Luồng chính

1. Người dùng chọn điểm đi, điểm đến, ngày đi và số hành khách.
2. Hệ thống kiểm tra ngày, cặp điểm và số hành khách.
3. Hệ thống trả các Trip còn khả năng bán phù hợp với tiêu chí.
4. Người dùng lọc theo giá, giờ đi, nhà xe, loại xe, điểm đón/trả, tiện nghi hoặc đánh giá.
5. Người dùng sắp xếp theo giá, giờ khởi hành, thời lượng hoặc đánh giá.
6. Người dùng mở chi tiết Trip.
7. Hệ thống hiển thị nhà xe, lịch trình, Bus, tiện nghi, điểm đón/trả, giá, policy và availability có thời điểm cập nhật.
8. Người dùng có thể chuyển sang bước chọn ghế.

### Luồng thay thế và ngoại lệ

- Không có Trip: trả danh sách rỗng và gợi ý đổi tiêu chí nếu có; không trả lỗi hệ thống.
- Ngày quá khứ hoặc điểm đi trùng điểm đến: trả validation error.
- Trang/bộ lọc không hợp lệ: áp giá trị mặc định hoặc trả lỗi theo hợp đồng.
- Availability đã cũ: vẫn có thể hiển thị nhưng phải kiểm tra lại khi tạo SeatHold.
- Dịch vụ phụ thuộc tạm lỗi: thông báo thử lại, không hiển thị dữ liệu sai như dữ liệu hiện thời.

## UC-BOOK-01 — Giữ ghế và tạo Booking

| Thuộc tính | Nội dung |
|---|---|
| Mục tiêu | Giữ toàn bộ ghế đã chọn và tạo một Booking chờ thanh toán. |
| Actor chính | Customer |
| Kích hoạt | Customer xác nhận các ghế đã chọn. |
| Tiền điều kiện | Customer đã đăng nhập; Trip còn bán; TripSeat đang hiển thị là khả dụng. |
| Hậu điều kiện thành công | Booking PENDING_PAYMENT; SeatHold/TripSeat được bảo toàn đến thời hạn thanh toán. |
| Hậu điều kiện thất bại | Không giữ thành công một phần và không tạo Booking ngoài ý muốn. |
| Liên kết | FR-BOOK-001..007; BR-SEAT-*; BR-BOOK-*; AC-SEAT-*; AC-BOOK-* |

### Luồng chính

1. Customer mở sơ đồ ghế của Trip.
2. Hệ thống trả TripSeat cùng trạng thái hiện thời và giá tham khảo.
3. Customer chọn một hoặc nhiều ghế tại client.
4. Client gửi yêu cầu giữ ghế kèm idempotency key.
5. Hệ thống khóa/kiểm tra toàn bộ TripSeat trong cùng phạm vi giao dịch.
6. Nếu tất cả ghế AVAILABLE, hệ thống tạo SeatHold ACTIVE, chuyển ghế sang HELD và trả `holdToken`, `expiresAt`, giá/policy snapshot.
7. Customer nhập một Passenger cho mỗi ghế và chọn điểm đón/trả hợp lệ.
8. Client gửi yêu cầu tạo Booking từ hold còn hiệu lực kèm idempotency key.
9. Hệ thống xác minh ownership, hold, số Passenger, stop và thời hạn.
10. Hệ thống tính lại subtotal, discount, fee và total phía server.
11. Hệ thống consume hold và tạo một Booking PENDING_PAYMENT.
12. Hệ thống trả Booking summary, total chính thức và thời hạn thanh toán.

### Luồng thay thế và ngoại lệ

- Một ghế không còn AVAILABLE tại commit: rollback toàn bộ; trả `SEAT_UNAVAILABLE` và danh sách ghế ảnh hưởng.
- Hold hết hạn: trả `SEAT_HOLD_EXPIRED`, không tạo Booking và giải phóng ghế hợp lệ.
- Số Passenger khác số ghế: trả validation error; chưa consume hold.
- Điểm đón/trả không thuộc Trip hoặc thứ tự không hợp lệ: từ chối.
- Idempotency key trùng cùng payload: trả SeatHold/Booking đã tạo.
- Cùng key nhưng payload khác: trả `IDEMPOTENCY_CONFLICT`.
- Client gửi total khác: bỏ qua total client và dùng kết quả server.

### Yêu cầu đồng thời

Khi nhiều Customer cùng giữ một TripSeat, đúng một request được phép tạo SeatHold hợp lệ. Kết quả này phải được bảo đảm bởi transaction/ràng buộc bền vững; cache không phải nguồn quyết định cuối.

### Sơ đồ liên quan

- [Activity Booking](../../diagrams/subdiagrams/processes/activity-booking.html)
- [Sequence SeatHold](../../diagrams/subdiagrams/sequences/sequence-seat-hold.html)
- [Sequence Create Booking](../../diagrams/subdiagrams/sequences/sequence-create-booking.html)
- [State TripSeat và SeatHold](../../diagrams/subdiagrams/states/state-trip-seat-hold.html)

## UC-BOOK-02 — Xem Booking và Ticket của tôi

| Thuộc tính | Nội dung |
|---|---|
| Mục tiêu | Cho phép Customer tra cứu lịch sử và trạng thái Booking/Ticket của mình. |
| Actor chính | Customer |
| Kích hoạt | Customer mở danh sách hoặc chi tiết Booking/Ticket. |
| Tiền điều kiện | Customer đã xác thực. |
| Hậu điều kiện thành công | Dữ liệu thuộc Customer được hiển thị đúng trạng thái. |
| Hậu điều kiện thất bại | Không tiết lộ dữ liệu của Customer khác. |
| Liên kết | FR-BOOK-008; FR-TICKET-002; AUTHZ-004 |

### Luồng chính

1. Customer mở mục Booking/Vé của tôi.
2. Hệ thống áp customer ID từ identity context.
3. Hệ thống trả danh sách có phân trang và nhóm theo trạng thái sắp đi, đã dùng, đã hủy hoặc đã hoàn tiền.
4. Customer mở một Booking/Ticket.
5. Hệ thống kiểm tra ownership và trả thông tin Trip, Passenger, ghế, điểm đón/trả, giá, Payment/Refund summary và Ticket.
6. Giao diện chỉ hiển thị hành động còn hợp lệ như thanh toán tiếp, hủy, đổi hoặc xem QR.

### Ngoại lệ

- ID không thuộc Customer: trả 404/403 theo policy, không tiết lộ dữ liệu.
- Booking chưa đồng bộ trạng thái cuối: hiển thị trạng thái đang xử lý và thời điểm cập nhật.
- Ticket đã hủy/hoàn: QR không được trình bày như vé còn hiệu lực.

## UC-TICKET-01 — Xem và sử dụng vé điện tử

| Thuộc tính | Nội dung |
|---|---|
| Mục tiêu | Customer truy cập Ticket điện tử đủ thông tin để sử dụng và được kiểm tra. |
| Actor chính | Customer |
| Kích hoạt | Customer mở một Ticket đã phát hành. |
| Tiền điều kiện | Customer sở hữu Ticket; Ticket tồn tại. |
| Hậu điều kiện thành công | Ticket và QR/mã thay thế được hiển thị đúng trạng thái. |
| Hậu điều kiện thất bại | Không lộ Ticket hoặc PII ngoài quyền. |
| Liên kết | FR-TICKET-001..003; BR-TICKET-001 |

### Luồng chính

1. Customer chọn Ticket từ Booking của mình.
2. Hệ thống kiểm tra ownership.
3. Hệ thống hiển thị public code, Passenger, nhà xe, Trip, giờ, điểm đón/trả, ghế, giá snapshot và trạng thái.
4. Hệ thống cung cấp QR token an toàn và mã chữ thay thế để Driver nhập thủ công.
5. Nếu client đã tải Ticket và policy cho phép, Mobile có thể hiển thị bản đã lưu khi mạng tạm mất.
6. Khi có mạng trở lại, client đồng bộ trạng thái trước khi cho rằng Ticket còn hiệu lực.

### Ngoại lệ

- Ticket CANCELLED/REFUNDED/USED: hiển thị rõ trạng thái và không trình bày QR như Ticket ISSUED.
- Token QR hết hiệu lực hoặc bị thay thế: client phải tải lại từ server.
- Customer không sở hữu Ticket: từ chối mà không tiết lộ thông tin.

[← Danh mục Use Case](./README.md)
