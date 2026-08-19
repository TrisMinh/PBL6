# Quy tắc nghiệp vụ

## 1. Ghế và SeatHold

| ID | Quy tắc |
|---|---|
| BR-SEAT-001 | Một ghế vật lý có thể được bán ở nhiều chuyến khác nhau; tính duy nhất áp dụng trên `(tripId, seatId)`. |
| BR-SEAT-002 | `SELECTED` là trạng thái cục bộ ở client, không được lưu làm trạng thái TripSeat. |
| BR-SEAT-003 | TripSeat chỉ có `AVAILABLE`, `HELD`, `BOOKED`, `DISABLED`. |
| BR-SEAT-004 | Một TripSeat chỉ có tối đa một SeatHold `ACTIVE` hoặc một Ticket còn hiệu lực. |
| BR-SEAT-005 | Giữ nhiều ghế phải atomic: tất cả thành công hoặc tất cả thất bại. |
| BR-SEAT-006 | SeatHold mặc định hết hạn sau 10 phút; thời hạn chính xác trả về bằng `expiresAt`. |
| BR-SEAT-007 | Customer chỉ có một active hold cho cùng TripSeat; request lặp cùng idempotency key trả cùng kết quả. |
| BR-SEAT-008 | Ghế hết hạn được giải phóng bằng job và cũng phải được kiểm tra lazy trong request kế tiếp. |
| BR-SEAT-009 | Redis có thể hỗ trợ TTL nhưng Booking DB constraint/transaction là nguồn đảm bảo không double-book. |
| BR-SEAT-010 | Sau khi Trip đã publish, sơ đồ ghế cho chuyến là snapshot; thay đổi Bus template không tự đổi TripSeat. |

## 2. Booking và giá

| ID | Quy tắc |
|---|---|
| BR-BOOK-001 | Chỉ Customer đã đăng nhập mới được tạo hold và booking. |
| BR-BOOK-002 | Một SeatHold chỉ được consume bởi tối đa một Booking. |
| BR-BOOK-003 | Mỗi ghế trong Booking phải có đúng một Passenger và sau thanh toán có đúng một Ticket. |
| BR-BOOK-004 | Giá được tính tại server từ fare snapshot, fee và promotion; số tiền client gửi chỉ mang tính tham khảo. |
| BR-BOOK-005 | Booking lưu subtotal, discount, fee, total, currency và phiên bản policy tại thời điểm xác nhận. |
| BR-BOOK-006 | Tiền VND lưu bằng số nguyên đồng hoặc decimal chính xác, không dùng float/double. |
| BR-BOOK-007 | Booking `PENDING_PAYMENT` hết hạn mà chưa có payment hợp lệ chuyển `EXPIRED`. |
| BR-BOOK-008 | Booking `PAID` không được sửa Passenger/TripSeat trực tiếp; thay đổi phải qua use case đổi vé. |
| BR-BOOK-009 | Customer không được đặt Trip đã `DEPARTED` hoặc trạng thái sau đó. |
| BR-BOOK-010 | Thao tác tạo booking phải nhận `Idempotency-Key`; cùng key và payload trả cùng booking, payload khác trả conflict. |

## 3. Payment và Refund

| ID | Quy tắc |
|---|---|
| BR-PAY-001 | Chỉ Payment Service giao tiếp với Payment Gateway và sở hữu trạng thái payment/refund. |
| BR-PAY-002 | Booking chỉ chuyển `PAID` sau `PaymentSucceeded` đã được xác minh. |
| BR-PAY-003 | Provider transaction ID phải duy nhất; webhook lặp là no-op sau lần xử lý đầu. |
| BR-PAY-004 | Webhook amount và currency phải khớp payment intent; không khớp chuyển sang review, không phát `PaymentSucceeded`. |
| BR-PAY-005 | Callback không có chữ ký hợp lệ bị từ chối và ghi security log đã loại bỏ dữ liệu nhạy cảm. |
| BR-PAY-006 | Payment thành công trễ không được chiếm ghế đã bán; hệ thống tạo compensation refund/manual case. |
| BR-PAY-007 | Tổng refund thành công không vượt payment amount thành công. |
| BR-PAY-008 | Refund phải có reason, actor/request source và idempotency key. |
| BR-PAY-009 | Không lưu PAN, CVV hoặc dữ liệu thẻ nhạy cảm; chỉ lưu token/mã tham chiếu provider cần thiết. |
| BR-PAY-010 | Client redirect không phải bằng chứng thanh toán; webhook/reconciliation mới là nguồn xác nhận. |

## 4. Hủy và đổi vé

| ID | Quy tắc |
|---|---|
| BR-CANCEL-001 | Policy hủy/đổi do Operator cấu hình và được snapshot vào Booking/Ticket. |
| BR-CANCEL-002 | Hệ thống hiển thị phí và số tiền hoàn trước bước xác nhận cuối. |
| BR-CANCEL-003 | Vé đã `CHECKED_IN`, `USED`, `CANCELLED` hoặc `REFUNDED` không được customer hủy. |
| BR-CANCEL-004 | Customer không được hủy sau giờ khởi hành; Operator/Admin chỉ can thiệp bằng workflow có audit. |
| BR-CANCEL-005 | Ghế chỉ trở về `AVAILABLE` khi việc hủy có hiệu lực và Trip vẫn cho phép bán. |
| BR-CANCEL-006 | Đổi vé phải giữ được ghế mới trước khi hủy quyền trên ghế cũ. |
| BR-CANCEL-007 | Nếu đổi vé thất bại giữa chừng, hệ thống phải giữ nguyên vé cũ hoặc chạy compensation rõ ràng. |
| BR-CANCEL-008 | Trip bị nhà xe hủy tạo refund theo chính sách hủy bởi nhà xe, không áp dụng phí hủy của Customer. |

## 5. Trip và vận hành

| ID | Quy tắc |
|---|---|
| BR-TRIP-001 | Chỉ Trip `SCHEDULED` đã đủ route, bus, driver, schedule, fare và seat snapshot mới được publish để bán. |
| BR-TRIP-002 | Cùng một bus hoặc driver không được có assignment có thời gian chồng lấn, gồm buffer cấu hình. |
| BR-TRIP-003 | Driver chỉ cập nhật Trip được phân công và chỉ theo transition được phép. |
| BR-TRIP-004 | Trip có booking/ticket không được hard delete; chỉ được cancel. |
| BR-TRIP-005 | Thay đổi giờ/điểm đón/trả sau khi đã bán vé phải phát event và thông báo khách bị ảnh hưởng. |
| BR-TRIP-006 | Trip cancellation phải idempotent và phát đúng một logical cancellation event. |

## 6. Ticket, check-in và review

| ID | Quy tắc |
|---|---|
| BR-TICKET-001 | Mỗi Ticket có mã công khai không tuần tự dễ đoán và QR token có chữ ký hoặc ngẫu nhiên đủ mạnh. |
| BR-TICKET-002 | Check-in chỉ hợp lệ cho đúng Trip và Ticket có trạng thái `ISSUED`. |
| BR-TICKET-003 | Scan lặp cùng Ticket trả kết quả “đã check-in” và không tạo check-in thứ hai. |
| BR-TICKET-004 | Ticket chuyển `USED` khi Trip hoàn thành nếu đã check-in; quy tắc no-show được báo cáo riêng. |
| BR-REVIEW-001 | Một Ticket `USED` được tạo tối đa một Review bởi Customer sở hữu ticket. |
| BR-REVIEW-002 | Ẩn review không xóa lịch sử; phải lưu moderator, reason và timestamp. |

## 7. Tenant, dữ liệu và audit

| ID | Quy tắc |
|---|---|
| BR-TENANT-001 | Dữ liệu Operator phải có `organizationId` hoặc nguồn ownership tương đương. |
| BR-TENANT-002 | Operator Staff không được truyền organization tùy ý để vượt tenant; server lấy scope từ identity context. |
| BR-DATA-001 | ID nghiệp vụ dùng UUID/ULID hoặc định dạng không xung đột giữa service. |
| BR-DATA-002 | Mọi timestamp lưu UTC và API dùng ISO-8601 có timezone. |
| BR-DATA-003 | Entity giao dịch có `createdAt`, `updatedAt` và version/concurrency token khi cần. |
| BR-DATA-004 | User/xe/tài xế/tuyến đã được tham chiếu được deactivate hoặc soft delete. |
| BR-AUDIT-001 | Thay đổi role, tenant membership, trip, giá/policy, booking override, payment/refund và check-in phải có audit. |
| BR-AUDIT-002 | Audit record là append-only đối với actor thông thường. |
