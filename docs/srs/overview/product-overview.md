# Tổng quan sản phẩm

## 1. Bài toán

Hệ thống cung cấp một nền tảng chung để khách hàng tìm chuyến, giữ ghế, đặt và thanh toán vé xe khách. Nhà xe quản lý phương tiện, tài xế, tuyến, chuyến và hành khách; quản trị viên quản lý nền tảng; tài xế kiểm tra danh sách và xác nhận khách lên xe.

## 2. Mục tiêu sản phẩm

| ID | Mục tiêu |
|---|---|
| GOAL-001 | Customer hoàn tất quy trình tìm chuyến đến nhận vé điện tử trên Web hoặc Mobile. |
| GOAL-002 | Không bán thành công cùng một ghế của cùng một chuyến cho hai vé còn hiệu lực. |
| GOAL-003 | Web và Mobile sử dụng cùng hợp đồng API và cùng quy tắc nghiệp vụ. |
| GOAL-004 | Operator quản lý đúng dữ liệu thuộc tổ chức của mình. |
| GOAL-005 | Payment và Booking vẫn nhất quán khi callback trễ, lặp hoặc dịch vụ ngoài lỗi. |
| GOAL-006 | Hệ thống cung cấp audit và báo cáo đủ để đối soát booking, payment và refund. |

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

- Các acceptance test P0 trong tài liệu 15 đều đạt.
- Không phát hiện double-booking trong kiểm thử concurrency.
- Ba client gọi được cùng API Gateway và tuân thủ phân quyền.
- Có thể khởi chạy toàn bộ hạ tầng local bằng một quy trình được tài liệu hóa.
- Có log liên kết xuyên service bằng correlation ID cho một booking hoàn chỉnh.
