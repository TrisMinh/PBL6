# SOFTWARE REQUIREMENTS SPECIFICATION (SRS)
## HỆ THỐNG ĐẶT VÉ XE KHÁCH TRỰC TUYẾN

**Tên hệ thống:** Online Bus Ticket Booking System  
**Phiên bản:** 1.0  
**Loại tài liệu:** Software Requirements Specification  
**Đối tượng:** Hệ thống web đặt vé xe khách trực tuyến

---

# 1. GIỚI THIỆU

## 1.1. Mục đích tài liệu

Tài liệu Software Requirements Specification (SRS) mô tả đầy đủ các yêu cầu chức năng và phi chức năng của hệ thống đặt vé xe khách trực tuyến.

Tài liệu được sử dụng làm cơ sở cho:

- Phân tích nghiệp vụ.
- Thiết kế hệ thống.
- Thiết kế cơ sở dữ liệu.
- Thiết kế giao diện.
- Thiết kế API.
- Xây dựng Use Case Diagram.
- Xây dựng Robustness Diagram.
- Xây dựng Sequence Diagram.
- Xây dựng Class Diagram.
- Lập kế hoạch kiểm thử.
- Triển khai và bảo trì hệ thống.

---

## 1.2. Phạm vi hệ thống

Hệ thống cho phép khách hàng tìm kiếm các chuyến xe, xem thông tin chuyến đi, lựa chọn ghế, đặt vé, thanh toán và quản lý vé trực tuyến.

Hệ thống đồng thời cung cấp cho nhà xe và quản trị viên các chức năng quản lý:

- Tuyến đường.
- Điểm đón/trả.
- Xe.
- Tài xế.
- Chuyến xe.
- Sơ đồ ghế.
- Giá vé.
- Đơn đặt vé.
- Thanh toán.
- Khuyến mãi.
- Người dùng.
- Đánh giá.
- Báo cáo thống kê.

---

# 2. TỔNG QUAN HỆ THỐNG

## 2.1. Mục tiêu

Hệ thống hướng tới các mục tiêu:

1. Cho phép khách hàng đặt vé xe trực tuyến.
2. Giảm thời gian tìm kiếm và mua vé.
3. Hiển thị tình trạng ghế theo thời gian thực hoặc gần thời gian thực.
4. Hỗ trợ thanh toán trực tuyến.
5. Cho phép khách hàng quản lý lịch sử đặt vé.
6. Cho phép nhà xe quản lý chuyến xe.
7. Cho phép quản trị viên quản lý toàn bộ hệ thống.
8. Cung cấp báo cáo doanh thu và hoạt động.
9. Hạn chế tình trạng đặt trùng ghế.
10. Tự động gửi thông tin xác nhận vé cho khách hàng.

---

# 3. ACTOR CỦA HỆ THỐNG

## 3.1. Guest – Khách chưa đăng nhập

Guest có thể:

- Xem trang chủ.
- Tìm kiếm chuyến xe.
- Xem thông tin nhà xe.
- Xem thông tin chuyến xe.
- Xem sơ đồ ghế.
- Đăng ký tài khoản.
- Đăng nhập.

Guest không thể hoàn tất việc đặt vé nếu hệ thống yêu cầu tài khoản.

---

## 3.2. Customer – Khách hàng

Customer có thể:

- Đăng nhập.
- Tìm kiếm chuyến xe.
- Lọc chuyến xe.
- Xem chi tiết chuyến.
- Chọn ghế.
- Nhập thông tin hành khách.
- Đặt vé.
- Thanh toán.
- Nhận vé điện tử.
- Xem vé đã đặt.
- Hủy vé theo chính sách.
- Xem lịch sử đặt vé.
- Đánh giá chuyến đi.
- Quản lý thông tin cá nhân.

---

## 3.3. Driver – Tài xế

Driver có thể:

- Đăng nhập.
- Xem các chuyến được phân công.
- Xem thông tin chuyến.
- Xem danh sách hành khách.
- Xác nhận đón khách.
- Cập nhật trạng thái chuyến.
- Cập nhật trạng thái hoàn thành chuyến.

---

## 3.4. Bus Operator – Nhà xe

Bus Operator có thể:

- Quản lý thông tin nhà xe.
- Quản lý xe.
- Quản lý tài xế.
- Quản lý tuyến đường.
- Quản lý điểm đón/trả.
- Tạo chuyến xe.
- Cập nhật chuyến xe.
- Xóa/hủy chuyến.
- Thiết lập giá vé.
- Quản lý sơ đồ ghế.
- Xem danh sách hành khách.
- Quản lý đơn đặt vé.
- Xem doanh thu.

---

## 3.5. Admin – Quản trị viên

Admin có quyền cao nhất trong hệ thống.

Admin có thể:

- Quản lý tài khoản.
- Quản lý khách hàng.
- Quản lý nhà xe.
- Quản lý tài xế.
- Quản lý xe.
- Quản lý tuyến đường.
- Quản lý chuyến xe.
- Quản lý đơn đặt vé.
- Quản lý thanh toán.
- Quản lý khuyến mãi.
- Quản lý đánh giá.
- Quản lý khiếu nại.
- Xem báo cáo.
- Khóa/mở khóa tài khoản.
- Xử lý các vấn đề phát sinh.

---

## 3.6. Payment Gateway – Cổng thanh toán

Hệ thống bên thứ ba thực hiện:

- Tiếp nhận yêu cầu thanh toán.
- Xử lý giao dịch.
- Trả kết quả thanh toán.
- Cung cấp mã giao dịch.

---

## 3.7. Notification Service

Dịch vụ thông báo có nhiệm vụ:

- Gửi email xác nhận.
- Gửi thông báo đặt vé.
- Gửi thông báo thanh toán.
- Gửi thông báo hủy vé.
- Gửi thông báo thay đổi chuyến.

---

# 4. YÊU CẦU CHỨC NĂNG

# FR-01. QUẢN LÝ TÀI KHOẢN

## FR-01.1. Đăng ký tài khoản

Người dùng có thể đăng ký tài khoản bằng:

- Họ tên.
- Email.
- Số điện thoại.
- Mật khẩu.
- Xác nhận mật khẩu.

Hệ thống phải:

1. Kiểm tra dữ liệu nhập.
2. Kiểm tra email đã tồn tại hay chưa.
3. Kiểm tra số điện thoại.
4. Kiểm tra độ mạnh mật khẩu.
5. Tạo tài khoản nếu dữ liệu hợp lệ.
6. Thông báo đăng ký thành công.

---

## FR-01.2. Đăng nhập

Người dùng nhập:

- Email/số điện thoại.
- Mật khẩu.

Hệ thống kiểm tra thông tin xác thực.

Nếu hợp lệ:

- Tạo phiên đăng nhập/token.
- Chuyển người dùng đến trang phù hợp với role.

Nếu không hợp lệ:

- Hiển thị thông báo lỗi.

---

## FR-01.3. Đăng xuất

Người dùng có thể đăng xuất khỏi hệ thống.

Hệ thống phải:

- Hủy session/token hiện tại.
- Chuyển người dùng về trang đăng nhập hoặc trang chủ.

---

## FR-01.4. Quên mật khẩu

Người dùng nhập email.

Hệ thống:

1. Kiểm tra tài khoản.
2. Gửi mã OTP hoặc link đặt lại mật khẩu.
3. Xác thực OTP/link.
4. Cho phép tạo mật khẩu mới.

---

## FR-01.5. Cập nhật thông tin cá nhân

Customer có thể cập nhật:

- Họ tên.
- Số điện thoại.
- Email.
- Ngày sinh.
- Giới tính.
- Ảnh đại diện.

---

# FR-02. TÌM KIẾM CHUYẾN XE

Customer có thể tìm kiếm bằng:

- Điểm đi.
- Điểm đến.
- Ngày đi.
- Số lượng hành khách.

Ví dụ:

**Đà Nẵng → Huế | 20/08/2026 | 2 người**

Hệ thống trả về danh sách chuyến phù hợp.

Thông tin mỗi chuyến gồm:

- Nhà xe.
- Tên chuyến.
- Điểm đi.
- Điểm đến.
- Giờ khởi hành.
- Giờ dự kiến đến.
- Thời gian di chuyển.
- Loại xe.
- Giá vé.
- Số ghế còn lại.
- Đánh giá nhà xe.

---

# FR-03. LỌC VÀ SẮP XẾP CHUYẾN XE

Customer có thể lọc theo:

- Khoảng giá.
- Giờ khởi hành.
- Nhà xe.
- Loại xe.
- Số ghế còn.
- Điểm đón.
- Điểm trả.
- Đánh giá.

Có thể sắp xếp:

- Giá thấp → cao.
- Giá cao → thấp.
- Khởi hành sớm nhất.
- Khởi hành muộn nhất.
- Đánh giá cao nhất.

---

# FR-04. XEM CHI TIẾT CHUYẾN XE

Hệ thống hiển thị:

### Thông tin chuyến

- Mã chuyến.
- Nhà xe.
- Tuyến.
- Ngày.
- Giờ đi.
- Giờ đến dự kiến.
- Thời gian di chuyển.

### Thông tin xe

- Biển số.
- Loại xe.
- Số chỗ.
- Tiện nghi.

### Điểm đón

- Tên điểm.
- Địa chỉ.
- Thời gian đón dự kiến.

### Điểm trả

- Tên điểm.
- Địa chỉ.
- Thời gian trả dự kiến.

### Chính sách

- Chính sách hủy.
- Chính sách đổi vé.
- Quy định hành lý.

---

# FR-05. XEM SƠ ĐỒ GHẾ

Hệ thống hiển thị sơ đồ ghế của xe.

Mỗi ghế có trạng thái:

- Available – Còn trống.
- Selected – Đang được chọn.
- Reserved – Đang giữ chỗ.
- Booked – Đã đặt.
- Disabled – Không sử dụng.

Customer chỉ được chọn ghế Available.

---

# FR-06. CHỌN GHẾ

Customer chọn một hoặc nhiều ghế.

Hệ thống phải:

1. Kiểm tra ghế còn trống.
2. Tạm giữ ghế trong một khoảng thời gian.
3. Cập nhật trạng thái ghế.
4. Tính tổng tiền.

Ví dụ:

Vé: 150.000 VNĐ  
Số lượng: 2

**Tổng tiền = 300.000 VNĐ**

Nếu thời gian giữ ghế hết hạn mà chưa thanh toán:

→ Ghế được trả lại trạng thái Available.

---

# FR-07. NHẬP THÔNG TIN HÀNH KHÁCH

Customer nhập:

- Họ tên.
- Số điện thoại.
- Email.
- CCCD/CMND nếu cần.
- Thông tin bổ sung.

Mỗi hành khách được liên kết với một ghế.

---

# FR-08. ĐẶT VÉ

Quy trình:

1. Customer tìm chuyến.
2. Chọn chuyến.
3. Chọn ghế.
4. Nhập thông tin hành khách.
5. Kiểm tra thông tin.
6. Xác nhận đặt vé.
7. Chuyển sang thanh toán.

Hệ thống tạo Booking với trạng thái:

**Pending Payment**

---

# FR-09. THANH TOÁN

Hệ thống hỗ trợ thanh toán thông qua cổng thanh toán.

Các trạng thái:

- Pending.
- Processing.
- Paid.
- Failed.
- Cancelled.
- Refunded.

Sau khi thanh toán thành công:

- Booking chuyển thành Paid.
- Ghế chuyển thành Booked.
- Sinh mã vé.
- Gửi xác nhận cho Customer.

---

# FR-10. VÉ ĐIỆN TỬ

Sau khi thanh toán thành công, hệ thống tạo vé điện tử.

Vé bao gồm:

- Mã vé.
- Mã booking.
- Tên khách.
- Nhà xe.
- Tuyến.
- Ngày đi.
- Giờ đi.
- Điểm đón.
- Điểm trả.
- Số ghế.
- Giá vé.
- Trạng thái.
- QR Code.

QR Code được sử dụng để kiểm tra vé khi lên xe.

---

# FR-11. QUẢN LÝ VÉ

Customer có thể xem:

- Vé sắp đi.
- Vé đã sử dụng.
- Vé đã hủy.

Customer có thể mở chi tiết vé.

---

# FR-12. HỦY VÉ

Customer có thể yêu cầu hủy vé nếu thỏa mãn chính sách của nhà xe.

Hệ thống kiểm tra:

- Thời gian còn lại trước giờ khởi hành.
- Trạng thái vé.
- Chính sách hủy.

Nếu hợp lệ:

- Hủy vé.
- Giải phóng ghế.
- Tính số tiền hoàn.
- Tạo yêu cầu hoàn tiền.

---

# FR-13. ĐỔI VÉ

Customer có thể yêu cầu đổi:

- Chuyến.
- Ngày.
- Ghế.

Hệ thống kiểm tra:

- Vé còn hiệu lực.
- Chuyến mới còn ghế.
- Chính sách đổi vé.
- Chênh lệch giá.

---

# FR-14. LỊCH SỬ ĐẶT VÉ

Customer có thể xem lịch sử:

- Mã booking.
- Ngày đặt.
- Chuyến.
- Số ghế.
- Tổng tiền.
- Trạng thái.

Có thể lọc theo:

- Ngày.
- Trạng thái.
- Nhà xe.

---

# FR-15. ĐÁNH GIÁ CHUYẾN ĐI

Sau khi hoàn thành chuyến, Customer có thể đánh giá.

Thông tin:

- Số sao: 1–5.
- Nội dung đánh giá.
- Tiện nghi.
- Thái độ phục vụ.
- Chất lượng chuyến đi.

Customer chỉ được đánh giá chuyến mà mình đã sử dụng.

---

# FR-16. QUẢN LÝ NHÀ XE

Bus Operator có thể:

- Tạo thông tin nhà xe.
- Cập nhật thông tin.
- Thêm logo.
- Thêm mô tả.
- Cập nhật địa chỉ.
- Cập nhật thông tin liên hệ.

---

# FR-17. QUẢN LÝ XE

Bus Operator có thể:

- Thêm xe.
- Sửa xe.
- Xóa xe.
- Khóa xe.
- Thiết lập loại xe.
- Thiết lập số lượng ghế.
- Thiết lập sơ đồ ghế.

Thông tin xe:

- Mã xe.
- Biển số.
- Loại xe.
- Số ghế.
- Năm sản xuất.
- Tiện nghi.
- Trạng thái.

---

# FR-18. QUẢN LÝ TÀI XẾ

Bus Operator có thể:

- Thêm tài xế.
- Sửa thông tin.
- Xóa tài xế.
- Phân công tài xế.

Thông tin:

- Họ tên.
- Số điện thoại.
- CCCD.
- Giấy phép lái xe.
- Ngày hết hạn.
- Trạng thái.

---

# FR-19. QUẢN LÝ TUYẾN

Bus Operator/Admin có thể tạo tuyến:

**Điểm A → Điểm B**

Thông tin:

- Mã tuyến.
- Điểm đi.
- Điểm đến.
- Khoảng cách.
- Thời gian dự kiến.
- Trạng thái.

---

# FR-20. QUẢN LÝ ĐIỂM ĐÓN/TRẢ

Mỗi tuyến có thể có nhiều:

- Điểm đón.
- Điểm trả.

Thông tin:

- Tên.
- Địa chỉ.
- Vị trí GPS.
- Thời gian dự kiến.
- Thứ tự.

---

# FR-21. QUẢN LÝ CHUYẾN XE

Bus Operator có thể:

- Tạo chuyến.
- Sửa chuyến.
- Hủy chuyến.
- Xem danh sách hành khách.
- Phân công xe.
- Phân công tài xế.
- Thiết lập giá vé.

Thông tin chuyến:

- Mã chuyến.
- Tuyến.
- Xe.
- Tài xế.
- Ngày.
- Giờ đi.
- Giờ đến.
- Giá vé.
- Trạng thái.

---

# FR-22. TRẠNG THÁI CHUYẾN XE

Các trạng thái:

1. Scheduled
2. Boarding
3. Departed
4. In Transit
5. Arrived
6. Completed
7. Cancelled

---

# FR-23. QUẢN LÝ HÀNH KHÁCH

Nhà xe có thể xem:

- Tên hành khách.
- Số điện thoại.
- Ghế.
- Mã vé.
- Trạng thái vé.

Tài xế có thể xác nhận hành khách đã lên xe.

---

# FR-24. QUẢN LÝ KHUYẾN MÃI

Admin/Bus Operator có thể:

- Tạo mã giảm giá.
- Cập nhật.
- Khóa mã.
- Xóa mã.

Thông tin:

- Mã.
- Loại giảm.
- Giá trị giảm.
- Đơn tối thiểu.
- Số lần sử dụng.
- Ngày bắt đầu.
- Ngày kết thúc.

---

# FR-25. THÔNG BÁO

Hệ thống gửi thông báo khi:

- Đặt vé thành công.
- Thanh toán thành công.
- Thanh toán thất bại.
- Vé sắp khởi hành.
- Chuyến bị thay đổi.
- Chuyến bị hủy.
- Hủy vé thành công.
- Hoàn tiền thành công.

---

# FR-26. QUẢN LÝ ĐÁNH GIÁ

Admin có thể:

- Xem đánh giá.
- Ẩn đánh giá vi phạm.
- Xóa đánh giá vi phạm.
- Xử lý báo cáo đánh giá.

---

# FR-27. QUẢN LÝ NGƯỜI DÙNG

Admin có thể:

- Xem danh sách người dùng.
- Tìm kiếm.
- Xem chi tiết.
- Khóa tài khoản.
- Mở khóa tài khoản.
- Phân quyền.

Các role:

- CUSTOMER
- DRIVER
- OPERATOR
- ADMIN

---

# FR-28. BÁO CÁO VÀ THỐNG KÊ

Admin/Operator có thể xem:

### Doanh thu

- Doanh thu ngày.
- Doanh thu tháng.
- Doanh thu năm.
- Doanh thu theo chuyến.
- Doanh thu theo tuyến.
- Doanh thu theo nhà xe.

### Đặt vé

- Tổng số booking.
- Booking thành công.
- Booking thất bại.
- Booking bị hủy.

### Ghế

- Tỷ lệ lấp đầy.
- Số ghế đã bán.
- Số ghế còn trống.

---

# 5. YÊU CẦU PHI CHỨC NĂNG

## NFR-01. Hiệu năng

- Trang web thông thường nên phản hồi trong vòng 3 giây trong điều kiện bình thường.
- API nên phản hồi nhanh và ổn định.
- Hệ thống phải hỗ trợ nhiều người dùng đồng thời.
- Tìm kiếm chuyến xe phải có khả năng xử lý dữ liệu lớn.

---

## NFR-02. Bảo mật

Hệ thống phải:

- Hash mật khẩu.
- Không lưu mật khẩu dạng plain text.
- Sử dụng HTTPS.
- Xác thực người dùng.
- Phân quyền theo role.
- Kiểm tra quyền truy cập API.
- Bảo vệ dữ liệu cá nhân.
- Chống SQL Injection.
- Chống XSS.
- Chống CSRF nếu sử dụng cookie authentication.
- Không lưu thông tin thẻ ngân hàng trực tiếp trên hệ thống.

---

## NFR-03. Tính chính xác

Hệ thống phải đảm bảo:

- Không thể bán cùng một ghế cho hai booking đã thanh toán.
- Tổng tiền phải được tính chính xác.
- Trạng thái thanh toán phải đồng bộ.
- Trạng thái ghế phải phản ánh đúng booking.

---

## NFR-04. Tính sẵn sàng

Hệ thống phải hoạt động ổn định và hạn chế downtime.

Nếu một dịch vụ bên ngoài không hoạt động, hệ thống phải:

- Hiển thị lỗi phù hợp.
- Không tạo booking sai trạng thái.
- Không trừ tiền nhiều lần.

---

## NFR-05. Khả năng mở rộng

Hệ thống có khả năng mở rộng:

- Nhiều nhà xe.
- Nhiều tuyến.
- Nhiều chuyến.
- Nhiều người dùng.
- Nhiều cổng thanh toán.
- Nhiều phương thức thông báo.

---

## NFR-06. Khả năng sử dụng

Giao diện phải:

- Dễ sử dụng.
- Responsive.
- Hoạt động trên PC, tablet và mobile.
- Quy trình đặt vé đơn giản.
- Hiển thị lỗi rõ ràng.

---

# 6. BUSINESS RULES

## BR-01

Một ghế chỉ có thể thuộc về một booking đã thanh toán tại cùng một thời điểm.

## BR-02

Ghế được giữ tạm thời trong thời gian thanh toán.

## BR-03

Booking chưa thanh toán sau khi hết thời gian giữ ghế sẽ bị hủy tự động.

## BR-04

Customer không thể đặt chuyến đã khởi hành.

## BR-05

Customer chỉ được đánh giá chuyến mà mình đã hoàn thành.

## BR-06

Customer chỉ được hủy vé nếu thỏa mãn chính sách hủy.

## BR-07

Admin có quyền quản lý toàn bộ dữ liệu.

## BR-08

Operator chỉ được quản lý dữ liệu thuộc nhà xe của mình.

## BR-09

Driver chỉ được xem các chuyến được phân công.

## BR-10

Thanh toán thành công phải được xác nhận từ Payment Gateway trước khi booking chuyển sang Paid.

---

# 7. USE CASE

## UC-01 Đăng ký

**Actor:** Guest

**Pre-condition:** Người dùng chưa có tài khoản.

**Main Flow:**

1. Guest chọn Đăng ký.
2. Hệ thống hiển thị form.
3. Guest nhập thông tin.
4. Hệ thống kiểm tra dữ liệu.
5. Hệ thống kiểm tra tài khoản tồn tại.
6. Hệ thống tạo tài khoản.
7. Hệ thống thông báo thành công.

**Alternative Flow:**

- Email đã tồn tại → thông báo lỗi.
- Mật khẩu không hợp lệ → yêu cầu nhập lại.
- Dữ liệu thiếu → thông báo trường bắt buộc.

---

# UC-02 Đăng nhập

**Actor:** Guest/Customer/Driver/Operator/Admin

**Main Flow:**

1. Actor nhập username/password.
2. Hệ thống xác thực.
3. Hệ thống kiểm tra trạng thái tài khoản.
4. Hệ thống tạo authentication token/session.
5. Hệ thống chuyển đến trang tương ứng.

---

# UC-03 Tìm kiếm chuyến xe

**Actor:** Guest/Customer

**Main Flow:**

1. Người dùng nhập điểm đi.
2. Nhập điểm đến.
3. Chọn ngày.
4. Nhập số hành khách.
5. Chọn Tìm kiếm.
6. Hệ thống tìm các chuyến phù hợp.
7. Hệ thống hiển thị kết quả.

---

# UC-04 Đặt vé

**Actor:** Customer

**Pre-condition:**

- Customer đã đăng nhập.
- Chuyến còn ghế.

**Main Flow:**

1. Customer chọn chuyến.
2. Hệ thống hiển thị sơ đồ ghế.
3. Customer chọn ghế.
4. Hệ thống kiểm tra ghế.
5. Hệ thống giữ ghế tạm thời.
6. Customer nhập thông tin hành khách.
7. Hệ thống hiển thị tổng tiền.
8. Customer xác nhận.
9. Hệ thống tạo Booking Pending.
10. Hệ thống chuyển sang thanh toán.

**Alternative Flow:**

- Ghế vừa bị người khác đặt → thông báo ghế không còn.
- Hết thời gian giữ ghế → booking hết hiệu lực.

---

# UC-05 Thanh toán

**Actor:** Customer  
**Secondary Actor:** Payment Gateway

**Main Flow:**

1. Customer chọn phương thức thanh toán.
2. Hệ thống tạo payment request.
3. Chuyển Customer đến Payment Gateway.
4. Customer thực hiện thanh toán.
5. Payment Gateway trả kết quả.
6. Hệ thống xác nhận giao dịch.
7. Booking chuyển thành Paid.
8. Ghế chuyển thành Booked.
9. Hệ thống tạo vé.
10. Gửi thông báo cho Customer.

---

# UC-06 Hủy vé

**Actor:** Customer

**Main Flow:**

1. Customer mở vé.
2. Chọn Hủy vé.
3. Hệ thống kiểm tra điều kiện.
4. Hiển thị số tiền được hoàn.
5. Customer xác nhận.
6. Hệ thống hủy vé.
7. Giải phóng ghế.
8. Tạo yêu cầu hoàn tiền.

---

# UC-07 Tạo chuyến xe

**Actor:** Operator

**Main Flow:**

1. Operator mở quản lý chuyến.
2. Chọn Tạo chuyến.
3. Chọn tuyến.
4. Chọn xe.
5. Chọn tài xế.
6. Chọn ngày giờ.
7. Nhập giá.
8. Hệ thống kiểm tra xung đột.
9. Lưu chuyến.

---

# UC-08 Quản lý xe

**Actor:** Operator

Operator có thể:

- Thêm xe.
- Sửa xe.
- Xóa xe.
- Xem xe.
- Thiết lập sơ đồ ghế.

---

# UC-09 Quản lý người dùng

**Actor:** Admin

Admin có thể:

- Xem.
- Tìm kiếm.
- Khóa.
- Mở khóa.
- Phân quyền.

---

# UC-10 Xem báo cáo

**Actor:** Admin/Operator

Hệ thống cung cấp:

- Doanh thu.
- Booking.
- Vé.
- Tỷ lệ lấp đầy.
- Hiệu suất chuyến.

---

# 8. DỮ LIỆU ĐẦU VÀO

## Customer

- Full Name.
- Email.
- Phone.
- Password.
- Date of Birth.
- Gender.

## Bus

- Bus ID.
- License Plate.
- Bus Type.
- Seat Count.
- Facilities.

## Route

- Route ID.
- Origin.
- Destination.
- Distance.
- Estimated Duration.

## Trip

- Trip ID.
- Route.
- Bus.
- Driver.
- Departure Time.
- Arrival Time.
- Price.

## Booking

- Booking ID.
- Customer.
- Trip.
- Booking Date.
- Total Amount.
- Status.

## Ticket

- Ticket ID.
- Booking.
- Passenger.
- Seat.
- QR Code.
- Status.

## Payment

- Payment ID.
- Booking.
- Amount.
- Method.
- Transaction ID.
- Status.
- Payment Time.

---

# 9. TRẠNG THÁI DỮ LIỆU

## Booking Status

```text
PENDING_PAYMENT
PAID
CANCELLED
EXPIRED
REFUNDED
COMPLETED
```

## Seat Status

```text
AVAILABLE
HELD
BOOKED
DISABLED
```

## Payment Status

```text
PENDING
PROCESSING
SUCCESS
FAILED
REFUNDED
```

## Trip Status

```text
SCHEDULED
BOARDING
DEPARTED
IN_TRANSIT
ARRIVED
COMPLETED
CANCELLED
```

---

# 10. YÊU CẦU CƠ SỞ DỮ LIỆU

Hệ thống dự kiến có các bảng chính:

```text
User
Role
Customer
Operator
Driver
Bus
Seat
Route
PickupPoint
DropoffPoint
Trip
Booking
Passenger
Ticket
Payment
Promotion
Review
Notification
Refund
```

Quan hệ chính:

```text
User 1 ─── 1 Customer
User 1 ─── 1 Driver
User 1 ─── 1 Operator

Operator 1 ─── N Bus
Operator 1 ─── N Trip

Bus 1 ─── N Seat

Route 1 ─── N Trip

Trip 1 ─── N Booking

Customer 1 ─── N Booking

Booking 1 ─── N Ticket

Ticket N ─── 1 Seat

Booking 1 ─── N Payment

Customer 1 ─── N Review
Trip 1 ─── N Review
```

---

# 11. YÊU CẦU GIAO DIỆN

## Trang chủ

Bao gồm:

- Logo.
- Thanh tìm kiếm.
- Điểm đi.
- Điểm đến.
- Ngày đi.
- Số hành khách.
- Nút tìm kiếm.
- Chuyến phổ biến.
- Nhà xe nổi bật.

## Trang tìm kiếm

Hiển thị:

- Bộ lọc.
- Danh sách chuyến.
- Giá.
- Giờ đi.
- Giờ đến.
- Số ghế.
- Nhà xe.

## Trang chi tiết chuyến

Hiển thị:

- Thông tin chuyến.
- Thông tin xe.
- Điểm đón/trả.
- Sơ đồ ghế.
- Giá.
- Chính sách.
- Nút đặt vé.

## Trang thanh toán

Hiển thị:

- Thông tin chuyến.
- Thông tin hành khách.
- Ghế.
- Tổng tiền.
- Voucher.
- Phương thức thanh toán.
- Nút thanh toán.

## Trang vé

Hiển thị:

- Mã vé.
- QR Code.
- Tuyến.
- Ghế.
- Giờ đi.
- Điểm đón/trả.
- Trạng thái.

---

# 12. PHÂN QUYỀN

| Chức năng | Guest | Customer | Driver | Operator | Admin |
|---|---:|---:|---:|---:|---:|
| Xem chuyến | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tìm kiếm | ✓ | ✓ | ✓ | ✓ | ✓ |
| Đặt vé | | ✓ | | | |
| Thanh toán | | ✓ | | | |
| Hủy vé | | ✓ | | | |
| Đánh giá | | ✓ | | | |
| Xem chuyến được phân công | | | ✓ | | |
| Quản lý xe | | | | ✓ | ✓ |
| Quản lý tài xế | | | | ✓ | ✓ |
| Quản lý chuyến | | | | ✓ | ✓ |
| Quản lý người dùng | | | | | ✓ |
| Báo cáo | | | | ✓ | ✓ |
| Quản lý hệ thống | | | | | ✓ |

---

# 13. YÊU CẦU API DỰ KIẾN

## Authentication

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/forgot-password
POST /api/auth/reset-password
```

## Users

```text
GET    /api/users/me
PUT    /api/users/me
```

## Routes

```text
GET    /api/routes
GET    /api/routes/{id}
POST   /api/routes
PUT    /api/routes/{id}
DELETE /api/routes/{id}
```

## Trips

```text
GET    /api/trips
GET    /api/trips/{id}
POST   /api/trips
PUT    /api/trips/{id}
DELETE /api/trips/{id}
```

## Seats

```text
GET /api/trips/{tripId}/seats
POST /api/trips/{tripId}/seats/hold
DELETE /api/trips/{tripId}/seats/hold
```

## Bookings

```text
POST   /api/bookings
GET    /api/bookings
GET    /api/bookings/{id}
POST   /api/bookings/{id}/cancel
```

## Payments

```text
POST /api/payments
GET  /api/payments/{id}
POST /api/payments/callback
```

## Reviews

```text
POST   /api/reviews
GET    /api/trips/{tripId}/reviews
DELETE /api/reviews/{id}
```

---

# 14. YÊU CẦU XỬ LÝ ĐẶT GHẾ

Đây là nghiệp vụ quan trọng nhất của hệ thống.

Khi Customer chọn ghế:

```text
AVAILABLE
     ↓
    HELD
     ↓
Payment Success
     ↓
   BOOKED
```

Nếu thanh toán thất bại hoặc hết thời gian:

```text
HELD
 ↓
AVAILABLE
```

Hệ thống phải đảm bảo hai Customer không thể cùng lúc thanh toán thành công cho cùng một ghế.

---

# 15. QUY TRÌNH ĐẶT VÉ TỔNG QUÁT

```text
Customer
   ↓
Tìm kiếm chuyến
   ↓
Chọn chuyến
   ↓
Xem sơ đồ ghế
   ↓
Chọn ghế
   ↓
Nhập thông tin hành khách
   ↓
Xác nhận
   ↓
Tạo Booking
   ↓
Giữ ghế
   ↓
Thanh toán
   ↓
Payment Gateway
   ↓
Thanh toán thành công
   ↓
Booking = PAID
   ↓
Seat = BOOKED
   ↓
Generate Ticket
   ↓
Generate QR Code
   ↓
Send Notification
```

---

# 16. XỬ LÝ NGOẠI LỆ

Hệ thống phải xử lý:

### E01 – Ghế đã được đặt

Hiển thị:

> Ghế này vừa được khách hàng khác đặt. Vui lòng chọn ghế khác.

### E02 – Thanh toán thất bại

Booking không được chuyển sang Paid.

### E03 – Hết thời gian giữ ghế

Ghế được giải phóng.

### E04 – Chuyến đã khởi hành

Không cho phép đặt vé.

### E05 – Chuyến bị hủy

Thông báo Customer và xử lý hoàn tiền theo chính sách.

### E06 – Tài khoản bị khóa

Không cho phép đăng nhập hoặc thực hiện giao dịch.

### E07 – Payment Gateway không phản hồi

Booking giữ trạng thái Pending và không được xác nhận là đã thanh toán.

---

# 17. YÊU CẦU LOGGING

Hệ thống phải ghi log các sự kiện quan trọng:

- Login.
- Logout.
- Đăng ký.
- Tạo booking.
- Thanh toán.
- Hủy booking.
- Hoàn tiền.
- Thay đổi chuyến.
- Thay đổi quyền.
- Khóa tài khoản.

Log nên bao gồm:

- User ID.
- Action.
- Timestamp.
- IP nếu cần.
- Status.
- Error message.

---

# 18. YÊU CẦU BẢO VỆ DỮ LIỆU

Các dữ liệu nhạy cảm phải được bảo vệ.

Đặc biệt:

- Password.
- Số điện thoại.
- Email.
- CCCD.
- Thông tin giao dịch.

Hệ thống không được lưu thông tin thẻ thanh toán nhạy cảm nếu Payment Gateway đã cung cấp cơ chế xử lý bên ngoài.

---

# 19. ACCEPTANCE CRITERIA

Hệ thống được xem là đáp ứng yêu cầu khi:

1. Người dùng có thể đăng ký và đăng nhập.
2. Người dùng có thể tìm kiếm chuyến.
3. Người dùng có thể xem chi tiết chuyến.
4. Người dùng có thể chọn ghế.
5. Hệ thống không cho phép bán trùng ghế.
6. Người dùng có thể tạo booking.
7. Người dùng có thể thanh toán.
8. Hệ thống tạo vé sau khi thanh toán thành công.
9. Vé có QR Code.
10. Người dùng có thể xem lịch sử vé.
11. Người dùng có thể hủy vé nếu đủ điều kiện.
12. Nhà xe có thể quản lý xe.
13. Nhà xe có thể quản lý chuyến.
14. Tài xế có thể xem chuyến được phân công.
15. Admin có thể quản lý người dùng.
16. Admin có thể xem báo cáo.
17. Hệ thống phân quyền đúng theo role.
18. Dữ liệu được lưu trữ chính xác và nhất quán.

---

# 20. CÁC DIAGRAM CẦN PHÁT TRIỂN TỪ SRS

Từ SRS này có thể xây dựng tiếp:

### 20.1. Use Case Diagram

Các nhóm chính:

```text
Guest
Customer
Driver
Operator
Admin
Payment Gateway
Notification Service
```

### 20.2. Robustness Diagram

Có thể lấy các Use Case quan trọng:

```text
Đăng nhập
Tìm kiếm chuyến
Đặt vé
Thanh toán
Hủy vé
Quản lý chuyến
Quản lý xe
Quản lý người dùng
```

### 20.3. Sequence Diagram

Nên ưu tiên:

```text
Sequence - Đăng nhập
Sequence - Tìm kiếm chuyến
Sequence - Đặt vé
Sequence - Thanh toán
Sequence - Hủy vé
Sequence - Tạo chuyến
```

### 20.4. Class Diagram

Các class chính:

```text
User
Role
Customer
Driver
Operator
Admin
Bus
Seat
Route
PickupPoint
DropoffPoint
Trip
Booking
Passenger
Ticket
Payment
Promotion
Review
Notification
Refund
```

### 20.5. ERD

Từ các entity trên có thể xây dựng database relationship.

---

# 21. TÓM TẮT KIẾN TRÚC NGHIỆP VỤ

Hệ thống có 3 luồng nghiệp vụ chính:

## Luồng 1 – Customer

```text
Search
  ↓
Select Trip
  ↓
Select Seat
  ↓
Passenger Information
  ↓
Booking
  ↓
Payment
  ↓
Ticket
```

## Luồng 2 – Operator

```text
Manage Bus
    ↓
Manage Driver
    ↓
Manage Route
    ↓
Create Trip
    ↓
Manage Booking
    ↓
View Revenue
```

## Luồng 3 – Admin

```text
Manage Users
     ↓
Manage Operators
     ↓
Manage System
     ↓
Manage Transactions
     ↓
Reports
```

---

# 22. KẾT LUẬN

Hệ thống đặt vé xe khách trực tuyến cung cấp một nền tảng tập trung cho khách hàng tìm kiếm, lựa chọn, đặt và thanh toán vé xe. Đồng thời hệ thống hỗ trợ nhà xe quản lý phương tiện, tài xế, tuyến đường, chuyến xe, hành khách và doanh thu.

SRS là cơ sở để triển khai các bước phân tích và thiết kế tiếp theo, bao gồm Use Case Diagram, Robustness Diagram, Sequence Diagram, Class Diagram, ERD, thiết kế API và triển khai hệ thống.