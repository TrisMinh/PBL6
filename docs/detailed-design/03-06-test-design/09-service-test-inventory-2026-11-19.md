# Kiểm thử backend theo service — 19/11/2026

Phạm vi là mã kiểm thử .NET trong [workspace/src/tests](../../../workspace/src/tests) của working tree ngày 19/11, gồm các thay đổi local trên commit `4a53f8d2`. Mỗi `[Fact]` được tính là một ca. Mỗi bộ tham số của `[Theory]` được tính là một ca. Một ca có thể đi qua nhiều API và được xếp vào một nhóm theo mục tiêu chính để tránh đếm trùng.

## Kết quả chạy ngày 19/11

Build thành công và đã chạy cả 11 suite bằng .NET SDK 10.0.401. Các suite tích hợp có dùng Testcontainers cho PostgreSQL và RabbitMQ. Tổng cộng **158 ca đã chạy, 155 đạt, 3 lỗi, 0 bỏ qua**. Lệnh `dotnet test` trả mã thoát 1. Các tệp `.trx` trong `workspace/TestResults/service-audit-20261119/` là bằng chứng local và được Git bỏ qua.

Bản lưu của lượt chạy là [báo cáo Excel ngày 19/11/2026](../../../outputs/service-audit-20261119/PBL6_Ket_qua_kiem_thu_2026-11-19.xlsx). Workbook ghi lại kết quả của từng ca và tên tệp TRX tương ứng.

| Suite | Chạy | Đạt | Lỗi | Tệp TRX ngày 19/11 |
|---|---:|---:|---:|---|
| Identity | 19 | 18 | 1 | `service-audit_net10.0_20261119093623.trx` |
| Transport | 18 | 18 | 0 | `service-audit_net10.0_20261119093634.trx` |
| Booking | 17 | 15 | 2 | `service-audit_net10.0_20261119093643.trx` |
| Payment | 37 | 37 | 0 | `service-audit_net10.0_20261119093649.trx` |
| Notification | 2 | 2 | 0 | `service-audit_net10.0_20261119093650.trx` |
| Reporting | 8 | 8 | 0 | `service-audit_net10.0_20261119093657.trx` |
| Gateway | 10 | 10 | 0 | `service-audit_net10.0_20261119093613.trx` |
| Messaging | 4 | 4 | 0 | `service-audit_net10.0_20261119093638.trx` |
| Building Blocks | 17 | 17 | 0 | `service-audit_net10.0_20261119093607.trx` |
| Contracts | 10 | 10 | 0 | `service-audit_net10.0_20261119093625.trx` |
| Architecture | 16 | 16 | 0 | `service-audit_net10.0_20261119093612.trx` |

### Ca lỗi cần xử lý

| Service | Kiểm thử | Kỳ vọng | Kết quả thực tế |
|---|---|---|---|
| Identity | `Security_logged_out_access_token_cannot_read_profile` | Token của phiên đã đăng xuất bị từ chối khi đọc hồ sơ. | API trả `200` thay vì `401`. |
| Booking | `Security_anonymous_payment_event_cannot_issue_tickets` | Từ chối sự kiện chưa xác thực và giữ nguyên trạng thái đơn/vé. | API chấp nhận sự kiện, ghi nhận đã thanh toán và phát hành vé trong môi trường test. |
| Booking | `Security_operator_without_organization_cannot_list_all_bookings` | Từ chối quyền xem đơn khi tài khoản thiếu phạm vi nhà xe. | API trả `200` kèm danh sách đơn test. |

Chạy lại từ thư mục `workspace` bằng `dotnet test BusTicketPlatform.sln --results-directory TestResults/service-audit-rerun --logger 'trx;LogFilePrefix=service-audit' -m:2`. Docker Desktop cần hoạt động để test tích hợp khởi tạo dependency.

## Số ca theo service và chức năng

| Service | Chức năng | Ca | Tình huống | Lớp kiểm thử |
|---|---|---:|---|---|
| Identity | Đăng ký và xác minh | 2 | Trùng tài khoản hoặc mật khẩu yếu. Mã xác minh hết hạn và tài khoản vẫn chờ. | `AuthFlowTests` |
| Identity | Vòng đời tài khoản và token | 2 | Đăng ký → xác minh → đăng nhập → refresh → đăng xuất → hồ sơ. Token đã đăng xuất không đọc được hồ sơ. | `AuthFlowTests` |
| Identity | Quên mật khẩu và giới hạn tần suất | 2 | Giới hạn gửi lại mã và yêu cầu quên mật khẩu theo danh tính. Đặt lại mật khẩu làm mất hiệu lực mật khẩu cũ. | `AuthFlowTests` |
| Identity | Hồ sơ tùy chọn của khách | 1 | Lưu tùy chọn theo chủ tài khoản và từ chối nội dung chủ động. | `CustomerPreferencesTests` |
| Identity | Chính sách mật khẩu và chuẩn hóa | 5 | Bốn bộ tham số mật khẩu. Chuẩn hóa email và điện thoại. | `PasswordPolicyTests` |
| Identity | Khóa đăng nhập và quản trị tài khoản | 2 | Khóa đăng nhập, quyền vào Admin, quản trị trạng thái tài khoản và chặn tự sửa trạng thái. | `SecurityAndAdminTests` |
| Identity | Health, readiness và migration | 5 | Ba biến thể health không cần DB, readiness thiếu DB, readiness sau khi khởi tạo DB trống. | `IdentityHealthTests`, `IdentitySqlBaselineTests` |
| Transport | Hồ sơ nhà xe | 1 | Lưu trường hồ sơ với kiểm tra phiên bản. | `TransportFlowTests` |
| Transport | Danh mục, tìm chuyến và phân trang | 3 | Danh mục không chọn tuyến/ngày, phát hành và tìm chuyến, từ chối phân trang âm hoặc quá lớn. | `TransportFlowTests` |
| Transport | Tuyến và điểm dừng | 1 | Chặn thứ tự điểm dừng trùng hoặc đứt đoạn. | `TransportFlowTests` |
| Transport | Lịch chuyến lặp | 4 | Cập nhật bản nháp gốc, giới hạn ba tháng, giữ giờ địa phương khi retry, kiểm tra cả kỳ trước khi ghi. | `TransportFlowTests` |
| Transport | Mở hoặc khóa bán ghế | 1 | Đổi trạng thái một ghế và chặn phiên bản cũ. | `TransportFlowTests` |
| Transport | Tài xế và vòng đời chuyến | 5 | Xóa, tạm dừng, hồ sơ hết hạn, trùng lịch khi phát hành và quyền vận hành của tài xế được phân công. | `TransportFlowTests` |
| Transport | Xe và phạm vi nhà xe | 2 | Chặn sửa xe của nhà xe khác và xử lý trùng biển số. | `TransportFlowTests` |
| Transport | Readiness | 1 | Readiness sau khi áp migration. | `TransportFlowTests` |
| Booking | Giữ ghế | 2 | Giữ đồng thời và thay ghế nguyên tử, giữ nguyên hạn cũ và quyền sở hữu. | `BookingFlowTests`, `SeatHoldReplacementTests` |
| Booking | Đặt vé và hết hạn | 3 | Giữ ghế rồi đặt trả sau, kiểm tra số hành khách/kênh/giá, đơn trả trước hết hạn trả ghế. | `BookingFlowTests` |
| Booking | Vé, QR và check-in | 2 | Quyền xem đơn/vé, QR không mang thông tin hành khách, quyền check-in và tính idempotent. | `BookingFlowTests` |
| Booking | Hủy chuyến | 2 | Chặn bán chuyến đã hủy, vô hiệu vé trả sau và giải phóng ghế. | `BookingFlowTests` |
| Booking | Phân quyền nội bộ và Operator | 2 | Chặn sự kiện thanh toán ẩn danh phát hành vé và tài khoản thiếu nhà xe đọc toàn bộ đơn. | `BookingFlowTests` |
| Booking | Coupon và số tiền đặt vé | 6 | Sáu bộ tham số cho điều kiện khuyến mãi và số tiền booking. | `CouponFlowTests` |
| Payment | Thanh toán cơ bản, hoàn tiền và quyền xem | 6 | Webhook trả trước, dữ liệu nhà cung cấp chưa xác minh, báo giá hết hạn, callback trùng, thu muộn và giới hạn hoàn, quyền xem khác nhà xe. | `PaymentFlowTests` |
| Payment | Quay về từ SePay và tiếp tục checkout | 10 | Tám biến thể origin, mở lại phiên từ origin hiện tại, checkout local hết hạn và cấu hình origin không công khai. | `SePayFlowTests` |
| Payment | Tạo checkout SePay | 3 | Ký POST theo số tiền server, kiểm tra cấu hình/chế độ thanh toán, lỗi DB rồi retry cùng khóa. | `SePayFlowTests` |
| Payment | Migration lịch sử thanh toán | 1 | Khôi phục phạm vi nhà xe của dữ liệu cũ. | `SePayFlowTests` |
| Payment | Xác minh và ghi nhận IPN | 9 | IPN đồng thời, sai khóa hoặc số tiền, dùng lại mã giao dịch, năm biến thể trạng thái nhà cung cấp sai, rollback và retry. | `SePayFlowTests` |
| Payment | Trạng thái thanh toán và hoàn sau IPN | 4 | Thu muộn cần hoàn, void sau khi đã thu, thử lại bằng hóa đơn mới, callback VNPay cũ cho đơn SePay. | `SePayFlowTests` |
| Payment | Luồng liên service SePay | 4 | Bốn biến thể từ giữ hai ghế qua IPN đến phát hành vé, danh sách khách và hoàn tiền. | `SePayBookingFlowTests` |
| Notification | Readiness | 1 | Sẵn sàng sau khởi tạo. | `NotificationHealthTests` |
| Notification | Nhận và đọc thông báo | 1 | Nhận thông báo → truy vấn danh sách → đánh dấu đã đọc. | `NotificationHealthTests` |
| Reporting | Readiness | 1 | Sẵn sàng sau khởi tạo. | `ReportingHealthTests` |
| Reporting | Khoảng ngày báo cáo | 1 | Chặn khoảng ngày đảo ngược trước khi truy vấn. | `ReportingHealthTests` |
| Reporting | Tổng hợp hoàn tiền và doanh thu | 3 | Hoàn tiền cập nhật số liệu một lần, đối chiếu doanh thu với view BI khi sự kiện lệch thứ tự/phát lại, kỳ trống có độ mới chưa xác định. | `ReportingHealthTests`, `RevenueReportTests` |
| Reporting | Phân quyền dữ liệu | 3 | Chặn quyền từ membership khác, Operator thiếu nhà xe đọc báo cáo nền tảng, và ghi projection qua endpoint công khai. | `RevenueReportTests`, `SecurityAuditTests` |

## Kiểm thử lớp dùng chung

| Suite | Ca | Phân bổ |
|---|---:|---|
| Gateway | 10 | 4 CORS/OpenAPI/định tuyến. 3 liveness. 3 lỗi upstream, route và correlation ID. |
| Messaging | 4 | 1 consumer. 3 ca chống trùng/DLQ, outbox retry và khôi phục sau khi broker khởi động lại. |
| Building Blocks | 17 | 2 correlation, 7 ánh xạ lỗi, 2 log redaction/telemetry, 2 UUID/đồng hồ, 4 kiểu kết quả. |
| Contracts | 10 | 8 cổng kiểm tra OpenAPI, AsyncAPI và SQL. 2 schema sự kiện. |
| Architecture | 16 | 13 quy tắc phụ thuộc giữa các tầng, 3 quy tắc project và phiên bản package. |

## API Postman hiện hành

| Collection | Request | Assertion định nghĩa | Phạm vi |
|---|---:|---:|---|
| [Protected Endpoints](../../../workspace/postman/BLUE_OWASP_Protected_Endpoints.postman_collection.json) | 68 | 68 | Kiểm tra quyền truy cập khi thiếu xác thực qua Gateway. |
| [Coupons](../../../workspace/postman/BLUE_Coupons.postman_collection.json) | 4 | 5 | Danh sách ưu đãi, quote và quyền truy cập. |
| [SePay](../../../workspace/postman/BLUE_SePay.postman_collection.json) | 6 | 7 | Chuẩn bị báo giá, checkout, IPN và đọc lại trạng thái. |

Số request và assertion là số đếm từ collection. Lượt .NET ngày 19/11 chạy riêng với các collection này. [Audit ngày 16/11 có log chạy collection Protected Endpoints](../../security/owasp-api-2026-11-16/README.md). Workbook API Round 1 là kết quả lịch sử.

## Khoảng trống trong bộ kiểm thử ngày 19/11

- `PAY-REC-01` và `BI-DRILL-01` có tiêu chí nghiệm thu trong [backlog](../../../task-tracking/03-product-backlog.md). Chưa có lượt kiểm thử cơ chế tự tra cứu SePay sau khi mất IPN hoặc drill-through trong Power BI nhúng.
- Các ca `RevenueReportTests` kiểm chứng API và view dữ liệu BI. Kết quả kiểm thử thao tác trên Power BI Service và tải 500.000 dòng cần bằng chứng riêng.
- Hai ca Notification bao phủ readiness và luồng đọc thông báo cơ bản. Kiểm thử retry gửi email và lỗi SMTP chưa có ca độc lập trong suite Notification.
- Bộ kiểm thử này bao phủ backend .NET. [Checklist Admin 18/11](../../../outputs/admin-functional-checklist-20261118.md) và [Playwright](../../../workspace/src/apps/web/tests/e2e) là nguồn riêng cho hành vi web.
