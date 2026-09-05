# 8. Yêu cầu dữ liệu

[← Chương 7](./07-giao-dien-va-tich-hop.md) · [Mục lục](./README.md) · [Chương 9 →](./09-yeu-cau-phi-chuc-nang.md)

Chương này mô tả dữ liệu nghiệp vụ và ràng buộc quan sát được. Đây không phải thiết kế database vật lý; tên bảng, kiểu cột, PK/FK, index và migration được quyết định trong tài liệu thiết kế nhưng phải bảo đảm các yêu cầu dưới đây.

## 8.1. Nguyên tắc dữ liệu

- Mỗi dữ liệu giao dịch có một nguồn quyết định rõ ràng.
- ID nghiệp vụ không xung đột giữa các miền và không tái sử dụng.
- Dữ liệu từ miền khác được tham chiếu bằng ID hoặc snapshot; thay đổi nguồn không được làm sai lịch sử giao dịch.
- Entity giao dịch không hard delete.
- Timestamp được lưu/trao đổi theo quy ước thống nhất và có timezone khi qua API.
- Money dùng kiểu số chính xác cùng currency code.
- Dữ liệu cần kiểm soát đồng thời phải có transaction/constraint hoặc concurrency token phù hợp.
- Dữ liệu Operator phải truy vết được organization ownership.

## 8.2. Identity và quyền

| Thực thể | Dữ liệu tối thiểu | Ràng buộc nghiệp vụ |
|---|---|---|
| User | ID, họ tên, email, số điện thoại, password hash, status, verifiedAt | Email/số điện thoại chuẩn hóa và duy nhất khi có giá trị; không lưu mật khẩu dạng rõ. |
| Role | ID, code, scope | Code duy nhất; scope xác định platform hoặc tenant. |
| UserRole | User ID, Role ID, Organization ID khi cần | Role tenant bắt buộc có Organization ID. |
| OrganizationMembership | User ID, Organization ID, status | Membership active không được trùng ngoài policy. |
| RefreshToken/Session | ID, User ID, token hash, expiry, revoke state | Chỉ lưu hash khi có thể; hỗ trợ rotate/revoke. |
| SecurityAudit | Actor, action, target, metadata an toàn, occurredAt | Append-only đối với actor thông thường. |

## 8.3. Nhà xe và vận hành

| Thực thể | Dữ liệu tối thiểu | Ràng buộc nghiệp vụ |
|---|---|---|
| Organization | ID, tên, pháp lý/liên hệ cần thiết, status | Là tenant root cho dữ liệu nhà xe. |
| Bus | ID, Organization ID, biển số, loại, seat template version, status | Biển số chuẩn hóa và duy nhất trong phạm vi được duyệt; soft delete. |
| Seat | ID, Bus ID, code, tầng, hàng/cột, loại, enabled | Code duy nhất trong Bus. |
| DriverProfile | ID, User ID, Organization ID, license number/expiry, status | Driver active/assignment phải thỏa license policy. |
| Route | ID, Organization ID, origin, destination, distance, duration, status | Thuộc tenant; origin và destination hợp lệ. |
| RouteStop | ID, Route ID, type, tên, địa chỉ, tọa độ nếu có, sequence, offset | Sequence duy nhất theo Route/type; thứ tự hợp lệ. |
| Trip | ID, Organization ID, Route/Bus reference, departure/arrival, fare, status, version | Arrival sau departure; Trip đã bán vé không hard delete. |
| DriverAssignment | Trip ID, Driver ID, role, start/end | Không chồng lấn cùng Driver theo buffer policy. |

## 8.4. Booking, ghế và Ticket

| Thực thể | Dữ liệu tối thiểu | Ràng buộc nghiệp vụ |
|---|---|---|
| TripSnapshot | Trip/Organization ID, Route/Stop snapshot, schedule, fare/policy version, sellable | Bảo toàn dữ liệu dùng khi Booking/Ticket được tạo. |
| TripSeat | ID, Trip ID, source Seat ID/code, status, base price, hold/Booking reference, version | Duy nhất theo Trip và ghế; là nguồn trạng thái ghế theo Trip. |
| SeatHold | ID/token hash, Customer ID, Trip ID, status, expiresAt, idempotency key | Một logical key cho cùng Customer/operation; chỉ consume một lần. |
| SeatHoldItem | Hold ID, TripSeat ID, price snapshot | Không có cùng TripSeat trong hai hold ACTIVE. |
| Booking | ID/code, Customer ID, Trip ID, status, subtotal, discount, fee, total, currency, expiry | Code duy nhất; tiền chính xác; giữ policy snapshot. |
| Passenger | ID, Booking ID, họ tên, liên hệ/giấy tờ cần thiết, pickup/dropoff | Một Passenger cho mỗi Booking Item. |
| BookingItem | Booking ID, Passenger ID, TripSeat ID, giá/discount/total | Không sửa trực tiếp sau PAID. |
| Ticket | ID/public code, Booking Item ID, QR token hash/signature, status, checkedInAt | Một Ticket có hiệu lực cho mỗi Booking Item/TripSeat. |
| Promotion | ID, scope/Organization ID, code, type/value, quota, thời hạn, status | Code duy nhất theo scope; không vượt quota. |
| PromotionRedemption | Promotion, Booking, Customer, amount | Chống ghi nhận sử dụng trùng. |
| Review | Ticket ID, Customer ID, rating, content, status | Tối đa một Review cho mỗi Ticket đủ điều kiện. |

## 8.5. Payment và Refund

| Thực thể | Dữ liệu tối thiểu | Ràng buộc nghiệp vụ |
|---|---|---|
| Payment | ID, Booking ID, amount, currency, status, provider, idempotency key | Amount lấy từ nguồn tin cậy; một logical Payment có thể có nhiều attempt. |
| PaymentAttempt | Payment ID, provider transaction ID, status, request reference, thời gian | Provider transaction ID duy nhất. |
| WebhookReceipt | Provider, external event ID, payload hash/metadata an toàn, verified, processedAt | External event ID duy nhất; không lưu dữ liệu thẻ nhạy cảm. |
| Refund | Payment/Booking ID, amount, reason, status, idempotency key | Tổng Refund thành công không vượt Payment thành công. |
| ReconciliationCase | Payment/Refund ID, loại sai lệch, status, resolution | Dùng cho callback thiếu, sai, trễ hoặc kết quả mâu thuẫn. |

## 8.6. Notification và báo cáo

| Thực thể | Dữ liệu tối thiểu | Ràng buộc nghiệp vụ |
|---|---|---|
| Notification | User ID, type, title/body an toàn, reference, read state, createdAt | Không chứa secret/PII không cần thiết. |
| DeliveryAttempt | Notification ID, channel, provider reference, status, attempt, error an toàn | Retry có giới hạn và truy vết được. |
| UserPreference | User ID, channel/type, enabled | Không tắt thông báo thiết yếu ngoài policy. |
| ReportProjection | Scope, metric, period, value, lastUpdatedAt | Không phải nguồn để cập nhật giao dịch; hiển thị độ trễ. |
| ExportJob | Actor/scope, filter, status, file reference/expiry | Kiểm tra lại quyền khi tải; audit nếu chứa PII. |

## 8.7. Ràng buộc toàn vẹn quan trọng

### 8.7.1. Ghế

- Duy nhất theo Trip và Seat/seat code.
- Tối đa một SeatHold ACTIVE hoặc một Ticket còn hiệu lực cho TripSeat.
- Giữ nhiều ghế phải commit toàn bộ hoặc rollback toàn bộ.

### 8.7.2. Booking và Ticket

- SeatHold chỉ tạo tối đa một Booking.
- Một Booking Item có đúng một Passenger.
- Booking PAID có đúng một Ticket cho mỗi item.
- Không sửa dữ liệu lịch sử bằng cách cập nhật snapshot nguồn.

### 8.7.3. Payment và Refund

- External event/transaction ID được deduplicate.
- Payment amount/currency khớp Booking payment snapshot.
- Tổng Refund thành công không vượt Payment amount.
- Gửi lặp command không tạo logical transaction mới.

### 8.7.4. Tenant

- Mọi dữ liệu Operator có organization ownership trực tiếp hoặc suy ra được bằng quan hệ đáng tin cậy.
- Server lấy tenant từ identity context; không dùng body/query parameter làm nguồn quyền.
- Export, Report và Audit cũng phải áp tenant scope.

## 8.8. Dữ liệu nhạy cảm

| Dữ liệu | Yêu cầu bảo vệ |
|---|---|
| Password | Hash bằng thuật toán password hashing phù hợp; không mã hóa có thể giải ngược. |
| Refresh token/OTP/reset token | Lưu hash khi có thể; có expiry, revoke và giới hạn thử. |
| CCCD/giấy phép | Chỉ thu thập khi có mục đích; mã hóa at rest, mask và audit truy cập. |
| Email/số điện thoại | Mask trong log và màn hình hỗ trợ khi không cần toàn bộ. |
| Payment card | Không lưu PAN/CVV; dùng token/reference của provider. |
| QR token | Lưu hash hoặc dùng chữ ký; không nhúng PII dạng rõ. |

## 8.9. Retention baseline

| Dữ liệu | Baseline |
|---|---|
| Security/audit log | 12 tháng hoặc theo policy được phê duyệt. |
| Application log | 30 ngày online, tối đa 90 ngày archive nếu cần. |
| Idempotency record | Ít nhất 24 giờ; Payment/Refund theo vòng đời đối soát. |
| Webhook receipt | 12 tháng hoặc theo yêu cầu đối soát. |
| SeatHold hết hạn | 30 ngày cho hỗ trợ/debug rồi archive/xóa theo policy. |
| Booking/Payment/Ticket/Refund | Theo nghiệp vụ và quy định được duyệt; không tự xóa khi chưa có policy. |
| Export file | Có thời hạn tải xuống ngắn và xóa tự động. |

## 8.10. Sao lưu, phục hồi và xóa

- Dữ liệu giao dịch được backup theo RPO/RTO tại chương NFR.
- Restore test được thực hiện định kỳ và có bằng chứng.
- Xóa tài khoản không tự động xóa lịch sử giao dịch bắt buộc phải lưu; dữ liệu cá nhân được xử lý theo retention/privacy policy.
- Soft-deleted/deactivated record không xuất hiện trong luồng hoạt động thông thường nhưng vẫn giữ tham chiếu lịch sử.

## 8.11. ERD

SRS không yêu cầu ERD vật lý. Khi đồ án cần hình minh họa, có thể tham khảo các ERD hiện có nhưng coi chúng là tài liệu thiết kế:

- [Bộ ERD Mermaid/Markdown theo sáu service](../system-design/02-07-database-erd/README.md)

- [ERD Identity](../diagrams/subdiagrams/data-models/erd-identity.html)
- [ERD Transport](../diagrams/subdiagrams/data-models/erd-transport.html)
- [ERD Booking](../diagrams/subdiagrams/data-models/erd-booking.html)
- [ERD Payment](../diagrams/subdiagrams/data-models/erd-payment.html)

[← Chương 7](./07-giao-dien-va-tich-hop.md) · [Mục lục](./README.md) · [Chương 9 →](./09-yeu-cau-phi-chuc-nang.md)
