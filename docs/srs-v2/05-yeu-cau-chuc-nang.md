# 5. Yêu cầu chức năng

[← Chương 4](./04-use-cases/README.md) · [Mục lục](./README.md) · [Chương 6 →](./06-yeu-cau-trang-thai.md)

Mỗi FR dưới đây mô tả một hành vi quan sát được. Luồng và ngoại lệ nằm trong [Use Case](./04-use-cases/README.md); điều kiện bắt buộc nằm trong [Business Rule](./03-quy-trinh-va-quy-tac-nghiep-vu.md).

## 5.1. Identity và tài khoản

| ID | Mức | Yêu cầu | Use Case |
|---|---|---|---|
| FR-IAM-001 | MUST | Guest có thể đăng ký bằng họ tên, email, số điện thoại và mật khẩu; hệ thống kiểm tra định dạng và tính duy nhất. | UC-AUTH-01 |
| FR-IAM-002 | MUST | Hệ thống gửi và xác minh email hoặc OTP trước khi kích hoạt đầy đủ tài khoản Customer. | UC-AUTH-01 |
| FR-IAM-003 | MUST | User có thể đăng nhập bằng email hoặc số điện thoại và nhận access/refresh token theo chính sách bảo mật. | UC-AUTH-02 |
| FR-IAM-004 | MUST | User có thể refresh phiên và logout; logout phải thu hồi refresh token hiện tại. | UC-AUTH-03 |
| FR-IAM-005 | MUST | User có thể yêu cầu reset mật khẩu bằng token/OTP có thời hạn mà không làm lộ tài khoản có tồn tại hay không. | UC-AUTH-04 |
| FR-IAM-006 | MUST | User có thể xem và cập nhật hồ sơ; thay đổi email/số điện thoại phải xác minh lại. | UC-PROFILE-01 |
| FR-IAM-007 | MUST | Hệ thống khóa tạm đăng nhập khi vượt ngưỡng thất bại và ghi audit cho sự kiện bảo mật. | UC-AUTH-02 |
| FR-IAM-008 | MUST | Admin có thể khóa/mở khóa User và gán role phù hợp; thay đổi phải có audit. | UC-ADMIN-01 |
| FR-IAM-009 | MUST | Admin có thể tạo Organization và membership cho Operator Staff/Driver. | UC-ADMIN-01 |

## 5.2. Tìm kiếm và xem Trip

| ID | Mức | Yêu cầu | Use Case |
|---|---|---|---|
| FR-SEARCH-001 | MUST | Guest/Customer có thể tìm Trip theo điểm đi, điểm đến, ngày đi và số hành khách hợp lệ. | UC-SEARCH-01 |
| FR-SEARCH-002 | MUST | Kết quả chỉ gồm Trip còn khả năng bán theo trạng thái/policy, có phân trang và tổng số kết quả. | UC-SEARCH-01 |
| FR-SEARCH-003 | MUST | Người dùng có thể lọc theo khoảng giá, giờ đi, nhà xe, loại xe, điểm đón/trả, tiện nghi và đánh giá. | UC-SEARCH-01 |
| FR-SEARCH-004 | MUST | Người dùng có thể sắp xếp theo giá, giờ khởi hành, thời lượng và đánh giá. | UC-SEARCH-01 |
| FR-SEARCH-005 | MUST | Chi tiết Trip hiển thị nhà xe, lịch trình, xe, tiện nghi, điểm đón/trả, giá và policy snapshot áp dụng. | UC-SEARCH-01 |
| FR-SEARCH-006 | MUST | Số ghế khả dụng hiển thị phải kèm thời điểm cập nhật và được xác minh lại khi tạo SeatHold. | UC-SEARCH-01, UC-BOOK-01 |
| FR-SEARCH-007 | SHOULD | Hệ thống ghi nhận truy vấn tìm kiếm đã ẩn danh để phục vụ báo cáo và không thu thập dữ liệu nhạy cảm không cần thiết. | UC-SEARCH-01 |

## 5.3. Ghế, SeatHold và Booking

| ID | Mức | Yêu cầu | Use Case |
|---|---|---|---|
| FR-BOOK-001 | MUST | Customer đã đăng nhập có thể xem TripSeat và trạng thái khả dụng của một Trip. | UC-BOOK-01 |
| FR-BOOK-002 | MUST | Customer có thể yêu cầu giữ một hoặc nhiều ghế; hệ thống phải giữ toàn bộ hoặc không giữ ghế nào, sau đó trả hold token, thời điểm hết hạn và giá snapshot. | UC-BOOK-01 |
| FR-BOOK-003 | MUST | Hệ thống từ chối toàn bộ yêu cầu nếu bất kỳ ghế nào không còn khả dụng tại thời điểm commit. | UC-BOOK-01 |
| FR-BOOK-004 | MUST | Customer nhập một Passenger cho mỗi ghế; các trường bắt buộc được kiểm tra theo policy của Trip. | UC-BOOK-01 |
| FR-BOOK-005 | MUST | Customer có thể tạo đúng một Booking từ SeatHold còn hiệu lực; thao tác hỗ trợ idempotency. | UC-BOOK-01 |
| FR-BOOK-006 | MUST | Backend tự tính subtotal, discount, fee và total; client không được quyết định tổng tiền. | UC-BOOK-01 |
| FR-BOOK-007 | MUST | SeatHold/Booking chưa thanh toán hết hạn được chuyển trạng thái và giải phóng ghế tự động. | UC-BOOK-01 |
| FR-BOOK-008 | MUST | Customer có thể xem Booking/Ticket sắp đi, đã dùng, bị hủy hoặc hoàn tiền của chính mình. | UC-BOOK-02 |
| FR-BOOK-009 | MUST | Customer có thể hủy toàn Booking hoặc Ticket đủ điều kiện; hệ thống hiển thị phí và số tiền hoàn trước khi xác nhận. | UC-CANCEL-01 |
| FR-BOOK-010 | SHOULD | Customer có thể đổi ngày/Trip/ghế theo policy; hệ thống xử lý chênh lệch giá và không làm mất Ticket cũ trước khi giữ được ghế mới. | UC-CHANGE-01 |
| FR-BOOK-011 | MUST | Operator có thể tra cứu Booking/manifest trong tenant và không được xem Booking của tenant khác. | UC-OPS-06 |

## 5.4. Payment và Refund

| ID | Mức | Yêu cầu | Use Case |
|---|---|---|---|
| FR-PAY-001 | MUST | Customer có thể tạo Payment intent cho Booking PENDING_PAYMENT còn hiệu lực. | UC-PAY-01 |
| FR-PAY-002 | MUST | Hệ thống gửi request đến provider với mã tham chiếu duy nhất, amount, currency và callback URL. | UC-PAY-01 |
| FR-PAY-003 | MUST | Hệ thống xác minh chữ ký, provider, transaction ID, amount và currency trước khi chấp nhận webhook. | UC-PAY-01 |
| FR-PAY-004 | MUST | Webhook lặp không được tạo thêm Payment, Ticket hoặc thay đổi trạng thái lần thứ hai. | UC-PAY-01 |
| FR-PAY-005 | MUST | Khi Payment hợp lệ thành công, hệ thống phải cập nhật Booking, ghế và Ticket nhất quán, không tạo trạng thái dở dang quan sát được. | UC-PAY-01 |
| FR-PAY-006 | MUST | Payment thất bại/hủy không được chuyển Booking sang PAID; ghế được giữ đến hết hạn hoặc giải phóng theo rule. | UC-PAY-01 |
| FR-PAY-007 | MUST | Payment thành công trễ nhưng Booking không thể xác nhận phải tạo compensation Refund hoặc case xử lý thủ công. | UC-PAY-01 |
| FR-PAY-008 | MUST | Hệ thống tạo và theo dõi Refund; refund request lặp phải idempotent. | UC-CANCEL-01 |
| FR-PAY-009 | MUST | Admin/Operator Finance có thể tra cứu Payment/Refund theo phạm vi quyền và mã giao dịch. | UC-ADMIN-02 |
| FR-PAY-010 | SHOULD | Hệ thống hỗ trợ job đối soát transaction chưa có kết quả cuối. | UC-ADMIN-02 |

## 5.5. Ticket và check-in

| ID | Mức | Yêu cầu | Use Case |
|---|---|---|---|
| FR-TICKET-001 | MUST | Mỗi Passenger/TripSeat của Booking PAID có đúng một Ticket được phát hành. | UC-PAY-01 |
| FR-TICKET-002 | MUST | Ticket hiển thị mã vé, Passenger, nhà xe, Trip, điểm đón/trả, ghế, giá snapshot, trạng thái và QR. | UC-TICKET-01 |
| FR-TICKET-003 | MUST | QR chứa token đủ ngẫu nhiên hoặc có chữ ký; không chứa PII dạng rõ không cần thiết. | UC-TICKET-01 |
| FR-TICKET-004 | MUST | Driver/Operator được phân quyền có thể scan hoặc nhập mã để kiểm tra Ticket. | UC-DRIVER-01 |
| FR-TICKET-005 | MUST | Check-in là idempotent; Ticket đã hủy/refund/sai Trip phải bị từ chối với lý do rõ ràng. | UC-DRIVER-01 |
| FR-TICKET-006 | MUST | Hệ thống ghi người check-in, thời điểm, Trip và kết quả vào audit nghiệp vụ. | UC-DRIVER-01 |

## 5.6. Vận hành nhà xe

| ID | Mức | Yêu cầu | Use Case |
|---|---|---|---|
| FR-OPS-001 | MUST | Operator Staff có permission phù hợp có thể cập nhật thông tin Organization của mình. | UC-OPS-01 |
| FR-OPS-002 | MUST | Operator có thể tạo/cập nhật/deactivate Bus và sơ đồ ghế; biển số duy nhất trong phạm vi phù hợp. | UC-OPS-02 |
| FR-OPS-003 | MUST | Operator có thể tạo/cập nhật/deactivate DriverProfile và kiểm tra ngày hết hạn giấy phép. | UC-OPS-03 |
| FR-OPS-004 | MUST | Operator có thể quản lý Route, Stop, thứ tự dừng và thời gian dự kiến. | UC-OPS-04 |
| FR-OPS-005 | MUST | Operator có thể tạo draft Trip, phân Bus/Driver, định giá và publish. | UC-OPS-05 |
| FR-OPS-006 | MUST | Khi publish, hệ thống kiểm tra xung đột lịch Bus/Driver và tạo snapshot ghế trước khi mở bán. | UC-OPS-05 |
| FR-OPS-007 | MUST | Operator/Driver được phép có thể chuyển trạng thái Trip theo quy tắc chuyển trạng thái hợp lệ. | UC-OPS-06 |
| FR-OPS-008 | MUST | Hủy Trip có Ticket đã bán phải khởi tạo xử lý hủy vé, Refund và Notification. | UC-TRIP-01 |
| FR-OPS-009 | MUST | Dữ liệu Bus/Driver/Route đã được tham chiếu không được hard delete. | UC-OPS-02..04 |
| FR-OPS-010 | MUST | Driver xem được assignment và manifest tối thiểu của Trip được phân công. | UC-OPS-06, UC-DRIVER-01 |

## 5.7. Promotion, Review và Notification

| ID | Mức | Yêu cầu | Use Case |
|---|---|---|---|
| FR-PROMO-001 | SHOULD | Admin/Operator có quyền có thể tạo Promotion với phạm vi, thời hạn, quota và điều kiện sử dụng. | UC-PROMO-01 |
| FR-PROMO-002 | SHOULD | Hệ thống kiểm tra Promotion ở server, ngăn vượt quota và lưu discount snapshot. | UC-PROMO-01 |
| FR-REVIEW-001 | SHOULD | Customer chỉ có thể tạo một Review cho Ticket đã USED; có thể cập nhật trong thời hạn cấu hình. | UC-REVIEW-01 |
| FR-REVIEW-002 | SHOULD | Admin/Operator có thể ẩn Review vi phạm và lưu reason/audit. | UC-REVIEW-02 |
| FR-NOTIF-001 | MUST | Hệ thống tạo Notification cho Booking paid, Ticket issued/changed, Payment failed, Trip changed/cancelled, Booking cancelled và Refund completed. | UC-NOTIF-01 và UC phát sinh sự kiện |
| FR-NOTIF-002 | MUST | Notification lỗi được retry có giới hạn và không làm rollback giao dịch đã commit. | UC-NOTIF-01 |
| FR-NOTIF-003 | SHOULD | User có thể cấu hình kênh nhận thông báo không bắt buộc; thông báo giao dịch thiết yếu không được tắt hoàn toàn. | UC-NOTIF-01 |

## 5.8. Admin và báo cáo

| ID | Mức | Yêu cầu | Use Case |
|---|---|---|---|
| FR-ADMIN-001 | MUST | Admin quản lý Organization, User, role, trạng thái tài khoản và tenant membership. | UC-ADMIN-01 |
| FR-ADMIN-002 | MUST | Admin tra cứu Booking, Payment, Refund và audit bằng ID/mã giao dịch nhưng không được sửa lịch sử bất biến. | UC-ADMIN-02 |
| FR-ADMIN-003 | SHOULD | Admin quản lý khiếu nại với trạng thái, người xử lý và kết quả. | UC-ADMIN-03 |
| FR-REPORT-001 | MUST | Admin xem gross/net revenue, Booking, Refund và occupancy theo khoảng thời gian. | UC-REPORT-01 |
| FR-REPORT-002 | MUST | Operator xem báo cáo giới hạn theo tenant; định nghĩa metric và timezone phải hiển thị. | UC-REPORT-01 |
| FR-REPORT-003 | SHOULD | Người có quyền có thể export CSV; export lớn chạy bất đồng bộ. | UC-REPORT-01 |

## 5.9. Kiểm tra độ phủ

Chương này có 66 FR: 56 `MUST` và 10 `SHOULD`. Mỗi nhóm đã có Use Case tương ứng; truy vết tới Business Rule và Acceptance Criteria được hoàn thiện tại [Chương 10](./10-nghiem-thu-va-truy-vet.md).

[← Chương 4](./04-use-cases/README.md) · [Mục lục](./README.md) · [Chương 6 →](./06-yeu-cau-trang-thai.md)
