# 2. Tổng quan sản phẩm

[← Chương 1](./01-gioi-thieu.md) · [Mục lục](./README.md) · [Chương 3 →](./03-quy-trinh-va-quy-tac-nghiep-vu.md)

## 2.1. Bài toán

Customer hiện cần một kênh thống nhất để tìm chuyến, kiểm tra ghế, đặt và thanh toán vé, nhận vé điện tử, theo dõi lịch sử và xử lý hủy/đổi. Nhà xe cần quản lý dữ liệu vận hành trong đúng phạm vi tổ chức, còn Driver cần công cụ tối giản để xem chuyến và check-in. Admin cần quản trị nền tảng, audit và báo cáo mà không phá vỡ lịch sử giao dịch.

Sản phẩm giải quyết bài toán bằng một nguồn trạng thái nghiệp vụ phía server dùng chung cho ba kênh. Client chỉ hiển thị và gửi command; client không quyết định giá, quyền, trạng thái thanh toán hoặc quyền sở hữu dữ liệu.

## 2.2. Mục tiêu sản phẩm

| ID | Mục tiêu |
|---|---|
| GOAL-001 | Hoàn thiện và cung cấp đầy đủ các chức năng cốt lõi của hệ thống đặt vé xe khách, bao phủ quản lý tài khoản, tìm chuyến, giữ ghế, booking, thanh toán, phát hành vé, hủy/đổi/hoàn tiền, vận hành chuyến, check-in, quản trị và báo cáo. |
| GOAL-002 | Đảm bảo tính chính xác và nhất quán của ghế, giá, booking, payment, ticket và refund trong toàn bộ vòng đời giao dịch. |
| GOAL-003 | Đảm bảo an toàn, quyền riêng tư và phân quyền dữ liệu để mỗi người dùng chỉ truy cập đúng dữ liệu của mình, còn Operator chỉ quản lý dữ liệu thuộc tổ chức của mình. |
| GOAL-004 | Cung cấp đầy đủ và nhất quán ba kênh sử dụng gồm Web End-user, Mobile App và Back-office Web, phù hợp với phạm vi của Guest, Customer, Admin, Operator Staff và Driver. |
| GOAL-005 | Cung cấp trải nghiệm dễ sử dụng, minh bạch, responsive và có khả năng tiếp cận cho các luồng nghiệp vụ cốt lõi. |
| GOAL-006 | Đảm bảo hệ thống có hiệu năng phù hợp, hoạt động ổn định, có khả năng mở rộng và phục hồi khi tải tăng hoặc dịch vụ ngoài gặp lỗi. |
| GOAL-007 | Cung cấp khả năng audit, truy vết, báo cáo và đối soát đáng tin cậy cho booking, payment, refund và hoạt động vận hành. |

## 2.3. Kênh sử dụng

| Kênh | Người dùng chính | Phạm vi |
|---|---|---|
| Web End-user | Guest, Customer | Đăng ký, tìm kiếm, đặt vé, thanh toán, quản lý vé, hủy/đổi và đánh giá. |
| Mobile App | Customer | Chức năng Customer tương đương Web End-user với trải nghiệm phù hợp thiết bị di động. |
| Back-office Web | Admin, Operator Staff, Driver | Quản trị nền tảng, quản lý nhà xe, vận hành Trip, check-in và báo cáo. |

## 2.4. Actor

### 2.4.1. Guest

Guest được tìm kiếm và xem dữ liệu Trip công khai, đăng ký và đăng nhập. Guest không được tạo SeatHold hoặc Booking.

### 2.4.2. Customer

Customer quản lý hồ sơ, giữ ghế, tạo Booking, thanh toán, xem Ticket, yêu cầu hủy/đổi, nhận Notification và đánh giá chuyến đã sử dụng. Customer chỉ truy cập giao dịch thuộc chính mình.

### 2.4.3. Operator Staff

Operator Staff quản lý Organization, xe, tài xế, tuyến, Trip, manifest và báo cáo theo permission. Mọi truy vấn và thay đổi phải bị giới hạn bởi `organizationId` từ identity context.

### 2.4.4. Driver

Driver chỉ được xem Trip được phân công, manifest tối thiểu cần thiết, check-in Ticket và chuyển trạng thái Trip theo quyền được cấp.

### 2.4.5. Admin

Admin quản lý Organization, User, role, membership, review/khiếu nại, tra cứu giao dịch, audit và báo cáo nền tảng. Hành động nhạy cảm phải được audit.

### 2.4.6. Hệ thống bên ngoài

- Payment Gateway nhận yêu cầu thanh toán/refund và gửi webhook có chữ ký.
- Notification Provider gửi email, SMS hoặc push; nhà cung cấp này không quyết định trạng thái nghiệp vụ.

## 2.5. Phạm vi chức năng

### 2.5.1. MUST

- Đăng ký, xác minh, đăng nhập, refresh, logout và reset mật khẩu.
- Xem và cập nhật hồ sơ.
- Tìm kiếm, lọc, sắp xếp và xem chi tiết Trip.
- Xem sơ đồ ghế, giữ ghế và tạo Booking.
- Thanh toán, nhận Ticket QR và xem lịch sử.
- Hủy Ticket/Booking và tạo Refund theo policy.
- Operator quản lý Organization, Bus, Seat, Driver, Route, Stop và Trip.
- Driver xem assignment, manifest và check-in.
- Admin quản lý User, Organization, role và tenant membership.
- Tra cứu giao dịch, audit và báo cáo cơ bản.
- Email và in-app Notification cho sự kiện giao dịch quan trọng.

### 2.5.2. SHOULD

- Đổi Trip/ghế theo policy.
- Promotion/voucher.
- Review và kiểm duyệt Review.
- Export báo cáo CSV.
- Push Notification.
- Job đối soát Payment/Refund chưa có kết quả cuối.

### 2.5.3. COULD

- Theo dõi vị trí xe.
- Gợi ý Trip bằng AI.
- Loyalty point.
- Dynamic pricing.
- SMS Notification.

### 2.5.4. Ngoài phạm vi MVP

- Lưu hoặc xử lý trực tiếp PAN/CVV.
- Điều phối GPS thời gian thực.
- Kế toán tổng hợp cho nhà xe.
- Marketplace ngoài vé xe.
- Tối ưu Route tự động.

## 2.6. Nguyên tắc sản phẩm

- Server là nguồn quyết định giá, quyền và trạng thái.
- Không bán thành công cùng một TripSeat cho hai Ticket còn hiệu lực.
- Giữ nhiều ghế phải thành công toàn bộ hoặc thất bại toàn bộ.
- Command tạo giao dịch phải có cơ chế chống xử lý lặp.
- Payment redirect không phải bằng chứng thanh toán; trạng thái server đã xác minh mới là nguồn quyết định.
- Booking, Payment, Ticket và Refund phải truy vết được bằng ID nghiệp vụ và correlation ID.
- Dữ liệu nhà xe được cô lập theo tenant.
- Web và Mobile dùng cùng hợp đồng và quy tắc nghiệp vụ phía server.

## 2.7. Ma trận quyền cấp cao

| Chức năng | Guest | Customer | Driver | Operator Staff | Admin |
|---|---:|---:|---:|---:|---:|
| Tìm kiếm/xem Trip công khai | Có | Có | Có | Có | Có |
| Giữ ghế, Booking và thanh toán | Không | Của mình | Không | Không | Hỗ trợ tra cứu |
| Xem Ticket | Không | Của mình | Theo Trip được giao | Theo tenant | Theo quyền hỗ trợ |
| Check-in | Không | Không | Trip được giao | Theo tenant/quyền | Theo quyền đặc biệt |
| Quản lý xe/tài xế/tuyến/Trip | Không | Không | Không | Theo tenant/quyền | Toàn nền tảng |
| Xem doanh thu | Không | Không | Không | Theo tenant/quyền | Toàn nền tảng |
| Quản lý Organization/User/role | Không | Không | Không | Hạn chế | Có |
| Xem audit | Không | Không | Không | Theo tenant/quyền | Có |

## 2.8. Bối cảnh và ranh giới

Hệ thống bao gồm các client, backend nghiệp vụ, cơ chế lưu trữ, message broker/cache khi cần và khả năng quan sát. Payment Gateway và Notification Provider là hệ thống ngoài. Hệ thống không cam kết SLA của bên ngoài nhưng phải có timeout, retry có giới hạn, idempotency, đối soát và xử lý thủ công khi cần.

[Mở System Context Diagram](../diagrams/subdiagrams/overview/system-context.html)

## 2.9. Giả định và phụ thuộc

- Thiết bị client có kết nối Internet cho giao dịch online.
- Payment Gateway hỗ trợ HTTPS webhook và mã giao dịch duy nhất.
- Notification Provider có API/SMTP phù hợp.
- Nhà xe chịu trách nhiệm về độ chính xác của lịch chạy, điểm đón/trả, giá và policy.
- Trip đã publish dùng snapshot xe/ghế, lịch, giá và policy để lịch sử không bị thay đổi bởi dữ liệu nguồn.
- Giá trị tiền mặc định là VND và được lưu bằng kiểu chính xác.

## 2.10. Ràng buộc

- Dữ liệu trao đổi qua HTTPS và JSON UTF-8 cho public API.
- Public API được version hóa.
- Dữ liệu nhạy cảm không xuất hiện trong log.
- Phiên bản client không còn tương thích phải nhận lỗi nâng cấp rõ ràng.
- Timestamp API dùng ISO-8601 có timezone; dữ liệu lưu trữ theo quy ước thời gian thống nhất.
- Mọi hành vi MUST phải có Acceptance Criteria hoặc Test Case truy vết được.

[← Chương 1](./01-gioi-thieu.md) · [Mục lục](./README.md) · [Chương 3 →](./03-quy-trinh-va-quy-tac-nghiep-vu.md)
