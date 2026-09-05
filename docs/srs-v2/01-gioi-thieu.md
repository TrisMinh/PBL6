# 1. Giới thiệu

[← Mục lục](./README.md) · [Chương 2 →](./02-tong-quan-san-pham.md)

## 1.1. Mục đích

Tài liệu này đặc tả yêu cầu cho nền tảng đặt vé xe khách trực tuyến dùng chung backend cho Web End-user, Mobile App và Back-office Web. Tài liệu là căn cứ để:

- xác nhận phạm vi sản phẩm với các bên liên quan;
- thiết kế giao diện và quy trình nghiệp vụ;
- phát triển các thành phần hệ thống;
- xây dựng test case và nghiệm thu;
- kiểm soát thay đổi yêu cầu;
- truy vết sự cố booking, payment, ticket và refund.

## 1.2. Phạm vi tài liệu

SRS bao phủ:

- mục tiêu, phạm vi và actor của sản phẩm;
- quy trình và quy tắc nghiệp vụ;
- Use Case và các nhánh ngoại lệ;
- yêu cầu chức năng, trạng thái, dữ liệu và giao diện;
- yêu cầu chất lượng, bảo mật và vận hành;
- tiêu chí chấp nhận và ma trận truy vết.

SRS không đặc tả chi tiết cấu trúc database vật lý, giao thức nội bộ ở mức triển khai, cấu hình hạ tầng hoặc mã nguồn. Những quyết định này phải thỏa mãn SRS nhưng được quản lý trong tài liệu thiết kế tương ứng.

## 1.3. Đối tượng đọc

| Đối tượng | Nội dung cần quan tâm |
|---|---|
| Khách hàng/người phê duyệt | Mục tiêu, phạm vi, quy trình và tiêu chí chấp nhận |
| Business Analyst/Product Owner | Toàn bộ SRS và ma trận truy vết |
| Nhóm Web/Mobile | Actor, Use Case, UI, FR và mã lỗi |
| Nhóm Backend | Business Rule, FR, state, data, integration và NFR |
| Nhóm kiểm thử | Use Case, FR/NFR, AC và truy vết |
| Nhóm vận hành | Bảo mật, audit, logging, phục hồi và đối soát |

## 1.4. Thuật ngữ

| Thuật ngữ | Định nghĩa |
|---|---|
| Guest | Người dùng chưa đăng nhập. |
| Customer | Người dùng đã xác thực, thực hiện đặt và quản lý vé của mình. |
| Operator Organization | Pháp nhân/nhà xe sở hữu dữ liệu vận hành. |
| Operator Staff | User thuộc một Operator Organization. |
| Driver | User tài xế thuộc nhà xe và được phân công Trip. |
| Admin | User quản trị nền tảng. |
| Seat | Ghế vật lý trong sơ đồ xe. |
| TripSeat | Bản ghi ghế của một Trip cụ thể. |
| SeatHold | Quyền giữ tạm một hoặc nhiều TripSeat có thời hạn. |
| Booking | Đơn đặt chỗ chứa một hoặc nhiều Booking Item. |
| Passenger | Hành khách gắn với một Booking Item. |
| Ticket | Quyền đi xe của một Passenger tại một TripSeat. |
| Payment | Giao dịch thanh toán cho Booking. |
| Refund | Yêu cầu hoàn tiền toàn phần hoặc một phần. |
| Tenant | Phạm vi dữ liệu thuộc một Operator Organization. |
| Snapshot | Bản sao dữ liệu được chốt tại một thời điểm để bảo toàn lịch sử. |
| Idempotency | Thuộc tính bảo đảm gửi lặp cùng yêu cầu không tạo thêm tác động nghiệp vụ. |
| Compensation | Thao tác bù trừ khi quy trình nhiều bước chỉ hoàn thành một phần. |
| Reconciliation | Đối soát dữ liệu nội bộ với dữ liệu nhà cung cấp để xác định trạng thái cuối. |

## 1.5. Quy ước yêu cầu

- `MUST`: bắt buộc để nghiệm thu phạm vi cốt lõi.
- `SHOULD`: cần có nhưng có thể lùi bằng quyết định phạm vi được ghi nhận.
- `COULD`: hướng mở rộng, không phải điều kiện nghiệm thu cốt lõi.
- “Hệ thống phải” biểu thị yêu cầu bắt buộc có thể kiểm chứng.
- “Hệ thống nên” biểu thị yêu cầu mong muốn nhưng không phải điều kiện baseline.
- Trạng thái nghiệp vụ và mã lỗi được viết bằng chữ in hoa để phân biệt với nội dung mô tả.

## 1.6. Tài liệu tham chiếu

- Chính sách vận hành của từng Operator Organization.
- Chính sách hủy, đổi vé và hoàn tiền được phê duyệt.
- Hợp đồng API/webhook của Payment Gateway được lựa chọn.
- Hợp đồng của Notification Provider.
- Tài liệu thiết kế kiến trúc, API, database và triển khai.
- Test Plan và Test Case được sinh từ yêu cầu có mã.

## 1.7. Nguyên tắc quản lý thay đổi

- Thay đổi hành vi phải cập nhật FR và BR liên quan.
- Thay đổi luồng phải cập nhật Use Case và Activity/Sequence Diagram liên quan.
- Thay đổi vòng đời phải cập nhật bảng chuyển trạng thái và State Diagram.
- Thay đổi chỉ hoàn tất khi Acceptance Criteria và ma trận truy vết đã được cập nhật.
- Không tái sử dụng mã đã loại bỏ cho một yêu cầu khác.

[← Mục lục](./README.md) · [Chương 2 →](./02-tong-quan-san-pham.md)

