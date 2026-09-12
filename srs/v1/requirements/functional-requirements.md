# Yêu cầu chức năng

Mỗi yêu cầu dưới đây là một hành vi quan sát được. Quy tắc chi tiết nằm trong [Quy tắc nghiệp vụ](../business/business-rules.md); luồng chính nằm trong [Danh mục Use Case](../business/use-cases/README.md).

## 1. Identity và tài khoản

| ID | Mức | Yêu cầu |
|---|---|---|
| FR-IAM-001 | MUST | Guest có thể đăng ký bằng họ tên, email, số điện thoại và mật khẩu; hệ thống kiểm tra định dạng và tính duy nhất. |
| FR-IAM-002 | MUST | Hệ thống gửi và xác minh email hoặc OTP trước khi kích hoạt đầy đủ tài khoản Customer. |
| FR-IAM-003 | MUST | User có thể đăng nhập bằng email hoặc số điện thoại và nhận access/refresh token theo chính sách bảo mật. |
| FR-IAM-004 | MUST | User có thể refresh phiên và logout; logout phải thu hồi refresh token hiện tại. |
| FR-IAM-005 | MUST | User có thể yêu cầu reset mật khẩu bằng token/OTP có thời hạn mà không làm lộ tài khoản có tồn tại hay không. |
| FR-IAM-006 | MUST | User có thể xem và cập nhật hồ sơ; thay đổi email/số điện thoại phải xác minh lại. |
| FR-IAM-007 | MUST | Hệ thống khóa tạm đăng nhập khi vượt ngưỡng thất bại và ghi audit cho sự kiện bảo mật. |
| FR-IAM-008 | MUST | Admin có thể khóa/mở khóa user và gán role phù hợp; thay đổi phải có audit. |
| FR-IAM-009 | MUST | Admin có thể tạo Organization và membership cho Operator Staff/Driver. |

## 2. Tìm kiếm và xem chuyến

| ID | Mức | Yêu cầu |
|---|---|---|
| FR-SEARCH-001 | MUST | Guest/Customer có thể tìm chuyến theo điểm đi, điểm đến, ngày đi và số hành khách hợp lệ. |
| FR-SEARCH-002 | MUST | Kết quả chỉ gồm chuyến `SCHEDULED/BOARDING` còn khả năng bán, có phân trang và tổng số kết quả. |
| FR-SEARCH-003 | MUST | Người dùng có thể lọc theo khoảng giá, giờ đi, nhà xe, loại xe, điểm đón/trả, tiện nghi và đánh giá. |
| FR-SEARCH-004 | MUST | Người dùng có thể sắp xếp theo giá, giờ khởi hành, thời lượng và đánh giá. |
| FR-SEARCH-005 | MUST | Chi tiết chuyến hiển thị tổ chức nhà xe, lịch trình, xe, tiện nghi, điểm đón/trả, giá và policy snapshot áp dụng. |
| FR-SEARCH-006 | MUST | Số ghế khả dụng hiển thị phải kèm thời điểm cập nhật và được xác minh lại khi tạo hold. |
| FR-SEARCH-007 | SHOULD | Hệ thống ghi nhận truy vấn tìm kiếm ẩn danh hóa để phục vụ báo cáo, không lưu dữ liệu nhạy cảm không cần thiết. |

## 3. Ghế, giữ ghế và booking

| ID | Mức | Yêu cầu |
|---|---|---|
| FR-BOOK-001 | MUST | Customer đã đăng nhập có thể xem `TripSeat` và trạng thái khả dụng của một chuyến. |
| FR-BOOK-002 | MUST | Customer có thể yêu cầu giữ một hoặc nhiều ghế; hệ thống phải giữ được toàn bộ hoặc không giữ ghế nào, sau đó trả `holdToken`, `expiresAt` và giá tại thời điểm giữ. |
| FR-BOOK-003 | MUST | Hệ thống từ chối toàn bộ yêu cầu nếu bất kỳ ghế nào không còn khả dụng tại thời điểm commit. |
| FR-BOOK-004 | MUST | Customer nhập một Passenger cho mỗi ghế; các trường bắt buộc được kiểm tra theo policy của chuyến. |
| FR-BOOK-005 | MUST | Customer có thể tạo đúng một Booking từ SeatHold còn hiệu lực; thao tác hỗ trợ idempotency. |
| FR-BOOK-006 | MUST | Backend tự tính subtotal, discount, fee và total; client không được quyết định tổng tiền. |
| FR-BOOK-007 | MUST | SeatHold/Booking chưa thanh toán hết hạn được chuyển trạng thái và giải phóng ghế tự động. |
| FR-BOOK-008 | MUST | Customer có thể xem booking/vé sắp đi, đã dùng, bị hủy hoặc hoàn tiền của chính mình. |
| FR-BOOK-009 | MUST | Customer có thể hủy toàn booking hoặc vé đủ điều kiện; hệ thống hiển thị phí và số tiền hoàn trước khi xác nhận. |
| FR-BOOK-010 | SHOULD | Customer có thể đổi ngày/chuyến/ghế theo policy; hệ thống xử lý chênh lệch giá và không làm mất vé cũ trước khi giữ được ghế mới. |
| FR-BOOK-011 | MUST | Operator có thể tra cứu booking/manifest trong tenant và không được xem booking của tenant khác. |

## 4. Thanh toán và hoàn tiền

| ID | Mức | Yêu cầu |
|---|---|---|
| FR-PAY-001 | MUST | Customer có thể tạo payment intent cho Booking `PENDING_PAYMENT` còn hiệu lực. |
| FR-PAY-002 | MUST | Payment Service gửi request đến provider với mã tham chiếu duy nhất, amount, currency và callback URL. |
| FR-PAY-003 | MUST | Payment Service xác minh chữ ký, provider, transaction ID, amount và currency trước khi chấp nhận webhook. |
| FR-PAY-004 | MUST | Webhook lặp không được tạo thêm payment, ticket hoặc thay đổi trạng thái lần thứ hai. |
| FR-PAY-005 | MUST | Khi payment hợp lệ thành công, Booking Service phải cập nhật booking, ghế và ticket trong cùng một giao dịch để không tạo trạng thái dở dang. |
| FR-PAY-006 | MUST | Payment thất bại/hủy không được chuyển Booking sang `PAID`; ghế được giữ đến hết hạn hiện tại hoặc giải phóng theo rule. |
| FR-PAY-007 | MUST | Payment thành công trễ nhưng booking không thể xác nhận phải tạo compensation refund hoặc case xử lý thủ công. |
| FR-PAY-008 | MUST | Hệ thống tạo và theo dõi Refund; refund lặp phải idempotent. |
| FR-PAY-009 | MUST | Admin/Operator Finance có thể tra cứu payment/refund theo phạm vi quyền và mã giao dịch. |
| FR-PAY-010 | SHOULD | Payment Service hỗ trợ job đối soát các transaction chưa có kết quả cuối cùng. |

## 5. Vé và check-in

| ID | Mức | Yêu cầu |
|---|---|---|
| FR-TICKET-001 | MUST | Mỗi Passenger/TripSeat của Booking `PAID` có đúng một Ticket được phát hành. |
| FR-TICKET-002 | MUST | Ticket hiển thị mã vé, hành khách, nhà xe, chuyến, điểm đón/trả, ghế, giá snapshot, trạng thái và QR. |
| FR-TICKET-003 | MUST | QR chứa token ngẫu nhiên hoặc có chữ ký; không chứa PII dạng rõ không cần thiết. |
| FR-TICKET-004 | MUST | Driver/Operator được phân quyền có thể scan hoặc nhập mã để kiểm tra vé. |
| FR-TICKET-005 | MUST | Check-in là idempotent; vé đã hủy/refund/sai chuyến phải bị từ chối với lý do rõ ràng. |
| FR-TICKET-006 | MUST | Hệ thống ghi người check-in, thời điểm, chuyến và kết quả vào audit nghiệp vụ. |

## 6. Vận hành nhà xe

| ID | Mức | Yêu cầu |
|---|---|---|
| FR-OPS-001 | MUST | Operator Staff có permission phù hợp có thể cập nhật thông tin Organization của mình. |
| FR-OPS-002 | MUST | Operator có thể tạo/cập nhật/deactivate xe và sơ đồ ghế; biển số duy nhất trong phạm vi phù hợp. |
| FR-OPS-003 | MUST | Operator có thể tạo/cập nhật/deactivate DriverProfile và kiểm tra ngày hết hạn giấy phép. |
| FR-OPS-004 | MUST | Operator có thể quản lý route, stop, thứ tự dừng và thời gian dự kiến. |
| FR-OPS-005 | MUST | Operator có thể tạo draft trip, phân xe/tài xế, định giá và publish chuyến. |
| FR-OPS-006 | MUST | Khi publish, hệ thống kiểm tra xung đột lịch xe/tài xế và tạo snapshot ghế cho Booking Service. |
| FR-OPS-007 | MUST | Operator/Driver được phép có thể chuyển trạng thái Trip theo quy tắc chuyển trạng thái hợp lệ. |
| FR-OPS-008 | MUST | Hủy Trip có vé đã bán phải phát event để hủy vé, khởi tạo refund và gửi thông báo. |
| FR-OPS-009 | MUST | Dữ liệu xe/tài xế/tuyến đã được tham chiếu không được hard delete. |
| FR-OPS-010 | MUST | Driver xem được assignment và manifest tối thiểu của chuyến được phân công. |

## 7. Promotion, review và notification

| ID | Mức | Yêu cầu |
|---|---|---|
| FR-PROMO-001 | SHOULD | Admin/Operator có quyền có thể tạo promotion với phạm vi, thời hạn, quota và điều kiện sử dụng. |
| FR-PROMO-002 | SHOULD | Booking Service kiểm tra promotion ở server, ngăn vượt quota và lưu discount snapshot. |
| FR-REVIEW-001 | SHOULD | Customer chỉ có thể tạo một review cho Ticket đã `USED`; có thể cập nhật trong thời hạn cấu hình. |
| FR-REVIEW-002 | SHOULD | Admin/Operator có thể ẩn review vi phạm và lưu lý do/audit. |
| FR-NOTIF-001 | MUST | Hệ thống tạo notification cho booking paid, ticket issued, payment failed, trip changed/cancelled, booking cancelled và refund completed. |
| FR-NOTIF-002 | MUST | Notification lỗi được retry có giới hạn và không làm rollback giao dịch nghiệp vụ. |
| FR-NOTIF-003 | SHOULD | User có thể cấu hình kênh nhận thông báo không bắt buộc; thông báo giao dịch thiết yếu không được tắt hoàn toàn. |

## 8. Admin và báo cáo

| ID | Mức | Yêu cầu |
|---|---|---|
| FR-ADMIN-001 | MUST | Admin quản lý Organization, User, role, trạng thái tài khoản và tenant membership. |
| FR-ADMIN-002 | MUST | Admin tra cứu Booking, Payment, Refund và audit bằng ID hoặc mã giao dịch nhưng không được sửa lịch sử bất biến. |
| FR-ADMIN-003 | SHOULD | Admin quản lý khiếu nại với trạng thái, người xử lý và kết quả. |
| FR-REPORT-001 | MUST | Admin xem doanh thu gross/net, booking, refund và occupancy theo khoảng thời gian. |
| FR-REPORT-002 | MUST | Operator xem báo cáo giới hạn theo tenant; định nghĩa metric và timezone phải hiển thị. |
| FR-REPORT-003 | SHOULD | Người có quyền có thể export CSV; export lớn chạy bất đồng bộ. |
