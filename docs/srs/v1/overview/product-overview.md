# Tổng quan sản phẩm

## 1. Bài toán

Hệ thống cung cấp một nền tảng chung để khách hàng tìm chuyến, giữ ghế, đặt và thanh toán vé xe khách. Nhà xe quản lý phương tiện, tài xế, tuyến, chuyến và hành khách; quản trị viên quản lý nền tảng; tài xế kiểm tra danh sách và xác nhận khách lên xe.

## 2. Mục tiêu sản phẩm

| ID | Mục tiêu |
|---|---|
| GOAL-001 | Hoàn thiện và cung cấp đầy đủ các chức năng cốt lõi của hệ thống đặt vé xe khách, bao phủ quản lý tài khoản, tìm chuyến, giữ ghế, booking, thanh toán, phát hành vé, hủy/đổi/hoàn tiền, vận hành chuyến, check-in, quản trị và báo cáo. |
| GOAL-002 | Đảm bảo tính chính xác và nhất quán của ghế, giá, booking, payment, ticket và refund trong toàn bộ vòng đời giao dịch. |
| GOAL-003 | Đảm bảo an toàn, quyền riêng tư và phân quyền dữ liệu để mỗi người dùng chỉ truy cập đúng dữ liệu của mình, còn Operator chỉ quản lý dữ liệu thuộc tổ chức của mình. |
| GOAL-004 | Cung cấp đầy đủ và nhất quán ba kênh sử dụng gồm Web End-user, Mobile App và Back-office Web, phù hợp với phạm vi của Guest, Customer, Admin, Operator Staff và Driver. |
| GOAL-005 | Cung cấp trải nghiệm dễ sử dụng, minh bạch, responsive và có khả năng tiếp cận cho các luồng nghiệp vụ cốt lõi. |
| GOAL-006 | Đảm bảo hệ thống có hiệu năng phù hợp, hoạt động ổn định, có khả năng mở rộng và phục hồi khi tải tăng hoặc dịch vụ ngoài gặp lỗi. |
| GOAL-007 | Cung cấp khả năng audit, truy vết, báo cáo và đối soát đáng tin cậy cho booking, payment, refund và hoạt động vận hành. |

## 3. Kênh sử dụng

| Client | Người dùng chính | Phạm vi |
|---|---|---|
| Web End-user | Guest, Customer | Tìm kiếm, đặt vé, thanh toán, quản lý vé, đánh giá |
| Mobile App | Customer | Chức năng tương đương Web End-user với UX cho mobile |
| Back-office Web | Admin, Operator Staff, Driver | Quản trị nền tảng, vận hành nhà xe, chuyến và check-in |

## 4. Nguyên tắc sản phẩm

- Một nguồn dữ liệu nghiệp vụ duy nhất phía server.
- Không tin dữ liệu giá, quyền hoặc trạng thái do client gửi lên.
- Trạng thái quan trọng thay đổi thông qua command có kiểm tra điều kiện.
- Mọi giao dịch payment/refund có mã đối soát và lịch sử bất biến.
- Customer phải thấy giá, chính sách hủy/đổi và thời hạn giữ ghế trước khi xác nhận.
- Chức năng nền tảng phải tách tenant; Operator không đọc hoặc sửa dữ liệu nhà xe khác.

## 5. Phạm vi MVP

### MUST

- Đăng ký, xác minh và đăng nhập.
- Tìm kiếm và xem chi tiết chuyến.
- Xem sơ đồ ghế, giữ ghế, tạo booking.
- Thanh toán, nhận vé QR và xem lịch sử.
- Hủy vé và tạo refund theo chính sách.
- Operator quản lý xe, tài xế, tuyến và chuyến.
- Driver xem chuyến được phân công và check-in vé.
- Admin quản lý user, tổ chức, đánh giá và báo cáo cơ bản.
- Email/in-app notification.

### SHOULD

- Đổi vé.
- Promotion/voucher.
- Export báo cáo CSV.
- Push notification.

### COULD

- Theo dõi vị trí xe.
- Gợi ý chuyến bằng AI.
- Loyalty point.
- Dynamic pricing.
- SMS notification.

## 6. Ngoài phạm vi MVP

- Lưu hoặc xử lý trực tiếp dữ liệu thẻ ngân hàng.
- Điều phối vận tải thời gian thực bằng GPS.
- Kế toán tổng hợp cho nhà xe.
- Marketplace bán hàng hóa ngoài vé xe.
- Tối ưu tuyến tự động.

## 7. Tiêu chí thành công cấp sản phẩm

- GOAL-001 — Các luồng chức năng MUST cho Customer, Operator Staff, Driver và Admin được triển khai và vượt qua kiểm thử end-to-end tương ứng.
- GOAL-002 — Kiểm thử nghiệp vụ và concurrency không phát hiện double-booking, sai giá phía server, duplicate booking/payment/ticket/refund hoặc chuyển trạng thái không hợp lệ.
- GOAL-003 — Kiểm thử authorization, tenant isolation và privacy xác nhận người dùng chỉ truy cập đúng dữ liệu được phép và dữ liệu nhạy cảm không bị lộ qua API, UI hoặc log.
- GOAL-004 — Web End-user, Mobile App và Back-office Web hoàn tất được các luồng MUST thuộc phạm vi; Web và Mobile cung cấp luồng Customer tương đương trên cùng trạng thái nghiệp vụ phía server.
- GOAL-005 — Luồng Customer cốt lõi đáp ứng baseline responsive, accessibility, loading/empty/error/retry và hiển thị đầy đủ giá, policy, thời hạn giữ ghế trước khi xác nhận.
- GOAL-006 — Các chỉ tiêu hiệu năng, tải, availability và phục hồi đạt baseline; callback trễ/lặp và lỗi dịch vụ ngoài không làm sai trạng thái giao dịch đã xác nhận.
- GOAL-007 — Có thể truy vết một giao dịch từ booking qua payment, ticket/refund và notification bằng ID nghiệp vụ/correlation ID; báo cáo và dữ liệu đối soát đúng phạm vi tenant.
