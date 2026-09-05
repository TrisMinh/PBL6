# 7. Yêu cầu giao diện và tích hợp

[← Chương 6](./06-yeu-cau-trang-thai.md) · [Mục lục](./README.md) · [Chương 8 →](./08-yeu-cau-du-lieu.md)

## 7.1. Nguyên tắc giao diện chung

| ID | Yêu cầu |
|---|---|
| UI-001 | Web End-user và Mobile App phải hỗ trợ cùng luồng Customer cốt lõi; khác biệt chỉ ở trình bày và khả năng thiết bị. |
| UI-002 | Màn hình phụ thuộc dữ liệu từ xa phải có loading, empty, error và retry state. |
| UI-003 | Client không được tự suy luận Payment thành công từ redirect/deep link; phải đọc trạng thái server. |
| UI-004 | Đồng hồ SeatHold hiển thị từ `expiresAt` của server và đồng bộ lại khi app resume/tab active. |
| UI-005 | Giá, phí, discount, tổng tiền, policy và thời hạn giữ ghế phải hiển thị trước xác nhận. |
| UI-006 | Thao tác tạo SeatHold, Booking, Payment, cancel và Refund phải ngăn double-submit và gửi idempotency key. |
| UI-007 | Lỗi hiển thị bằng ngôn ngữ dễ hiểu; correlation ID có thể hiển thị trong phần hỗ trợ. |
| UI-008 | Client không hiển thị chức năng ngoài quyền, nhưng server vẫn phải thực thi authorization độc lập. |
| UI-009 | Trạng thái và thuật ngữ phải nhất quán giữa Web, Mobile và Back-office. |
| UI-010 | Thao tác không thể hoàn tác phải có bước xác nhận và nêu rõ tác động. |

## 7.2. Web End-user

### 7.2.1. Trang chủ và tìm kiếm

- Form điểm đi, điểm đến, ngày đi và số hành khách.
- Kiểm tra dữ liệu tại client để hỗ trợ người dùng; server vẫn xác minh lại.
- Lưu/gợi ý tìm kiếm gần đây không được thu thập PII không cần thiết.

### 7.2.2. Danh sách kết quả

- Hiển thị nhà xe, giờ đi/đến, thời lượng, giá từ, tiện nghi và số ghế khả dụng tham khảo.
- Hỗ trợ lọc, sắp xếp và phân trang.
- Hiển thị thời điểm availability được cập nhật nếu có khả năng thay đổi nhanh.
- Danh sách rỗng phải hướng dẫn đổi ngày/điểm/bộ lọc.

### 7.2.3. Chi tiết Trip và sơ đồ ghế

- Hiển thị Route/Stop, thời gian, Bus, tiện nghi, fare và policy.
- Phân biệt AVAILABLE, HELD, BOOKED, DISABLED bằng nhãn/icon/pattern, không chỉ bằng màu.
- SELECTED là trạng thái cục bộ và không được trình bày như ghế đã giữ.
- Sau phản hồi `SEAT_UNAVAILABLE`, giao diện cập nhật availability và yêu cầu chọn lại.
- Sơ đồ ghế dùng được bằng bàn phím và có accessible name.

### 7.2.4. Passenger và Booking summary

- Một form Passenger cho mỗi ghế.
- Hiển thị điểm đón/trả hợp lệ của Trip.
- Hiển thị SeatHold countdown, giá từng item, subtotal, discount, fee, total và policy.
- Khi hold hết hạn, khóa bước xác nhận và yêu cầu giữ lại ghế.

### 7.2.5. Payment

- Hiển thị Booking code, amount, currency, phương thức và thời hạn.
- Trạng thái tối thiểu: chờ thao tác, đang xử lý, thành công, thất bại, đã hủy và cần hỗ trợ.
- Không khuyến khích thanh toán lại khi trạng thái provider chưa chắc chắn.
- Sau redirect, client truy vấn server; không tin query parameter để phát hành Ticket.

### 7.2.6. Booking và Ticket

- Danh sách sắp đi, đã dùng, bị hủy/hoàn và đã hết hạn.
- Chi tiết có Passenger, Trip, ghế, điểm đón/trả, giá và trạng thái tài chính.
- Ticket ISSUED hiển thị QR và public code thay thế.
- Ticket CANCELLED/REFUNDED/USED không hiển thị như vé còn hiệu lực.

### 7.2.7. Hủy và đổi vé

- Preview hiển thị policy version, phí, số tiền hoàn, thời gian dự kiến và tác động tới ghế/Ticket.
- Bước xác nhận dùng command idempotent.
- Refund PROCESSING/FAILED phải có thông điệp và hành động tiếp theo.
- Đổi vé chỉ hiển thị khi feature được bật và Ticket đủ điều kiện.

### 7.2.8. Hồ sơ, Notification và Review

- Xem/cập nhật hồ sơ và xác minh lại định danh thay đổi.
- Xem Notification, đánh dấu đã đọc và cấu hình kênh tùy chọn.
- Chỉ hiển thị chức năng Review cho Ticket đủ điều kiện.

## 7.3. Mobile App

- Cung cấp chức năng Customer MUST tương đương Web End-user.
- Credential được lưu trong secure storage của nền tảng.
- Deep link/payment return kiểm tra state/nonce và truy vấn trạng thái server.
- App resume phải refresh SeatHold, Booking và Payment state.
- Ticket đã tải có thể xem khi mạng tạm mất nếu policy cho phép; trạng thái phải đồng bộ khi online.
- QR offline không được dùng để bỏ qua việc Driver xác minh với server, trừ khi có offline policy riêng được phê duyệt.
- Phiên bản API không hỗ trợ phải hiển thị yêu cầu cập nhật ứng dụng rõ ràng.
- Push Notification không được chứa PII hoặc token nhạy cảm trong nội dung hiển thị công khai.

## 7.4. Back-office Web

### 7.4.1. Admin

- Dashboard nền tảng.
- Organization, User, role và membership.
- Tra cứu Booking, Payment, Refund và audit.
- Review/khiếu nại.
- Báo cáo và Export Job.
- Hành động nhạy cảm phải yêu cầu xác nhận, reason và quyền phù hợp.

### 7.4.2. Operator Staff

- Organization profile.
- Bus và Seat template.
- Driver và license.
- Route, Stop và Trip scheduler.
- Manifest, Booking và Trip operation.
- Revenue/occupancy theo tenant và permission.
- Không cho chọn organization tùy ý ngoài scope từ token/context.

### 7.4.3. Driver

- Danh sách Trip được phân công.
- Manifest tối thiểu.
- QR scan và nhập public code.
- Kết quả check-in rõ ràng cho hợp lệ, sai Trip, đã check-in hoặc Ticket không còn hiệu lực.
- Cập nhật Trip state theo transition và assignment.

Back-office phải responsive đủ cho Driver sử dụng trên thiết bị di động trong MVP nếu chưa có Driver App riêng.

## 7.5. Accessibility và localization

- Mục tiêu WCAG 2.1 AA cho đăng nhập, tìm kiếm, chọn ghế, Booking, Payment và Ticket.
- Có focus visible, label form, thông báo lỗi liên kết với trường và thứ tự tab hợp lý.
- Không dùng màu làm tín hiệu duy nhất.
- Web hỗ trợ viewport từ 360 px và desktop phổ biến.
- QR có mã chữ thay thế để nhập thủ công.
- MVP hỗ trợ tiếng Việt; nội dung UI không hard-code để có thể bổ sung ngôn ngữ.
- Tiền hiển thị theo locale nhưng API giữ amount số chính xác và currency code.
- Thời gian hiển thị kèm timezone/ngữ cảnh khi có khả năng gây nhầm lẫn.

## 7.6. Hợp đồng API dùng chung

| Hạng mục | Yêu cầu |
|---|---|
| Giao thức | HTTPS |
| Định dạng | JSON UTF-8 |
| Phiên bản | Public API có version ổn định |
| Xác thực | Bearer token hoặc cookie bảo mật đã được duyệt |
| Correlation | Mỗi request có correlation ID; server tạo nếu client không gửi |
| Idempotency | Bắt buộc cho hold, Booking, Payment, cancel, Refund và command quan trọng |
| Thời gian | ISO-8601 có timezone; quy ước lưu trữ thống nhất |
| Phân trang | Page/size hoặc cursor; có giới hạn page size |
| Client version | Cho phép kiểm soát tương thích Mobile/Web khi cần |

Quy tắc:

- Dùng HTTP status đúng ngữ nghĩa; không trả 200 cho lỗi nghiệp vụ.
- Client xử lý theo error code ổn định, không parse message.
- Validation error chứa danh sách field/reason an toàn.
- Không trả stack trace, query, tên bảng, secret hoặc payload provider nhạy cảm.
- Chi tiết endpoint và schema được quản lý trong OpenAPI riêng.

## 7.7. Error response

Error response tối thiểu gồm:

- `code`: mã ổn định cho client.
- `message`: thông điệp an toàn có thể hiển thị.
- `details`: dữ liệu bổ sung đã lọc, ví dụ ghế bị ảnh hưởng hoặc field error.
- `correlationId`: mã phục vụ hỗ trợ và truy vết.

Danh mục mã lỗi baseline nằm trong [Phụ lục](./11-phu-luc.md).

## 7.8. Payment Gateway

### Yêu cầu trao đổi

- Mỗi Payment intent có reference duy nhất, amount, currency và callback/return URL phù hợp.
- Callback/webhook được xác minh signature, provider, event ID, transaction ID, amount và currency.
- Webhook endpoint có rate/source controls phù hợp và không dùng token User.
- External event ID và provider transaction ID được deduplicate.
- Refund dùng reference/idempotency riêng và được theo dõi đến trạng thái cuối.

### Timeout và phục hồi

- Timeout không tự động đồng nghĩa Payment FAILED nếu provider có thể đã nhận request.
- Trạng thái chưa chắc chắn giữ PROCESSING và chờ webhook/reconciliation.
- Không retry charge không idempotent một cách mù quáng.
- Callback trễ không được gây double-book; tạo compensation/manual case khi không cấp được Ticket.

## 7.9. Notification Provider

- Hỗ trợ các kênh được chọn trong phạm vi: email, in-app, push và SMS.
- Mỗi lần gửi có DeliveryAttempt và trạng thái.
- Lỗi tạm thời retry có backoff/giới hạn; lỗi cuối cùng được ghi nhận/cảnh báo.
- Notification không nằm trên critical path xác nhận Booking/Payment.
- Template không được đưa secret, full token hoặc PII không cần thiết.

## 7.10. Tương thích hợp đồng

- Field mới trong cùng version phải optional hoặc có default tương thích.
- Xóa/đổi nghĩa field bắt buộc phải tạo version mới hoặc kế hoạch migration.
- Consumer bỏ qua field chưa biết.
- Web và Mobile dùng cùng error code và semantics.
- Contract test tối thiểu bao phủ Booking–Payment và Trip–Booking.

[← Chương 6](./06-yeu-cau-trang-thai.md) · [Mục lục](./README.md) · [Chương 8 →](./08-yeu-cau-du-lieu.md)
