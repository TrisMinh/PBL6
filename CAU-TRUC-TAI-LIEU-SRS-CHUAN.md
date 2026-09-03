# CẤU TRÚC TÀI LIỆU ĐẶC TẢ YÊU CẦU PHẦN MỀM (SRS)

## Thông tin tài liệu

- Tên dự án
- Tên hệ thống
- Mã tài liệu
- Phiên bản
- Người thực hiện
- Người phê duyệt
- Ngày cập nhật
- Lịch sử thay đổi đổi phiên bản
- Mục lục

## 1. Giới thiệu

### 1.1. Mục đích tài liệu

Nêu lý do lập SRS và mục đích sử dụng tài liệu.

### 1.2. Phạm vi tài liệu

Xác định các nội dung và yêu cầu được đặc tả trong tài liệu.

### 1.3. Đối tượng đọc tài liệu

- Khách hàng
- Nhóm phân tích nghiệp vụ
- Nhóm phát triển
- Nhóm kiểm thử
- Nhóm vận hành
- Các bên liên quan khác

### 1.4. Thuật ngữ và từ viết tắt

Liệt kê các thuật ngữ nghiệp vụ, thuật ngữ kỹ thuật và từ viết tắt được sử dụng.

### 1.5. Tài liệu tham chiếu

Liệt kê tài liệu nghiệp vụ, tiêu chuẩn, hợp đồng API, quy định và tài liệu liên quan.

## 2. Tổng quan sản phẩm

### 2.1. Bối cảnh và vấn đề cần giải quyết

Mô tả hiện trạng, vấn đề của người dùng và lý do cần xây dựng sản phẩm.

### 2.2. Mục tiêu sản phẩm

- GOAL-001 — Cung cấp đầy đủ các chức năng nghiệp vụ cốt lõi.
- GOAL-002 — Bảo đảm tính chính xác và nhất quán trong quá trình xử lý nghiệp vụ.
- GOAL-003 — Bảo đảm tính toàn vẹn, bảo mật và riêng tư của dữ liệu.
- GOAL-004 — Cung cấp trải nghiệm và quy tắc nghiệp vụ nhất quán trên Web End-user, Mobile End-user và Web Operator.
- GOAL-005 — Bảo đảm hệ thống tích hợp và vận hành ổn định khi dịch vụ bên ngoài gặp lỗi.
- GOAL-006 — Cung cấp đầy đủ chức năng quản trị, giám sát, audit, báo cáo và đối soát.
- GOAL-007 — Bảo đảm khả năng mở rộng, bảo trì và phát triển sản phẩm lâu dài.

### 2.3. Phạm vi sản phẩm

#### 2.3.1. Trong phạm vi

Liệt kê các phân hệ, chức năng và quy trình thuộc phiên bản hiện tại.

#### 2.3.2. Ngoài phạm vi

Liệt kê các chức năng không được triển khai trong phiên bản hiện tại.

### 2.4. Nhóm người dùng và hệ thống liên quan

- Khách chưa đăng nhập
- Khách hàng
- Nhân viên vận hành
- Quản trị viên tổ chức
- Quản trị viên hệ thống
- Dịch vụ thanh toán
- Dịch vụ thông báo
- Các hệ thống tích hợp khác

### 2.5. Kênh sử dụng

- Web End-user
- Mobile End-user
- Web Operator
- API tích hợp

### 2.6. Môi trường vận hành

- Trình duyệt được hỗ trợ
- Hệ điều hành di động được hỗ trợ
- Môi trường máy chủ
- Cơ sở dữ liệu
- Hạ tầng triển khai

### 2.7. Giả định, phụ thuộc và ràng buộc

- Giả định nghiệp vụ
- Phụ thuộc vào dịch vụ bên ngoài
- Ràng buộc kỹ thuật
- Ràng buộc pháp lý
- Ràng buộc về thời gian và nguồn lực

## 3. Yêu cầu nghiệp vụ

### 3.1. Quy trình nghiệp vụ tổng thể

Trình bày sơ đồ và mô tả các quy trình nghiệp vụ chính của hệ thống.

### 3.2. Quy tắc nghiệp vụ

Mỗi quy tắc nghiệp vụ gồm:

- Mã quy tắc: BR-xxx
- Tên quy tắc
- Nội dung quy tắc
- Điều kiện áp dụng
- Ngoại lệ
- Yêu cầu chức năng liên quan

### 3.3. Actor và phân quyền

- Danh sách actor
- Vai trò của từng actor
- Chức năng được phép sử dụng
- Phạm vi dữ liệu được phép truy cập
- Ma trận vai trò – quyền hạn

### 3.4. Danh sách use case

Liệt kê mã use case, tên use case, actor chính và mục tiêu của use case.

### 3.5. Đặc tả use case

Mỗi use case gồm:

- Mã và tên use case
- Mục tiêu
- Actor
- Sự kiện kích hoạt
- Tiền điều kiện
- Hậu điều kiện
- Luồng chính
- Luồng thay thế
- Luồng ngoại lệ
- Quy tắc nghiệp vụ liên quan
- Tiêu chí chấp nhận

## 4. Yêu cầu chức năng

### 4.1. Yêu cầu chức năng theo phân hệ

Tổ chức yêu cầu theo các phân hệ chính, ví dụ:

- Tài khoản và xác thực
- Tìm kiếm và tra cứu
- Đặt chỗ/đặt hàng
- Thanh toán
- Hủy và hoàn tiền
- Phát hành vé/chứng từ
- Thông báo
- Quản trị vận hành
- Báo cáo và đối soát
- Quản trị hệ thống

### 4.2. Cấu trúc một yêu cầu chức năng

Mỗi yêu cầu chức năng gồm:

- Mã yêu cầu: FR-xxx
- Tên yêu cầu
- Mô tả
- Actor liên quan
- Tiền điều kiện
- Dữ liệu đầu vào
- Quy trình xử lý
- Kết quả đầu ra
- Hậu điều kiện
- Xử lý lỗi và ngoại lệ
- Quy tắc nghiệp vụ liên quan
- Mức độ ưu tiên
- Tiêu chí chấp nhận

### 4.3. Trạng thái và vòng đời nghiệp vụ

Với mỗi thực thể có trạng thái, cần mô tả:

- Danh sách trạng thái
- Ý nghĩa của từng trạng thái
- Sự kiện chuyển trạng thái
- Điều kiện chuyển trạng thái
- Thao tác được phép tại từng trạng thái
- Cách xử lý khi chuyển trạng thái thất bại

## 5. Yêu cầu dữ liệu và giao diện

### 5.1. Yêu cầu dữ liệu

- Mô hình dữ liệu hoặc sơ đồ ERD
- Danh sách thực thể
- Thuộc tính của từng thực thể
- Kiểu và định dạng dữ liệu
- Trường bắt buộc
- Ràng buộc duy nhất
- Quan hệ giữa các thực thể
- Quy tắc kiểm tra dữ liệu
- Phân loại dữ liệu nhạy cảm
- Thời gian lưu giữ và xóa dữ liệu
- Sao lưu và phục hồi dữ liệu

### 5.2. Giao diện người dùng

- Danh sách màn hình
- Thành phần và dữ liệu hiển thị
- Thao tác người dùng
- Kiểm tra dữ liệu nhập
- Trạng thái tải, rỗng, thành công và lỗi
- Yêu cầu responsive
- Yêu cầu accessibility
- Yêu cầu đa ngôn ngữ

### 5.3. Giao diện API

- Quy ước URL và phiên bản API
- Xác thực và phân quyền
- Định dạng request/response
- Mã trạng thái và mã lỗi
- Phân trang, lọc và sắp xếp
- Timeout và retry
- Idempotency
- Rate limiting
- Danh sách endpoint

### 5.4. Tích hợp hệ thống bên ngoài

Với mỗi hệ thống tích hợp, mô tả:

- Mục đích tích hợp
- Dữ liệu trao đổi
- Giao thức
- Cơ chế xác thực
- Callback/webhook hoặc sự kiện
- Timeout và retry
- Chống xử lý trùng
- Xử lý lỗi
- Cơ chế đối soát

## 6. Yêu cầu phi chức năng

### 6.1. Hiệu năng và tải

- Thời gian phản hồi
- Số người dùng đồng thời
- Thông lượng xử lý
- Khả năng đáp ứng vào giờ cao điểm

### 6.2. Tính sẵn sàng và độ tin cậy

- Tỷ lệ sẵn sàng
- Thời gian ngừng dịch vụ cho phép
- Khả năng chịu lỗi
- Cơ chế phục hồi
- RTO và RPO

### 6.3. Bảo mật và quyền riêng tư

- Xác thực
- Phân quyền
- Mã hóa dữ liệu
- Quản lý phiên đăng nhập
- Bảo vệ dữ liệu cá nhân
- Nhật ký bảo mật
- Phòng chống các lỗ hổng phổ biến

### 6.4. Tính nhất quán và toàn vẹn

- Tính nhất quán giao dịch
- Kiểm soát xử lý đồng thời
- Chống tạo dữ liệu trùng
- Xử lý callback trễ, lặp hoặc sai thứ tự
- Cơ chế bù trừ và đối soát

### 6.5. Khả năng sử dụng và tương thích

- Tính dễ học và dễ sử dụng
- Thông báo lỗi rõ ràng
- Khả năng truy cập
- Trình duyệt, hệ điều hành và thiết bị được hỗ trợ

### 6.6. Khả năng mở rộng và bảo trì

- Khả năng mở rộng tải và dữ liệu
- Tính mô-đun
- Khả năng thay đổi và nâng cấp
- Khả năng kiểm thử
- Yêu cầu tài liệu kỹ thuật

### 6.7. Giám sát và audit

- Logging
- Metrics
- Tracing
- Cảnh báo sự cố
- Audit log
- Báo cáo vận hành
- Thời gian lưu giữ nhật ký

## 7. Kiểm thử chấp nhận và truy vết

### 7.1. Tiêu chí chấp nhận

Mỗi yêu cầu phải có điều kiện kiểm chứng rõ ràng, đo được và xác định được kết quả đạt hoặc không đạt.

### 7.2. Kịch bản kiểm thử chính

- Kiểm thử chức năng
- Kiểm thử quy trình đầu-cuối
- Kiểm thử tích hợp
- Kiểm thử đồng thời
- Kiểm thử hiệu năng
- Kiểm thử bảo mật
- Kiểm thử phục hồi

### 7.3. Ma trận truy vết yêu cầu

Liên kết tối thiểu:

- Mục tiêu → Use case
- Mục tiêu → Yêu cầu chức năng/yêu cầu phi chức năng
- Quy tắc nghiệp vụ → Yêu cầu chức năng
- Yêu cầu → Tiêu chí chấp nhận
- Yêu cầu → Test case

## 8. Phụ lục

- Bảng thuật ngữ
- Danh mục trạng thái
- Danh mục mã lỗi
- Mẫu thông báo
- Sơ đồ bổ sung
- Danh sách vấn đề chưa thống nhất
