# Yêu cầu giao diện người dùng

## 1. Nguyên tắc chung

| ID | Yêu cầu |
|---|---|
| UI-001 | Web End-user và Mobile MUST hỗ trợ cùng luồng nghiệp vụ; khác biệt chỉ ở trình bày và khả năng thiết bị. |
| UI-002 | Mọi màn hình dữ liệu từ xa MUST có loading, empty, error và retry state. |
| UI-003 | Client MUST không tự suy luận payment thành công từ redirect; phải đọc trạng thái server. |
| UI-004 | Đồng hồ giữ ghế hiển thị từ `expiresAt` của server và đồng bộ lại khi app resume. |
| UI-005 | Giá, phí, discount, tổng tiền, policy và thời hạn hold phải hiển thị trước xác nhận. |
| UI-006 | Các thao tác tạo booking/payment/cancel phải ngăn double-submit nhưng vẫn gửi idempotency key. |
| UI-007 | Lỗi hiển thị bằng ngôn ngữ dễ hiểu; correlation ID có thể hiển thị ở phần hỗ trợ. |
| UI-008 | Không hiển thị chức năng ngoài quyền; việc ẩn UI không thay thế authorization server. |

## 2. Web End-user

### Trang bắt buộc

- Trang chủ và form tìm kiếm.
- Danh sách kết quả, bộ lọc, sắp xếp và phân trang.
- Chi tiết chuyến, stop, policy và sơ đồ ghế.
- Nhập passenger và booking summary.
- Thanh toán và trạng thái processing/success/failure.
- Danh sách booking/ticket.
- Chi tiết ticket và QR.
- Preview/xác nhận hủy; đổi vé nếu triển khai P1.
- Hồ sơ, bảo mật tài khoản, notification preference.
- Review chuyến.

## 3. Mobile App

- Cung cấp chức năng Customer MUST tương đương Web End-user.
- Token được lưu trong secure storage của nền tảng.
- QR vẫn xem được khi mạng tạm mất nếu ticket đã được tải và policy cho phép; trạng thái phải đồng bộ lại khi online.
- Deep link/payment return phải kiểm tra state/nonce và truy vấn trạng thái từ server.
- App resume phải refresh hold/payment state, không tiếp tục dùng dữ liệu hết hạn.
- Phiên bản API không hỗ trợ phải hiển thị yêu cầu cập nhật ứng dụng.

## 4. Back-office Web

### Admin

- Dashboard nền tảng.
- Organization/user/role/membership.
- Booking/payment/refund lookup.
- Review/complaint moderation.
- Audit và báo cáo.

### Operator Staff

- Organization profile.
- Bus và seat template.
- Driver và license.
- Route, stop và trip scheduler.
- Manifest, booking và trip operation.
- Revenue/occupancy theo tenant.

### Driver

- Chuyến được phân công.
- Manifest tối thiểu.
- QR scan/manual code.
- Cập nhật trạng thái chuyến theo quyền.

Back-office responsive là baseline để Driver dùng trên điện thoại mà không cần app riêng trong MVP.

## 5. Sơ đồ ghế

- Phân biệt `AVAILABLE`, `HELD`, `BOOKED`, `DISABLED` không chỉ bằng màu; phải có nhãn/icon/pattern phù hợp.
- `SELECTED` là trạng thái UI cục bộ.
- Khi server từ chối ghế vừa chọn, UI cập nhật lại availability và giữ các ghế còn lại chỉ khi response xác nhận hold một phần; baseline không cho partial hold nên phải yêu cầu chọn lại.
- Ghế phải truy cập được bằng bàn phím trên Web và có accessible name.

## 6. Accessibility và responsive

- Mục tiêu WCAG 2.1 AA cho luồng Customer cốt lõi.
- Có focus visible, label form, thông báo lỗi liên kết với field và thứ tự tab hợp lý.
- Không dùng màu làm tín hiệu duy nhất.
- Web hỗ trợ viewport từ 360 px và desktop phổ biến.
- QR có mã chữ thay thế để nhập thủ công.

## 7. Localization

- MVP hỗ trợ tiếng Việt.
- Text UI không hard-code trong component để có thể bổ sung tiếng Anh.
- Tiền hiển thị theo `vi-VN`, VND; dữ liệu API vẫn là giá trị số và currency code.
- Thời gian hiển thị kèm timezone/ngữ cảnh chuyến khi có khả năng gây nhầm lẫn.
