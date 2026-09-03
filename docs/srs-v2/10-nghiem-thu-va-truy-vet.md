# 10. Nghiệm thu và truy vết

[← Chương 9](./09-yeu-cau-phi-chuc-nang.md) · [Mục lục](./README.md) · [Chương 11 →](./11-phu-luc.md)

## 10.1. Nguyên tắc nghiệm thu

- Acceptance Criteria phải cho phép xác định rõ đạt hoặc không đạt.
- Kết quả phải quan sát được qua API, UI, trạng thái bền vững, audit hoặc metric.
- Mỗi FR/NFR `MUST` phải được ít nhất một AC hoặc Test Case bao phủ.
- Test đồng thời, callback lặp/trễ, tenant isolation và negative authorization là điều kiện bắt buộc.
- Dữ liệu test phải tách tenant và không dùng dữ liệu nhạy cảm thật.

## 10.2. Identity, authorization và hồ sơ

| ID | Given | When | Then |
|---|---|---|---|
| AC-AUTH-001 | Email/số điện thoại đã thuộc tài khoản active | Guest đăng ký lại | Không tạo User thứ hai và trả lỗi an toàn. |
| AC-AUTH-002 | Operator Staff thuộc Organization A | Gọi API xem/sửa dữ liệu Organization B | API từ chối, không trả dữ liệu B và ghi security context phù hợp. |
| AC-AUTH-003 | Dữ liệu đăng ký hợp lệ | Guest xác minh bằng OTP/token còn hiệu lực | User được kích hoạt và có thể đăng nhập. |
| AC-AUTH-004 | OTP sai/hết hạn | Guest gửi xác minh | User không active; hệ thống trả lỗi và cho phép gửi lại theo rate limit. |
| AC-AUTH-005 | User active có thông tin đúng | User đăng nhập | Phiên được cấp với đúng role và tenant scope. |
| AC-AUTH-006 | User nhập sai quá ngưỡng | Tiếp tục đăng nhập | Yêu cầu bị khóa/chậm theo policy và có security audit. |
| AC-AUTH-007 | Refresh token hợp lệ | Client refresh | Token được rotate/cấp lại; token cũ không được reuse ngoài policy. |
| AC-AUTH-008 | User đăng xuất | Client dùng lại refresh token đã revoke | Không cấp phiên mới. |
| AC-AUTH-009 | Định danh có hoặc không tồn tại | Yêu cầu reset mật khẩu | Response công khai không tiết lộ tài khoản có tồn tại. |
| AC-PROFILE-001 | Customer thay email/số điện thoại | Lưu hồ sơ | Giá trị mới chỉ có hiệu lực sau xác minh; giá trị cũ giữ hiệu lực nếu xác minh thất bại. |

## 10.3. Tìm kiếm, ghế và Booking

| ID | Given | When | Then |
|---|---|---|---|
| AC-SEARCH-001 | Có Trip phù hợp và Trip không còn bán | Guest tìm kiếm | Trip không sellable không xuất hiện trong kết quả. |
| AC-SEARCH-002 | Nhiều Trip phù hợp | Người dùng lọc/sắp xếp/phân trang | Kết quả đúng tiêu chí, thứ tự và metadata phân trang. |
| AC-SEARCH-003 | Không có Trip phù hợp | Người dùng tìm kiếm | Trả danh sách rỗng và không trả lỗi hệ thống. |
| AC-SEAT-001 | TripSeat A1 AVAILABLE | Hai Customer giữ A1 đồng thời | Đúng một request thành công; request còn lại nhận `SEAT_UNAVAILABLE`. |
| AC-SEAT-002 | A1 AVAILABLE, A2 đã HELD/BOOKED | Customer yêu cầu giữ A1+A2 | Toàn request thất bại và A1 vẫn AVAILABLE. |
| AC-SEAT-003 | SeatHold quá `expiresAt` | Customer tạo Booking | Trả `SEAT_HOLD_EXPIRED`, không tạo Booking và giải phóng ghế hợp lệ. |
| AC-BOOK-001 | Client gửi total nhỏ hơn giá snapshot | Tạo Booking | Server bỏ qua total client, tính lại và trả total chính thức. |
| AC-BOOK-002 | Cùng idempotency key và payload | Gửi create Booking nhiều lần | Chỉ một Booking tồn tại và response tham chiếu cùng ID. |
| AC-BOOK-003 | Cùng idempotency key nhưng payload khác | Gửi create Booking | Trả `IDEMPOTENCY_CONFLICT`, không tạo tác động mới. |
| AC-BOOK-004 | Số Passenger khác số ghế | Tạo Booking | Trả validation error và không consume hold. |
| AC-BOOK-005 | Customer A biết Booking ID của Customer B | A mở Booking B | Hệ thống từ chối và không lộ dữ liệu B. |

## 10.4. Payment, Ticket, hủy và đổi

| ID | Given | When | Then |
|---|---|---|---|
| AC-PAY-001 | Booking còn hiệu lực; webhook có signature/amount/currency hợp lệ | Xử lý webhook | Payment SUCCEEDED, Booking PAID, TripSeat BOOKED và mỗi item có một Ticket. |
| AC-PAY-002 | Provider gửi cùng webhook nhiều lần | Hệ thống xử lý | Chỉ một logical Payment success và một tập Ticket được tạo. |
| AC-PAY-003 | Webhook amount/currency sai | Hệ thống xác minh | Booking không PAID, không tạo Ticket và tạo reconciliation/security record. |
| AC-PAY-004 | Payment thành công sau expiry và ghế đã thuộc Booking khác | Hệ thống nhận kết quả | Không double-book; tạo compensation Refund/manual case. |
| AC-PAY-005 | Customer quay lại trước webhook | Client hiển thị kết quả | Hiển thị PROCESSING và không tuyên bố thành công/thất bại sai. |
| AC-PAY-006 | Payment FAILED/CANCELLED | Hệ thống nhận kết quả cuối | Booking không PAID và không phát hành Ticket. |
| AC-TICKET-001 | Booking PAID có nhiều Booking Item | Hoàn tất xác nhận | Mỗi item có đúng một Ticket, không trùng. |
| AC-TICKET-002 | Customer mở Ticket của mình | Hệ thống trả Ticket | Có đủ Trip, Passenger, ghế, điểm đón/trả, giá, trạng thái, QR và public code an toàn. |
| AC-CANCEL-001 | Ticket đủ điều kiện hủy | Customer yêu cầu preview | Response có policy version, fee và refund amount trước xác nhận. |
| AC-CANCEL-002 | Cancellation đã tạo Refund | Gửi lại cùng command/key | Không tạo Refund thứ hai. |
| AC-CANCEL-003 | Ticket CHECKED_IN/USED hoặc quá giờ hủy | Customer xác nhận hủy | Hệ thống từ chối và không thay đổi Ticket/Payment. |
| AC-CANCEL-004 | Refund provider lỗi sau khi Ticket đã hủy | Hệ thống nhận lỗi | Ticket vẫn CANCELLED; Refund chuyển FAILED/PROCESSING để retry/manual case. |
| AC-CHANGE-001 | Ghế mới không giữ được | Customer đổi vé | Ticket cũ vẫn ISSUED và không phát sinh charge. |
| AC-CHANGE-002 | Giữ được ghế mới và phần tài chính hoàn tất | Customer xác nhận đổi | Ticket mới ISSUED, Ticket cũ CANCELLED và không tồn tại trạng thái hai vé ngoài policy. |

## 10.5. Vận hành nhà xe và Trip

| ID | Given | When | Then |
|---|---|---|---|
| AC-OPS-001 | Operator thuộc tenant A | Tạo/sửa Bus, Driver hoặc Route | Dữ liệu được gắn tenant A và không tác động tenant B. |
| AC-OPS-002 | Bus/Seat đã được Trip tham chiếu | Operator yêu cầu xóa | Hệ thống không hard delete; chỉ deactivate/soft delete theo policy. |
| AC-OPS-003 | Bus/Driver có lịch chồng lấn | Operator publish Trip mới | Publish bị từ chối và trả thông tin xung đột trong scope. |
| AC-OPS-004 | Trip hợp lệ nhưng inventory ghế chưa tạo | Operator publish | Trip chưa xuất hiện sellable cho đến khi inventory sẵn sàng. |
| AC-OPS-005 | Driver không được assignment | Driver mở manifest/chuyển Trip state | Hệ thống từ chối và không trả PII. |
| AC-OPS-006 | Driver được assignment, transition hợp lệ | Chuyển Trip state | Trip cập nhật đúng state, version và audit. |
| AC-TICKET-003 | Driver được phân công; Ticket ISSUED đúng Trip | Scan QR | Ticket CHECKED_IN và audit có actor/time/Trip. |
| AC-TICKET-004 | Ticket thuộc Trip A | Driver scan trong Trip B | Từ chối và không thay đổi Ticket. |
| AC-TICKET-005 | Ticket đã CHECKED_IN | Quét lại | Trả trạng thái/thời điểm cũ và không tạo check-in thứ hai. |
| AC-TRIP-001 | Trip có Ticket đã bán | Operator có quyền hủy | Trip CANCELLED, Ticket bị vô hiệu, Refund được yêu cầu và Customer được thông báo eventual. |
| AC-TRIP-002 | Cùng command hủy Trip được gửi lặp | Hệ thống xử lý | Chỉ một logical cancellation và không tạo Refund trùng. |

## 10.6. Promotion, Review và Notification

| ID | Given | When | Then |
|---|---|---|---|
| AC-PROMO-001 | Promotion active, đúng scope và còn quota | Customer áp dụng | Server tính discount đúng và lưu snapshot/redemption. |
| AC-PROMO-002 | Quota còn một | Hai Booking áp dụng đồng thời | Không có số redemption thành công vượt quota. |
| AC-REVIEW-001 | Customer sở hữu Ticket USED chưa Review | Tạo Review hợp lệ | Tạo đúng một Review gắn Ticket. |
| AC-REVIEW-002 | Ticket chưa USED/không thuộc Customer | Tạo Review | Từ chối và không tạo Review. |
| AC-REVIEW-003 | Moderator có quyền và nhập reason | Ẩn Review | Review bị ẩn nhưng lịch sử, moderator, reason và timestamp được giữ. |
| AC-NOTIF-001 | Booking/Payment đã commit thành công | Notification Provider lỗi | Giao dịch không rollback; DeliveryAttempt retry theo policy. |
| AC-NOTIF-002 | User tắt kênh tùy chọn | Lưu preference | Preference được áp dụng nhưng thông báo thiết yếu không bị tắt ngoài policy. |

## 10.7. Admin, audit và báo cáo

| ID | Given | When | Then |
|---|---|---|---|
| AC-ADMIN-001 | Admin có quyền | Gán/bỏ role hoặc membership | Thay đổi đúng scope, phiên được thu hồi khi cần và audit được tạo. |
| AC-ADMIN-002 | Admin không đủ quyền hoặc cố loại bỏ admin cuối cùng | Thực hiện thao tác | Hệ thống từ chối và giữ nguyên quyền. |
| AC-ADMIN-003 | Actor có mã Booking/Payment/Refund | Tra cứu | Hệ thống liên kết được giao dịch/audit trong scope và không cho sửa lịch sử. |
| AC-ADMIN-004 | Khiếu nại thiếu resolution | Actor đóng case | Hệ thống từ chối đóng. |
| AC-REPORT-001 | Operator Finance tenant A | Xem báo cáo | Chỉ có dữ liệu A; hiển thị metric, timezone và thời điểm dữ liệu. |
| AC-REPORT-002 | Export lớn | Actor yêu cầu export | Tạo Export Job, thông báo khi sẵn sàng và kiểm tra lại quyền khi tải. |
| AC-REPORT-003 | Projection chậm | Actor xem báo cáo | Hiển thị thời điểm dữ liệu gần nhất, không trình bày như realtime. |

## 10.8. Chất lượng hệ thống

| ID | Given | When | Then |
|---|---|---|---|
| AC-NFR-001 | Dataset/tải tại NFR-PERF | Chạy load/concurrency test | Đạt latency baseline và không có double-book/duplicate transaction. |
| AC-NFR-002 | Message broker/provider tạm lỗi | Khôi phục dependency | Tác vụ chưa hoàn tất được retry/hội tụ hoặc xuất hiện trong manual/dead-letter queue; không mất giao dịch đã commit. |
| AC-NFR-003 | Backup hợp lệ | Thực hiện restore rehearsal | Dữ liệu phục hồi trong RPO/RTO đã nêu và có bằng chứng. |
| AC-SEC-001 | Operator/Driver/Customer dùng ID ngoài scope | Gọi API protected | Bị từ chối mà không lộ dữ liệu; negative test đạt. |
| AC-SEC-002 | Log của luồng đăng nhập/Payment/Ticket | Kiểm tra log | Không có password, OTP, token, PAN/CVV hoặc full identity document. |
| AC-UX-001 | Viewport từ 360 px và trình duyệt hỗ trợ | Thực hiện luồng Customer cốt lõi | Không mất chức năng, nội dung chính không bị che/cắt. |
| AC-UX-002 | Chỉ dùng bàn phím | Thực hiện đăng nhập, tìm Trip, chọn ghế và Booking | Focus, thứ tự tab và thao tác đạt yêu cầu accessibility. |
| AC-OBS-001 | Một Booking thanh toán thành công | Tra cứu correlation ID | Liên kết được log/trace qua các bước chính mà không lộ token/PII. |

## 10.9. Ma trận truy vết cấp feature

| Feature | Goal | Business Process | Use Case | FR/NFR | Business Rule | Acceptance Criteria |
|---|---|---|---|---|---|---|
| Đăng ký/xác minh | GOAL-001, 003 | BP-07 | UC-AUTH-01 | FR-IAM-001..002 | AUTHZ, BR-DATA | AC-AUTH-001, 003..004 |
| Đăng nhập/session/reset | GOAL-001, 003 | BP-07 | UC-AUTH-02..04 | FR-IAM-003..005, 007 | AUTHZ | AC-AUTH-005..009 |
| Hồ sơ | GOAL-001, 003 | BP-07 | UC-PROFILE-01 | FR-IAM-006 | AUTHZ-004 | AC-PROFILE-001 |
| Tìm Trip | GOAL-001, 004, 005 | BP-01 | UC-SEARCH-01 | FR-SEARCH-001..007 | BR-TRIP-001 | AC-SEARCH-001..003 |
| Giữ ghế | GOAL-001, 002 | BP-01 | UC-BOOK-01 | FR-BOOK-001..003 | BR-SEAT-* | AC-SEAT-001..003 |
| Tạo/xem Booking | GOAL-001, 002 | BP-01 | UC-BOOK-01..02 | FR-BOOK-004..008 | BR-BOOK-* | AC-BOOK-001..005 |
| Payment/phát hành Ticket | GOAL-001, 002, 006 | BP-01 | UC-PAY-01, UC-TICKET-01 | FR-PAY-001..007, FR-TICKET-001..003 | BR-PAY-*, BR-TICKET-001 | AC-PAY-001..006, AC-TICKET-001..002 |
| Hủy/Refund | GOAL-001, 002, 007 | BP-02 | UC-CANCEL-01 | FR-BOOK-009, FR-PAY-008 | BR-CANCEL-*, BR-PAY-* | AC-CANCEL-001..004 |
| Đổi vé | GOAL-001, 002 | BP-03 | UC-CHANGE-01 | FR-BOOK-010 | BR-CANCEL-006..007 | AC-CHANGE-001..002 |
| Quản lý nhà xe | GOAL-001, 003 | BP-07 | UC-OPS-01..04 | FR-OPS-001..004, 009 | BR-TENANT-*, BR-DATA-* | AC-OPS-001..002 |
| Publish/vận hành Trip | GOAL-001, 002 | BP-04..05 | UC-OPS-05..06 | FR-OPS-005..007, 010 | BR-TRIP-* | AC-OPS-003..006 |
| Check-in | GOAL-001, 002, 003 | BP-05 | UC-DRIVER-01 | FR-TICKET-004..006 | BR-TICKET-* | AC-TICKET-003..005 |
| Hủy Trip | GOAL-001, 002, 007 | BP-06 | UC-TRIP-01 | FR-OPS-008 | BR-TRIP-004..006, BR-CANCEL-008 | AC-TRIP-001..002 |
| Promotion | GOAL-001, 002 | BP-01, BP-07 | UC-PROMO-01 | FR-PROMO-001..002 | BR-BOOK-004..005 | AC-PROMO-001..002 |
| Review | GOAL-001, 003 | BP-05, BP-07 | UC-REVIEW-01..02 | FR-REVIEW-001..002 | BR-REVIEW-* | AC-REVIEW-001..003 |
| Notification | GOAL-001, 005, 006 | BP-01..07 | UC-NOTIF-01 | FR-NOTIF-001..003 | Retry/consistency rules | AC-NOTIF-001..002 |
| Admin/audit | GOAL-001, 003, 007 | BP-07 | UC-ADMIN-01..03 | FR-ADMIN-001..003, FR-PAY-009..010 | AUTHZ, BR-AUDIT-* | AC-ADMIN-001..004 |
| Báo cáo | GOAL-001, 007 | BP-07 | UC-REPORT-01 | FR-REPORT-001..003 | BR-TENANT-* | AC-REPORT-001..003 |
| Chất lượng | GOAL-005, 006 | Tất cả | Tất cả UC | NFR-* | Các bất biến liên quan | AC-NFR-*, AC-SEC-*, AC-UX-*, AC-OBS-* |

## 10.10. Definition of Done cho yêu cầu MUST

Một requirement `MUST` chỉ được coi là hoàn thành khi:

1. Hành vi được triển khai trong đúng phạm vi.
2. Có unit/integration/concurrency/contract test phù hợp với rủi ro.
3. Authorization và negative test đã đạt.
4. API/event contract được cập nhật nếu có thay đổi giao tiếp.
5. Log/metric/audit cần thiết tồn tại và không lộ dữ liệu nhạy cảm.
6. Acceptance Criteria liên quan đạt.
7. Ma trận truy vết không còn liên kết thiếu.

[← Chương 9](./09-yeu-cau-phi-chuc-nang.md) · [Mục lục](./README.md) · [Chương 11 →](./11-phu-luc.md)
