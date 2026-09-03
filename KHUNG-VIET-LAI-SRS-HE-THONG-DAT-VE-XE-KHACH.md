# KHUNG VIẾT LẠI SRS — HỆ THỐNG ĐẶT VÉ XE KHÁCH TRỰC TUYẾN

> Đây là khung nội dung dành riêng cho hệ thống hiện tại. Khi viết lại, giữ nguyên hệ thống mã định danh, viết yêu cầu có thể kiểm chứng và chỉ đặt mỗi sơ đồ tại một vị trí. ERD chi tiết, kiến trúc Microservices, OpenAPI, event schema và deployment được tách sang tài liệu thiết kế.

## Thông tin tài liệu

| Thuộc tính | Nội dung |
|---|---|
| Tên tài liệu | Đặc tả yêu cầu phần mềm — Hệ thống đặt vé xe khách trực tuyến |
| Mã tài liệu | PBL6-SRS-001 |
| Phiên bản | `[Điền phiên bản]` |
| Trạng thái | `[Nháp / Chờ duyệt / Baseline]` |
| Người biên soạn | `[Điền thông tin]` |
| Người xem xét | `[Điền thông tin]` |
| Người phê duyệt | `[Điền thông tin]` |
| Ngày cập nhật | `[Điền ngày]` |

### Lịch sử thay đổi

| Phiên bản | Ngày | Người cập nhật | Nội dung thay đổi |
|---|---|---|---|
| `[x.y.z]` | `[dd/mm/yyyy]` | `[Họ tên]` | `[Mô tả]` |

## Mục lục

1. [Giới thiệu](#chuong-1)
2. [Tổng quan sản phẩm](#chuong-2)
3. [Quy trình và quy tắc nghiệp vụ](#chuong-3)
4. [Đặc tả Use Case và sơ đồ](#chuong-4)
5. [Yêu cầu chức năng](#chuong-5)
6. [Yêu cầu trạng thái nghiệp vụ](#chuong-6)
7. [Yêu cầu giao diện và tích hợp](#chuong-7)
8. [Yêu cầu dữ liệu](#chuong-8)
9. [Yêu cầu phi chức năng](#chuong-9)
10. [Nghiệm thu và truy vết](#chuong-10)
11. [Phụ lục](#chuong-11)

<a id="chuong-1"></a>

## 1. Giới thiệu

### 1.1. Mục đích tài liệu

`[Nêu mục đích của SRS, phạm vi sử dụng và kết quả mà tài liệu phải hỗ trợ.]`

### 1.2. Phạm vi tài liệu

`[Nêu các yêu cầu sản phẩm được đặc tả và các tài liệu thiết kế không thuộc SRS.]`

### 1.3. Đối tượng đọc

- Khách hàng và giảng viên/người phê duyệt.
- Business Analyst/Product Owner.
- Nhóm phát triển Web, Mobile và Backend.
- Nhóm kiểm thử.
- Nhóm vận hành.

### 1.4. Thuật ngữ và từ viết tắt

| Thuật ngữ | Định nghĩa |
|---|---|
| Customer | Khách hàng đã xác thực sử dụng hệ thống đặt vé. |
| Operator Organization | Tổ chức/nhà xe sở hữu dữ liệu vận hành. |
| Operator Staff | Nhân viên thuộc một nhà xe. |
| Trip | Một chuyến xe cụ thể theo lịch chạy. |
| TripSeat | Một ghế thuộc một Trip cụ thể. |
| SeatHold | Quyền giữ tạm một hoặc nhiều TripSeat có thời hạn. |
| Booking | Đơn đặt chỗ chứa một hoặc nhiều hành khách/vé. |
| Ticket | Quyền đi xe của một hành khách tại một ghế. |
| Payment | Giao dịch thanh toán cho Booking. |
| Refund | Giao dịch hoàn tiền toàn phần hoặc một phần. |
| Tenant | Phạm vi dữ liệu của một Operator Organization. |
| Idempotency | Gửi lặp cùng yêu cầu không tạo thêm tác động nghiệp vụ. |

### 1.5. Quy ước mã định danh

| Loại | Quy ước | Ví dụ |
|---|---|---|
| Mục tiêu | `GOAL-xxx` | `GOAL-002` |
| Quy trình nghiệp vụ | `BP-xx` | `BP-01` |
| Quy tắc nghiệp vụ | `BR-NHOM-xxx` | `BR-SEAT-004` |
| Use Case | `UC-NHOM-xx` | `UC-BOOK-01` |
| Yêu cầu chức năng | `FR-NHOM-xxx` | `FR-PAY-004` |
| Yêu cầu phi chức năng | `NFR-NHOM-xxx` | `NFR-SEC-006` |
| Tiêu chí chấp nhận | `AC-NHOM-xxx` | `AC-SEAT-001` |
| Sơ đồ | `FIG-LOAI-xx` | `FIG-SEQ-04` |

### 1.6. Mức độ ưu tiên

- `MUST`: bắt buộc trong phạm vi nghiệm thu.
- `SHOULD`: cần có nhưng có thể lùi bằng quyết định phạm vi.
- `COULD`: hướng mở rộng, không phải điều kiện nghiệm thu cốt lõi.

### 1.7. Tài liệu tham chiếu

- Quy định nghiệp vụ của nhà xe.
- Chính sách hủy, đổi vé và hoàn tiền.
- Tài liệu API và webhook của Payment Gateway.
- Tài liệu thiết kế kiến trúc.
- Tài liệu thiết kế cơ sở dữ liệu.
- Test Plan và Test Case.

<a id="chuong-2"></a>

## 2. Tổng quan sản phẩm

### 2.1. Bài toán

`[Mô tả vấn đề của Customer, nhà xe, Driver và Admin mà hệ thống giải quyết.]`

### 2.2. Mục tiêu sản phẩm

| ID | Mục tiêu |
|---|---|
| GOAL-001 | Hoàn thiện và cung cấp đầy đủ các chức năng cốt lõi của hệ thống đặt vé xe khách, bao phủ quản lý tài khoản, tìm chuyến, giữ ghế, booking, thanh toán, phát hành vé, hủy/đổi/hoàn tiền, vận hành chuyến, check-in, quản trị và báo cáo. |
| GOAL-002 | Đảm bảo tính chính xác và nhất quán của ghế, giá, booking, payment, ticket và refund trong toàn bộ vòng đời giao dịch. |
| GOAL-003 | Đảm bảo an toàn, quyền riêng tư và phân quyền dữ liệu để mỗi người dùng chỉ truy cập đúng dữ liệu của mình, còn Operator chỉ quản lý dữ liệu thuộc tổ chức của mình. |
| GOAL-004 | Cung cấp đầy đủ và nhất quán ba kênh sử dụng gồm Web End-user, Mobile App và Back-office Web, phù hợp với phạm vi của Guest, Customer, Admin, Operator Staff và Driver. |
| GOAL-005 | Cung cấp trải nghiệm dễ sử dụng, minh bạch, responsive và có khả năng tiếp cận cho các luồng nghiệp vụ cốt lõi. |
| GOAL-006 | Đảm bảo hệ thống có hiệu năng phù hợp, hoạt động ổn định, có khả năng mở rộng và phục hồi khi tải tăng hoặc dịch vụ ngoài gặp lỗi. |
| GOAL-007 | Cung cấp khả năng audit, truy vết, báo cáo và đối soát đáng tin cậy cho booking, payment, refund và hoạt động vận hành. |

### 2.3. Kênh sử dụng

| Kênh | Người dùng | Phạm vi chính |
|---|---|---|
| Web End-user | Guest, Customer | Tìm chuyến, đặt vé, thanh toán, quản lý vé, đánh giá. |
| Mobile App | Customer | Chức năng Customer tương đương Web End-user với UX mobile. |
| Back-office Web | Admin, Operator Staff, Driver | Quản trị nền tảng, vận hành nhà xe, chuyến và check-in. |

### 2.4. Actor và phạm vi trách nhiệm

| Actor | Trách nhiệm/phạm vi |
|---|---|
| Guest | Tìm kiếm, xem chuyến, đăng ký và đăng nhập. |
| Customer | Giữ ghế, đặt vé, thanh toán, xem vé, hủy/đổi và đánh giá. |
| Operator Staff | Quản lý dữ liệu nhà xe trong tenant được cấp. |
| Driver | Xem chuyến được phân công, manifest tối thiểu và check-in. |
| Admin | Quản lý nền tảng, user, organization, audit và báo cáo. |
| Payment Gateway | Xử lý thanh toán/refund và gửi webhook. |
| Notification Provider | Gửi email, SMS hoặc push notification. |

### 2.5. Phạm vi MVP

#### 2.5.1. MUST

- Đăng ký, xác minh, đăng nhập, refresh, logout và reset mật khẩu.
- Tìm kiếm và xem chi tiết chuyến.
- Xem ghế, giữ ghế và tạo Booking.
- Thanh toán và nhận vé điện tử/QR.
- Xem lịch sử Booking/Ticket.
- Hủy vé và hoàn tiền theo chính sách.
- Operator quản lý organization, xe, sơ đồ ghế, tài xế, tuyến và chuyến.
- Driver xem chuyến, manifest và check-in.
- Admin quản lý user, organization, quyền, audit và báo cáo.
- Email và in-app notification.

#### 2.5.2. SHOULD

- Đổi vé.
- Promotion/voucher.
- Review và kiểm duyệt review.
- Export báo cáo CSV.
- Push notification.
- Đối soát giao dịch chưa có trạng thái cuối.

#### 2.5.3. COULD

- Theo dõi vị trí xe.
- Gợi ý chuyến bằng AI.
- Loyalty point.
- Dynamic pricing.
- SMS notification.

#### 2.5.4. Ngoài phạm vi

- Lưu hoặc xử lý trực tiếp PAN/CVV.
- Điều phối GPS thời gian thực.
- Kế toán tổng hợp cho nhà xe.
- Marketplace ngoài vé xe.
- Tối ưu tuyến tự động.

### 2.6. Nguyên tắc sản phẩm

- Server là nguồn quyết định giá, quyền và trạng thái nghiệp vụ.
- Không double-book TripSeat.
- Các command quan trọng phải idempotent.
- Payment và Refund có mã đối soát và lịch sử audit.
- Web và Mobile dùng cùng quy tắc nghiệp vụ phía server.
- Dữ liệu Operator được cô lập theo tenant.
- Customer được xem giá, phí, policy và thời hạn giữ ghế trước khi xác nhận.

### 2.7. Giả định, phụ thuộc và ràng buộc

- Client có kết nối Internet cho các thao tác giao dịch.
- Payment Gateway hỗ trợ callback/webhook có mã giao dịch duy nhất.
- Notification Provider có API hoặc SMTP phù hợp.
- Nhà xe chịu trách nhiệm về lịch chạy, điểm đón/trả và chính sách.
- Tiền tệ mặc định là VND; không dùng kiểu số thực dấu phẩy động cho tiền.
- Thời gian nghiệp vụ dùng múi giờ chuyến; dữ liệu lưu trữ thống nhất theo quy ước hệ thống.

<a id="chuong-3"></a>

## 3. Quy trình và quy tắc nghiệp vụ

### 3.1. Danh mục quy trình nghiệp vụ

| ID | Quy trình | Actor chính | Kết quả | Activity Diagram |
|---|---|---|---|---|
| BP-01 | Tìm chuyến và đặt vé | Customer | Booking được thanh toán và Ticket được phát hành. | [FIG-ACT-01](#fig-act-01) |
| BP-02 | Hủy vé và hoàn tiền | Customer | Ticket bị hủy và Refund được xử lý. | [FIG-ACT-02](#fig-act-02) |
| BP-03 | Đổi vé | Customer | Ticket mới thay thế Ticket cũ an toàn. | [FIG-ACT-03](#fig-act-03) |
| BP-04 | Tạo và phát hành chuyến | Operator Staff | Trip sẵn sàng để bán. | [FIG-ACT-04](#fig-act-04) |
| BP-05 | Vận hành chuyến và check-in | Driver, Operator Staff | Hành khách được check-in và Trip hoàn tất. | [FIG-ACT-05](#fig-act-05) |
| BP-06 | Hủy chuyến | Operator Staff, Admin | Vé bị ảnh hưởng được hủy, hoàn tiền và thông báo. | [FIG-ACT-06](#fig-act-06) |
| BP-07 | Quản lý tài khoản và nhà xe | Admin, Operator Staff | User, role, tenant và dữ liệu nhà xe được quản lý có audit. | [FIG-ACT-07](#fig-act-07) |

### 3.2. Mẫu đặc tả một quy trình

Mỗi `BP-xx` gồm:

1. Mục tiêu.
2. Actor tham gia.
3. Sự kiện bắt đầu.
4. Tiền điều kiện.
5. Luồng chính ở mức nghiệp vụ.
6. Điểm quyết định.
7. Luồng thay thế và ngoại lệ.
8. Hậu điều kiện thành công/thất bại.
9. Use Case, Business Rule và FR liên quan.
10. Activity Diagram liên quan.

### 3.3. Các quy trình cần đặc tả

#### 3.3.1. BP-01 — Tìm chuyến và đặt vé

`[Viết theo mẫu 3.2; liên kết UC-SEARCH-01, UC-BOOK-01, UC-PAY-01.]`

#### 3.3.2. BP-02 — Hủy vé và hoàn tiền

`[Viết theo mẫu 3.2; liên kết UC-CANCEL-01.]`

#### 3.3.3. BP-03 — Đổi vé

`[Viết theo mẫu 3.2; liên kết UC-CHANGE-01.]`

#### 3.3.4. BP-04 — Tạo và phát hành chuyến

`[Viết theo mẫu 3.2; liên kết UC-OPS-05.]`

#### 3.3.5. BP-05 — Vận hành chuyến và check-in

`[Viết theo mẫu 3.2; liên kết UC-OPS-06, UC-DRIVER-01.]`

#### 3.3.6. BP-06 — Hủy chuyến

`[Viết theo mẫu 3.2; liên kết UC-TRIP-01.]`

#### 3.3.7. BP-07 — Quản lý tài khoản và nhà xe

`[Viết theo mẫu 3.2; liên kết các UC-AUTH, UC-PROFILE, UC-ADMIN và UC-OPS-01..04.]`

### 3.4. Danh mục quy tắc nghiệp vụ

| Nhóm | Phạm vi mã | Nội dung cần đặc tả |
|---|---|---|
| Authorization | AUTHZ-001..008 | Xác thực, quyền, ownership, tenant và service identity. |
| Ghế và giữ ghế | BR-SEAT-001..010 | Tính duy nhất TripSeat, giữ toàn bộ, expiry và snapshot. |
| Booking và giá | BR-BOOK-001..010 | Customer, Passenger, tính giá server, expiry và idempotency. |
| Payment và Refund | BR-PAY-001..010 | Webhook, số tiền, callback trễ, refund và đối soát. |
| Hủy và đổi vé | BR-CANCEL-001..008 | Policy, phí, điều kiện hủy/đổi và bù trừ. |
| Trip và vận hành | BR-TRIP-001..006 | Publish, xung đột lịch, chuyển trạng thái và hủy chuyến. |
| Ticket và check-in | BR-TICKET-001..004 | QR, đúng chuyến, scan lặp và trạng thái sử dụng. |
| Review | BR-REVIEW-001..002 | Điều kiện đánh giá và kiểm duyệt. |
| Tenant | BR-TENANT-001..002 | Ownership và cô lập dữ liệu nhà xe. |
| Dữ liệu | BR-DATA-001..004 | ID, timestamp, concurrency và soft delete. |
| Audit | BR-AUDIT-001..002 | Sự kiện bắt buộc audit và tính append-only. |

### 3.5. Mẫu đặc tả một quy tắc nghiệp vụ

| Thuộc tính | Nội dung |
|---|---|
| ID | `BR-NHOM-xxx` |
| Tên | `[Tên ngắn gọn]` |
| Quy tắc | `[Một phát biểu rõ ràng, không mơ hồ]` |
| Điều kiện áp dụng | `[Khi nào áp dụng]` |
| Ngoại lệ | `[Nếu có]` |
| Nguồn | `[Policy/quy định/yêu cầu]` |
| Liên kết | `[UC, FR và AC liên quan]` |

<a id="chuong-4"></a>

## 4. Đặc tả Use Case và sơ đồ

### 4.1. Use Case Diagram

<a id="fig-uc-01"></a>

#### FIG-UC-01 — Use Case Diagram tổng thể

> `[Chèn sơ đồ tổng thể: Guest, Customer, Operator Staff, Driver, Admin và hệ thống ngoài.]`

<a id="fig-uc-02"></a>

#### FIG-UC-02 — Use Case Diagram Customer

> `[Chèn sơ đồ cho đăng ký, tìm chuyến, đặt vé, thanh toán, vé, hủy/đổi, review và notification.]`

<a id="fig-uc-03"></a>

#### FIG-UC-03 — Use Case Diagram Operator Staff và Driver

> `[Chèn sơ đồ cho organization, xe, tài xế, tuyến, chuyến, manifest, check-in và báo cáo tenant.]`

<a id="fig-uc-04"></a>

#### FIG-UC-04 — Use Case Diagram Admin

> `[Chèn sơ đồ cho user, organization, role, transaction, audit, review/khiếu nại và báo cáo.]`

### 4.2. Danh mục Use Case

| ID | Tên Use Case | Actor chính | Phạm vi FR | Trạng thái |
|---|---|---|---|---|
| UC-AUTH-01 | Đăng ký và kích hoạt tài khoản | Guest | FR-IAM-001..002 | Giữ từ SRS cũ |
| UC-AUTH-02 | Đăng nhập | User | FR-IAM-003, FR-IAM-007 | Giữ từ SRS cũ |
| UC-AUTH-03 | Refresh phiên và đăng xuất | User | FR-IAM-004 | Bổ sung để phủ FR |
| UC-AUTH-04 | Quên và đặt lại mật khẩu | User | FR-IAM-005 | Bổ sung để phủ FR |
| UC-PROFILE-01 | Xem và cập nhật hồ sơ | Customer | FR-IAM-006 | Bổ sung để phủ FR |
| UC-SEARCH-01 | Tìm và xem chuyến | Guest, Customer | FR-SEARCH-001..007 | Giữ từ SRS cũ |
| UC-BOOK-01 | Giữ ghế và tạo Booking | Customer | FR-BOOK-001..007 | Giữ từ SRS cũ |
| UC-BOOK-02 | Xem Booking và Ticket của tôi | Customer | FR-BOOK-008, FR-TICKET-002 | Bổ sung để phủ FR |
| UC-PAY-01 | Thanh toán và nhận vé | Customer | FR-PAY-001..007, FR-TICKET-001..003 | Giữ từ SRS cũ |
| UC-CANCEL-01 | Hủy vé và hoàn tiền | Customer | FR-BOOK-009, FR-PAY-008 | Giữ từ SRS cũ |
| UC-CHANGE-01 | Đổi vé | Customer | FR-BOOK-010 | Giữ từ SRS cũ |
| UC-TICKET-01 | Xem và sử dụng vé điện tử | Customer | FR-TICKET-001..003 | Bổ sung để phủ FR |
| UC-OPS-01 | Quản lý thông tin nhà xe | Operator Staff | FR-OPS-001 | Bổ sung để phủ FR |
| UC-OPS-02 | Quản lý xe và sơ đồ ghế | Operator Staff | FR-OPS-002, FR-OPS-009 | Bổ sung để phủ FR |
| UC-OPS-03 | Quản lý tài xế | Operator Staff | FR-OPS-003, FR-OPS-009 | Bổ sung để phủ FR |
| UC-OPS-04 | Quản lý tuyến và điểm dừng | Operator Staff | FR-OPS-004, FR-OPS-009 | Bổ sung để phủ FR |
| UC-OPS-05 | Tạo và phát hành chuyến | Operator Staff | FR-OPS-005..006 | Mở rộng UC-OPS-01 cũ |
| UC-OPS-06 | Vận hành chuyến và manifest | Operator Staff, Driver | FR-OPS-007, FR-OPS-010, FR-BOOK-011 | Bổ sung để phủ FR |
| UC-DRIVER-01 | Check-in hành khách | Driver, Operator Staff | FR-TICKET-004..006 | Giữ từ SRS cũ |
| UC-TRIP-01 | Hủy chuyến có vé đã bán | Operator Staff, Admin | FR-OPS-008 | Giữ từ SRS cũ |
| UC-PROMO-01 | Quản lý và áp dụng Promotion | Operator Staff, Admin | FR-PROMO-001..002 | Bổ sung để phủ FR |
| UC-REVIEW-01 | Tạo và cập nhật Review | Customer | FR-REVIEW-001 | Bổ sung để phủ FR |
| UC-REVIEW-02 | Kiểm duyệt Review | Operator Staff, Admin | FR-REVIEW-002 | Bổ sung để phủ FR |
| UC-NOTIF-01 | Xem và cấu hình Notification | User | FR-NOTIF-001..003 | Bổ sung để phủ FR |
| UC-ADMIN-01 | Quản lý User, Organization và quyền | Admin | FR-IAM-008..009, FR-ADMIN-001 | Giữ và mở rộng SRS cũ |
| UC-ADMIN-02 | Tra cứu giao dịch và audit | Admin, Operator Finance | FR-ADMIN-002, FR-PAY-009..010 | Bổ sung để phủ FR |
| UC-ADMIN-03 | Quản lý khiếu nại | Admin | FR-ADMIN-003 | Bổ sung để phủ FR |
| UC-REPORT-01 | Xem và xuất báo cáo | Admin, Operator Finance | FR-REPORT-001..003 | Giữ và mở rộng SRS cũ |

### 4.3. Mẫu đặc tả một Use Case

| Thuộc tính | Nội dung |
|---|---|
| ID và tên | `UC-NHOM-xx — Tên Use Case` |
| Mục tiêu | `[Kết quả actor muốn đạt]` |
| Actor chính | `[Actor khởi tạo]` |
| Actor phụ | `[Actor/hệ thống hỗ trợ]` |
| Kích hoạt | `[Sự kiện bắt đầu]` |
| Tiền điều kiện | `[Điều kiện phải đúng trước khi chạy]` |
| Hậu điều kiện thành công | `[Trạng thái cuối khi thành công]` |
| Hậu điều kiện thất bại | `[Trạng thái được bảo toàn hoặc phục hồi]` |
| Mức ưu tiên | `[MUST/SHOULD/COULD]` |
| Liên kết | `[BP, BR, FR, AC và sơ đồ]` |

Sau bảng thuộc tính, mỗi Use Case phải có:

1. Luồng chính được đánh số.
2. Luồng thay thế.
3. Luồng ngoại lệ.
4. Quy tắc bù trừ nếu có.
5. Dữ liệu vào/ra quan trọng.
6. Business Rule, FR và AC liên quan.

### 4.4. Các Use Case cần đặc tả chi tiết

#### 4.4.1. Định danh và hồ sơ

<a id="uc-auth-01"></a>

##### UC-AUTH-01 — Đăng ký và kích hoạt tài khoản

`[Viết theo mẫu 4.3; liên kết FIG-SEQ-01.]`

<a id="uc-auth-02"></a>

##### UC-AUTH-02 — Đăng nhập

`[Viết theo mẫu 4.3; liên kết FIG-SEQ-02.]`

<a id="uc-auth-03"></a>

##### UC-AUTH-03 — Refresh phiên và đăng xuất

`[Viết theo mẫu 4.3.]`

<a id="uc-auth-04"></a>

##### UC-AUTH-04 — Quên và đặt lại mật khẩu

`[Viết theo mẫu 4.3.]`

<a id="uc-profile-01"></a>

##### UC-PROFILE-01 — Xem và cập nhật hồ sơ

`[Viết theo mẫu 4.3.]`

#### 4.4.2. Tìm chuyến, Booking và Ticket

<a id="uc-search-01"></a>

##### UC-SEARCH-01 — Tìm và xem chuyến

`[Viết theo mẫu 4.3; liên kết FIG-ACT-01 và FIG-SEQ-03.]`

<a id="uc-book-01"></a>

##### UC-BOOK-01 — Giữ ghế và tạo Booking

`[Viết theo mẫu 4.3; liên kết FIG-ACT-01, FIG-SEQ-03 và FIG-STATE-01.]`

<a id="uc-book-02"></a>

##### UC-BOOK-02 — Xem Booking và Ticket của tôi

`[Viết theo mẫu 4.3.]`

<a id="uc-ticket-01"></a>

##### UC-TICKET-01 — Xem và sử dụng vé điện tử

`[Viết theo mẫu 4.3; mô tả mã vé, QR và trạng thái.]`

#### 4.4.3. Thanh toán, hủy và đổi vé

<a id="uc-pay-01"></a>

##### UC-PAY-01 — Thanh toán và nhận vé

`[Viết theo mẫu 4.3; liên kết FIG-SEQ-04 và FIG-STATE-02.]`

<a id="uc-cancel-01"></a>

##### UC-CANCEL-01 — Hủy vé và hoàn tiền

`[Viết theo mẫu 4.3; liên kết FIG-ACT-02, FIG-SEQ-05 và FIG-STATE-03.]`

<a id="uc-change-01"></a>

##### UC-CHANGE-01 — Đổi vé

`[Viết theo mẫu 4.3; liên kết FIG-ACT-03 và FIG-SEQ-06.]`

#### 4.4.4. Vận hành nhà xe và chuyến

<a id="uc-ops-01"></a>

##### UC-OPS-01 — Quản lý thông tin nhà xe

`[Viết theo mẫu 4.3; luôn kiểm tra tenant scope.]`

<a id="uc-ops-02"></a>

##### UC-OPS-02 — Quản lý xe và sơ đồ ghế

`[Viết theo mẫu 4.3.]`

<a id="uc-ops-03"></a>

##### UC-OPS-03 — Quản lý tài xế

`[Viết theo mẫu 4.3.]`

<a id="uc-ops-04"></a>

##### UC-OPS-04 — Quản lý tuyến và điểm dừng

`[Viết theo mẫu 4.3.]`

<a id="uc-ops-05"></a>

##### UC-OPS-05 — Tạo và phát hành chuyến

`[Viết theo mẫu 4.3; liên kết FIG-ACT-04, FIG-SEQ-07 và FIG-STATE-04.]`

<a id="uc-ops-06"></a>

##### UC-OPS-06 — Vận hành chuyến và manifest

`[Viết theo mẫu 4.3; liên kết FIG-ACT-05 và FIG-STATE-04.]`

<a id="uc-driver-01"></a>

##### UC-DRIVER-01 — Check-in hành khách

`[Viết theo mẫu 4.3; liên kết FIG-ACT-05, FIG-SEQ-08 và FIG-STATE-03.]`

<a id="uc-trip-01"></a>

##### UC-TRIP-01 — Hủy chuyến có vé đã bán

`[Viết theo mẫu 4.3; liên kết FIG-ACT-06, FIG-SEQ-09 và FIG-STATE-04.]`

#### 4.4.5. Promotion, Review và Notification

<a id="uc-promo-01"></a>

##### UC-PROMO-01 — Quản lý và áp dụng Promotion

`[Viết theo mẫu 4.3; tách luồng quản lý và luồng áp dụng bằng nhánh.]`

<a id="uc-review-01"></a>

##### UC-REVIEW-01 — Tạo và cập nhật Review

`[Viết theo mẫu 4.3.]`

<a id="uc-review-02"></a>

##### UC-REVIEW-02 — Kiểm duyệt Review

`[Viết theo mẫu 4.3; yêu cầu reason và audit.]`

<a id="uc-notif-01"></a>

##### UC-NOTIF-01 — Xem và cấu hình Notification

`[Viết theo mẫu 4.3.]`

#### 4.4.6. Quản trị và báo cáo

<a id="uc-admin-01"></a>

##### UC-ADMIN-01 — Quản lý User, Organization và quyền

`[Viết theo mẫu 4.3; liên kết FIG-ACT-07.]`

<a id="uc-admin-02"></a>

##### UC-ADMIN-02 — Tra cứu giao dịch và audit

`[Viết theo mẫu 4.3; áp tenant/permission phù hợp.]`

<a id="uc-admin-03"></a>

##### UC-ADMIN-03 — Quản lý khiếu nại

`[Viết theo mẫu 4.3.]`

<a id="uc-report-01"></a>

##### UC-REPORT-01 — Xem và xuất báo cáo

`[Viết theo mẫu 4.3; mô tả tenant scope, timezone và độ trễ dữ liệu.]`

### 4.5. Activity Diagram

<a id="fig-act-01"></a>

#### FIG-ACT-01 — Tìm chuyến và đặt vé

> `[Chèn Activity Diagram cho BP-01; bao gồm search, chọn ghế, hold, booking, payment và nhận Ticket.]`

<a id="fig-act-02"></a>

#### FIG-ACT-02 — Hủy vé và hoàn tiền

> `[Chèn Activity Diagram cho BP-02; bao gồm preview, xác nhận, hủy Ticket và Refund.]`

<a id="fig-act-03"></a>

#### FIG-ACT-03 — Đổi vé

> `[Chèn Activity Diagram cho BP-03; giữ ghế mới trước khi vô hiệu vé cũ và có nhánh bù trừ.]`

<a id="fig-act-04"></a>

#### FIG-ACT-04 — Tạo và phát hành chuyến

> `[Chèn Activity Diagram cho BP-04; kiểm tra dữ liệu, xung đột lịch và tạo inventory ghế.]`

<a id="fig-act-05"></a>

#### FIG-ACT-05 — Vận hành chuyến và check-in

> `[Chèn Activity Diagram cho BP-05; manifest, scan vé và chuyển trạng thái Trip.]`

<a id="fig-act-06"></a>

#### FIG-ACT-06 — Hủy chuyến có vé đã bán

> `[Chèn Activity Diagram cho BP-06; hủy vé, hoàn tiền, thông báo và xử lý lỗi.]`

<a id="fig-act-07"></a>

#### FIG-ACT-07 — Quản lý tài khoản và nhà xe

> `[Chèn Activity Diagram cho BP-07; tạo organization, membership, role và audit.]`

### 4.6. Sequence Diagram

<a id="fig-seq-01"></a>

#### FIG-SEQ-01 — Đăng ký và xác minh tài khoản

> `[Guest → Client → Identity → Notification Provider.]`

<a id="fig-seq-02"></a>

#### FIG-SEQ-02 — Đăng nhập

> `[User → Client → Identity; bao gồm rate limit, xác thực và phát hành phiên.]`

<a id="fig-seq-03"></a>

#### FIG-SEQ-03 — Tìm chuyến, giữ ghế và tạo Booking

> `[Customer → Client → hệ thống tìm kiếm/Booking; thể hiện transaction và idempotency.]`

<a id="fig-seq-04"></a>

#### FIG-SEQ-04 — Thanh toán và phát hành Ticket

> `[Customer → Client → Payment Gateway → Payment → Booking → Notification; có webhook lặp/trễ.]`

<a id="fig-seq-05"></a>

#### FIG-SEQ-05 — Hủy vé và Refund

> `[Customer → Booking → Payment Gateway/Payment → Notification.]`

<a id="fig-seq-06"></a>

#### FIG-SEQ-06 — Đổi vé

> `[Customer → Booking → Payment; thể hiện hold mới, chênh lệch giá và bù trừ.]`

<a id="fig-seq-07"></a>

#### FIG-SEQ-07 — Tạo và phát hành chuyến

> `[Operator → hệ thống vận hành chuyến → hệ thống Booking; tạo TripSeat trước khi mở bán.]`

<a id="fig-seq-08"></a>

#### FIG-SEQ-08 — Check-in hành khách

> `[Driver → Back-office → Booking/Ticket; kiểm tra quyền, đúng Trip và idempotency.]`

<a id="fig-seq-09"></a>

#### FIG-SEQ-09 — Hủy chuyến có vé đã bán

> `[Operator/Admin → Trip → Booking → Payment → Notification/Reporting.]`

<a id="chuong-5"></a>

## 5. Yêu cầu chức năng

### 5.1. Quy tắc viết Functional Requirement

- Mỗi FR mô tả một hành vi quan sát hoặc kiểm chứng được.
- Không ghi chi tiết bảng dữ liệu, thuật toán, container hoặc framework.
- Dùng `MUST`, `SHOULD` hoặc `COULD` nhất quán.
- Mỗi FR phải liên kết ít nhất một Use Case và một Acceptance Criteria/Test Case.
- Các bảng dưới đây là danh sách chức năng bắt buộc phải được giữ khi viết lại.

### 5.2. Identity và tài khoản

| ID | Mức | Yêu cầu cần giữ | Use Case |
|---|---|---|---|
| FR-IAM-001 | MUST | Đăng ký bằng họ tên, email, số điện thoại và mật khẩu; kiểm tra định dạng và tính duy nhất. | UC-AUTH-01 |
| FR-IAM-002 | MUST | Gửi và xác minh email/OTP trước khi kích hoạt Customer. | UC-AUTH-01 |
| FR-IAM-003 | MUST | Đăng nhập bằng email/số điện thoại và nhận phiên truy cập. | UC-AUTH-02 |
| FR-IAM-004 | MUST | Refresh phiên, logout và thu hồi refresh token. | UC-AUTH-03 |
| FR-IAM-005 | MUST | Reset mật khẩu bằng token/OTP có thời hạn và không lộ sự tồn tại tài khoản. | UC-AUTH-04 |
| FR-IAM-006 | MUST | Xem/cập nhật hồ sơ; xác minh lại email/số điện thoại thay đổi. | UC-PROFILE-01 |
| FR-IAM-007 | MUST | Khóa/chậm đăng nhập khi vượt ngưỡng thất bại và ghi security audit. | UC-AUTH-02 |
| FR-IAM-008 | MUST | Admin khóa/mở user và gán role có audit. | UC-ADMIN-01 |
| FR-IAM-009 | MUST | Admin tạo Organization và membership cho Operator Staff/Driver. | UC-ADMIN-01 |

### 5.3. Tìm kiếm và xem chuyến

| ID | Mức | Yêu cầu cần giữ | Use Case |
|---|---|---|---|
| FR-SEARCH-001 | MUST | Tìm chuyến theo điểm đi, điểm đến, ngày đi và số hành khách. | UC-SEARCH-01 |
| FR-SEARCH-002 | MUST | Chỉ trả chuyến còn khả năng bán; hỗ trợ phân trang và tổng kết quả. | UC-SEARCH-01 |
| FR-SEARCH-003 | MUST | Lọc theo giá, giờ đi, nhà xe, loại xe, điểm đón/trả, tiện nghi và đánh giá. | UC-SEARCH-01 |
| FR-SEARCH-004 | MUST | Sắp xếp theo giá, giờ khởi hành, thời lượng và đánh giá. | UC-SEARCH-01 |
| FR-SEARCH-005 | MUST | Xem chi tiết nhà xe, lịch trình, xe, tiện nghi, điểm đón/trả, giá và policy. | UC-SEARCH-01 |
| FR-SEARCH-006 | MUST | Hiển thị availability có thời điểm cập nhật và kiểm tra lại khi giữ ghế. | UC-SEARCH-01, UC-BOOK-01 |
| FR-SEARCH-007 | SHOULD | Ghi nhận truy vấn tìm kiếm đã ẩn danh để báo cáo. | UC-SEARCH-01 |

### 5.4. Ghế, giữ ghế và Booking

| ID | Mức | Yêu cầu cần giữ | Use Case |
|---|---|---|---|
| FR-BOOK-001 | MUST | Customer xem TripSeat và trạng thái khả dụng. | UC-BOOK-01 |
| FR-BOOK-002 | MUST | Giữ một hoặc nhiều ghế theo nguyên tắc toàn bộ hoặc không ghế nào; trả holdToken, expiresAt và giá. | UC-BOOK-01 |
| FR-BOOK-003 | MUST | Từ chối toàn bộ nếu bất kỳ ghế nào không còn khả dụng tại commit. | UC-BOOK-01 |
| FR-BOOK-004 | MUST | Nhập một Passenger cho mỗi ghế và kiểm tra dữ liệu theo policy. | UC-BOOK-01 |
| FR-BOOK-005 | MUST | Tạo đúng một Booking từ SeatHold còn hiệu lực và hỗ trợ idempotency. | UC-BOOK-01 |
| FR-BOOK-006 | MUST | Backend tự tính subtotal, discount, fee và total. | UC-BOOK-01 |
| FR-BOOK-007 | MUST | SeatHold/Booking chưa thanh toán hết hạn và giải phóng ghế tự động. | UC-BOOK-01 |
| FR-BOOK-008 | MUST | Customer xem Booking/Ticket sắp đi, đã dùng, bị hủy hoặc hoàn tiền của mình. | UC-BOOK-02 |
| FR-BOOK-009 | MUST | Hủy Booking/Ticket đủ điều kiện và xem phí/số tiền hoàn trước xác nhận. | UC-CANCEL-01 |
| FR-BOOK-010 | SHOULD | Đổi ngày/chuyến/ghế, xử lý chênh lệch và bảo toàn vé cũ khi thất bại. | UC-CHANGE-01 |
| FR-BOOK-011 | MUST | Operator tra cứu Booking/manifest trong tenant được phép. | UC-OPS-06 |

### 5.5. Thanh toán và hoàn tiền

| ID | Mức | Yêu cầu cần giữ | Use Case |
|---|---|---|---|
| FR-PAY-001 | MUST | Tạo payment intent cho Booking đang chờ và còn hiệu lực. | UC-PAY-01 |
| FR-PAY-002 | MUST | Gửi yêu cầu đến provider với mã tham chiếu, amount, currency và callback URL. | UC-PAY-01 |
| FR-PAY-003 | MUST | Xác minh chữ ký, provider, transaction ID, amount và currency của webhook. | UC-PAY-01 |
| FR-PAY-004 | MUST | Webhook lặp không tạo thêm Payment, Ticket hoặc tác động nghiệp vụ. | UC-PAY-01 |
| FR-PAY-005 | MUST | Khi thanh toán hợp lệ, cập nhật Booking, ghế và Ticket nhất quán. | UC-PAY-01 |
| FR-PAY-006 | MUST | Thanh toán thất bại/hủy không làm Booking thành PAID. | UC-PAY-01 |
| FR-PAY-007 | MUST | Payment thành công trễ nhưng không cấp được vé phải tạo compensation/manual case. | UC-PAY-01 |
| FR-PAY-008 | MUST | Tạo và theo dõi Refund; request lặp không hoàn tiền hai lần. | UC-CANCEL-01 |
| FR-PAY-009 | MUST | Admin/Operator Finance tra cứu Payment/Refund theo quyền và mã giao dịch. | UC-ADMIN-02 |
| FR-PAY-010 | SHOULD | Đối soát các transaction chưa có kết quả cuối. | UC-ADMIN-02 |

### 5.6. Vé và check-in

| ID | Mức | Yêu cầu cần giữ | Use Case |
|---|---|---|---|
| FR-TICKET-001 | MUST | Mỗi Passenger/TripSeat của Booking PAID có đúng một Ticket. | UC-PAY-01 |
| FR-TICKET-002 | MUST | Ticket hiển thị mã, hành khách, nhà xe, chuyến, điểm đón/trả, ghế, giá, trạng thái và QR. | UC-TICKET-01 |
| FR-TICKET-003 | MUST | QR an toàn, không chứa PII dạng rõ không cần thiết. | UC-TICKET-01 |
| FR-TICKET-004 | MUST | Driver/Operator được quyền có thể scan hoặc nhập mã vé. | UC-DRIVER-01 |
| FR-TICKET-005 | MUST | Check-in idempotent; từ chối vé sai chuyến hoặc không còn hiệu lực. | UC-DRIVER-01 |
| FR-TICKET-006 | MUST | Ghi actor, thời điểm, Trip và kết quả check-in vào audit. | UC-DRIVER-01 |

### 5.7. Vận hành nhà xe

| ID | Mức | Yêu cầu cần giữ | Use Case |
|---|---|---|---|
| FR-OPS-001 | MUST | Operator cập nhật thông tin Organization của mình theo permission. | UC-OPS-01 |
| FR-OPS-002 | MUST | Tạo/cập nhật/deactivate xe và sơ đồ ghế; kiểm tra biển số duy nhất. | UC-OPS-02 |
| FR-OPS-003 | MUST | Tạo/cập nhật/deactivate DriverProfile và kiểm tra hạn giấy phép. | UC-OPS-03 |
| FR-OPS-004 | MUST | Quản lý route, stop, thứ tự dừng và thời gian dự kiến. | UC-OPS-04 |
| FR-OPS-005 | MUST | Tạo draft Trip, phân xe/tài xế, định giá và publish. | UC-OPS-05 |
| FR-OPS-006 | MUST | Khi publish, kiểm tra xung đột lịch và tạo snapshot ghế. | UC-OPS-05 |
| FR-OPS-007 | MUST | Actor được quyền chuyển trạng thái Trip theo quy tắc hợp lệ. | UC-OPS-06 |
| FR-OPS-008 | MUST | Hủy Trip có vé đã bán phải xử lý vé, Refund và Notification. | UC-TRIP-01 |
| FR-OPS-009 | MUST | Dữ liệu xe/tài xế/tuyến đã được tham chiếu không bị hard delete. | UC-OPS-02..04 |
| FR-OPS-010 | MUST | Driver xem assignment và manifest tối thiểu của chuyến được phân công. | UC-OPS-06, UC-DRIVER-01 |

### 5.8. Promotion, Review và Notification

| ID | Mức | Yêu cầu cần giữ | Use Case |
|---|---|---|---|
| FR-PROMO-001 | SHOULD | Admin/Operator tạo Promotion có phạm vi, thời hạn, quota và điều kiện. | UC-PROMO-01 |
| FR-PROMO-002 | SHOULD | Kiểm tra Promotion ở server, ngăn vượt quota và lưu discount snapshot. | UC-PROMO-01 |
| FR-REVIEW-001 | SHOULD | Customer tạo tối đa một Review cho Ticket đã sử dụng và cập nhật trong thời hạn. | UC-REVIEW-01 |
| FR-REVIEW-002 | SHOULD | Admin/Operator ẩn Review vi phạm và lưu reason/audit. | UC-REVIEW-02 |
| FR-NOTIF-001 | MUST | Tạo Notification cho các sự kiện Booking, Payment, Ticket, Trip và Refund quan trọng. | UC-NOTIF-01 và các UC phát sinh sự kiện |
| FR-NOTIF-002 | MUST | Notification lỗi được retry có giới hạn và không rollback giao dịch đã commit. | UC-NOTIF-01 |
| FR-NOTIF-003 | SHOULD | User cấu hình kênh tùy chọn; thông báo giao dịch thiết yếu không được tắt hoàn toàn. | UC-NOTIF-01 |

### 5.9. Admin và báo cáo

| ID | Mức | Yêu cầu cần giữ | Use Case |
|---|---|---|---|
| FR-ADMIN-001 | MUST | Quản lý Organization, User, role, trạng thái và tenant membership. | UC-ADMIN-01 |
| FR-ADMIN-002 | MUST | Tra cứu Booking, Payment, Refund và audit nhưng không sửa lịch sử bất biến. | UC-ADMIN-02 |
| FR-ADMIN-003 | SHOULD | Quản lý khiếu nại theo trạng thái, người xử lý và kết quả. | UC-ADMIN-03 |
| FR-REPORT-001 | MUST | Admin xem gross/net revenue, Booking, Refund và occupancy theo thời gian. | UC-REPORT-01 |
| FR-REPORT-002 | MUST | Operator xem báo cáo giới hạn theo tenant, có định nghĩa metric và timezone. | UC-REPORT-01 |
| FR-REPORT-003 | SHOULD | Export CSV; export lớn chạy bất đồng bộ. | UC-REPORT-01 |

<a id="chuong-6"></a>

## 6. Yêu cầu trạng thái nghiệp vụ

### 6.1. Quy ước chung

- Văn bản phải định nghĩa trạng thái, sự kiện và điều kiện chuyển trạng thái.
- State Diagram chỉ minh họa; bảng chuyển trạng thái và BR là nguồn kiểm chứng.
- Tên trạng thái phải thống nhất giữa SRS, API và giao diện.

### 6.2. Danh mục trạng thái

| Thực thể | Trạng thái cần đặc tả |
|---|---|
| TripSeat | AVAILABLE, HELD, BOOKED, DISABLED |
| SeatHold | ACTIVE, CONSUMED, EXPIRED, RELEASED |
| Booking | PENDING_PAYMENT, PAID, EXPIRED, CANCELLED, REFUND_PENDING, REFUNDED, COMPLETED |
| Payment | PENDING, PROCESSING, SUCCEEDED, FAILED, CANCELLED, REFUND_PENDING, PARTIALLY_REFUNDED, REFUNDED |
| Ticket | ISSUED, CHECKED_IN, USED, CANCELLED, REFUNDED |
| Refund | REQUESTED, PROCESSING, SUCCEEDED, FAILED |
| Trip | SCHEDULED, BOARDING, DEPARTED, IN_TRANSIT, ARRIVED, COMPLETED, CANCELLED |

### 6.3. Mẫu bảng chuyển trạng thái

| Trạng thái nguồn | Sự kiện/actor | Điều kiện | Trạng thái đích | Tác động liên quan | Xử lý thất bại |
|---|---|---|---|---|---|
| `[STATE_A]` | `[Command/Event]` | `[Guard]` | `[STATE_B]` | `[Audit/Event/Update]` | `[Giữ nguyên/Bù trừ]` |

<a id="fig-state-01"></a>

### 6.4. FIG-STATE-01 — State Diagram TripSeat và SeatHold

> `[Chèn sơ đồ và bảng chuyển trạng thái; liên kết BR-SEAT và FR-BOOK.]`

<a id="fig-state-02"></a>

### 6.5. FIG-STATE-02 — State Diagram Booking và Payment

> `[Chèn sơ đồ và bảng chuyển trạng thái; thể hiện payment callback lặp/trễ và expiry.]`

<a id="fig-state-03"></a>

### 6.6. FIG-STATE-03 — State Diagram Ticket và Refund

> `[Chèn sơ đồ và bảng chuyển trạng thái; thể hiện check-in, hủy và hoàn tiền.]`

<a id="fig-state-04"></a>

### 6.7. FIG-STATE-04 — State Diagram Trip

> `[Chèn sơ đồ và bảng chuyển trạng thái; thể hiện actor được quyền và nhánh hủy.]`

<a id="chuong-7"></a>

## 7. Yêu cầu giao diện và tích hợp

### 7.1. Nguyên tắc giao diện chung

- Web và Mobile hỗ trợ cùng quy trình Customer cốt lõi.
- Mọi màn hình dữ liệu từ xa có loading, empty, error và retry state.
- Client không tự kết luận Payment thành công từ redirect.
- Đồng hồ giữ ghế dùng `expiresAt` từ server.
- Hiển thị giá, phí, discount, tổng tiền, policy và thời hạn giữ trước xác nhận.
- Ngăn double-submit nhưng vẫn gửi idempotency key.
- Không hiển thị chức năng ngoài quyền; server vẫn phải kiểm tra authorization.

### 7.2. Web End-user

- Trang chủ và tìm kiếm.
- Danh sách kết quả, lọc, sắp xếp và phân trang.
- Chi tiết chuyến, điểm dừng, policy và sơ đồ ghế.
- Thông tin Passenger và Booking summary.
- Thanh toán và trạng thái processing/success/failure.
- Danh sách/chi tiết Booking và Ticket.
- QR/mã vé.
- Preview hủy, xác nhận hủy và đổi vé nếu triển khai.
- Hồ sơ, bảo mật tài khoản và Notification preference.
- Review chuyến.

### 7.3. Mobile App

- Chức năng Customer MUST tương đương Web End-user.
- Lưu token bằng secure storage.
- Có thể xem Ticket/QR đã tải khi mạng tạm mất nếu policy cho phép.
- Deep link/payment return kiểm tra state/nonce và truy vấn trạng thái server.
- Khi app resume phải đồng bộ lại SeatHold và Payment.
- Hiển thị yêu cầu nâng cấp khi phiên bản API không còn được hỗ trợ.

### 7.4. Back-office Web

#### 7.4.1. Admin

- Dashboard nền tảng.
- Organization, User, role và membership.
- Tra cứu Booking, Payment và Refund.
- Review/khiếu nại.
- Audit và báo cáo.

#### 7.4.2. Operator Staff

- Organization profile.
- Xe và sơ đồ ghế.
- Tài xế và giấy phép.
- Tuyến, điểm dừng và Trip scheduler.
- Manifest, Booking và vận hành Trip.
- Doanh thu/occupancy trong tenant.

#### 7.4.3. Driver

- Chuyến được phân công.
- Manifest tối thiểu.
- Scan QR/nhập mã vé.
- Chuyển trạng thái Trip theo quyền.

### 7.5. Yêu cầu API dùng chung

- HTTPS và JSON UTF-8.
- API có version.
- Xác thực và authorization thống nhất.
- Correlation ID.
- Idempotency key cho command quan trọng.
- Thời gian theo ISO-8601 có timezone.
- Mã lỗi ổn định để Web và Mobile dùng chung.
- Phân trang, lọc và sắp xếp nhất quán.
- Timeout và retry có giới hạn.

> Danh sách endpoint, request/response và schema chi tiết thuộc tài liệu API/OpenAPI riêng.

### 7.6. Tích hợp Payment Gateway

- Tạo Payment intent.
- Redirect/deep link nếu có.
- Xác minh webhook.
- Chống replay và webhook lặp.
- Timeout, trạng thái PROCESSING và reconciliation.
- Refund và compensation.

### 7.7. Tích hợp Notification Provider

- Email, in-app, push/SMS theo phạm vi.
- Retry có giới hạn.
- Notification không nằm trên critical path của Booking/Payment.
- Theo dõi trạng thái gửi và DeliveryAttempt.

<a id="chuong-8"></a>

## 8. Yêu cầu dữ liệu

### 8.1. Các thực thể nghiệp vụ chính

| Miền | Thực thể cần mô tả |
|---|---|
| Identity | User, Role, Membership, RefreshToken, SecurityAudit |
| Transport | Organization, Bus, Seat, DriverProfile, Route, RouteStop, Trip, DriverAssignment |
| Booking | TripSnapshot, TripSeat, SeatHold, Booking, Passenger, BookingItem, Ticket, Promotion, Review |
| Payment | Payment, PaymentAttempt, WebhookReceipt, Refund, ReconciliationCase |
| Notification/Reporting | Notification, DeliveryAttempt, UserPreference, ReportProjection, ExportJob |

### 8.2. Ràng buộc dữ liệu bắt buộc

- Email/số điện thoại chuẩn hóa và duy nhất theo policy.
- TripSeat duy nhất theo Trip và ghế nguồn/mã ghế.
- Một SeatHold chỉ được consume một lần.
- Mỗi BookingItem có một Passenger và tối đa một Ticket còn hiệu lực.
- Provider transaction/event ID duy nhất.
- Tổng Refund thành công không vượt Payment thành công.
- Dữ liệu Operator có organization ownership.
- Tiền dùng kiểu số chính xác.
- Entity giao dịch không hard delete.
- Dữ liệu có concurrency token khi cần.

### 8.3. Dữ liệu nhạy cảm

- Password chỉ lưu password hash.
- Token/OTP lưu hash khi phù hợp và có expiry/revoke.
- CCCD/giấy phép được mã hóa, mask và audit quyền truy cập.
- Không lưu PAN/CVV.
- QR không chứa PII dạng rõ không cần thiết.
- PII không xuất hiện trong log.

### 8.4. Lưu giữ, sao lưu và phục hồi

`[Định nghĩa retention cho audit, application log, idempotency, webhook receipt, SeatHold và giao dịch.]`

### 8.5. Phạm vi của ERD

ERD không bắt buộc trong SRS này. Nếu cần trình bày cho đồ án, chỉ đặt một ERD khái niệm trong phụ lục; ERD vật lý theo service, PK/FK, kiểu cột và migration thuộc tài liệu thiết kế cơ sở dữ liệu.

<a id="chuong-9"></a>

## 9. Yêu cầu phi chức năng

### 9.1. Mẫu viết NFR

| Thuộc tính | Nội dung |
|---|---|
| ID | `NFR-NHOM-xxx` |
| Phạm vi | `[API/chức năng/kênh áp dụng]` |
| Điều kiện đo | `[Môi trường, tải và dữ liệu]` |
| Chỉ số | `[p95, tỷ lệ, số lượng, RTO...]` |
| Ngưỡng đạt | `[Giá trị cụ thể]` |
| Cách kiểm chứng | `[Load test, security test, review...]` |

### 9.2. Hiệu năng và tải — NFR-PERF-001..007

- Search API.
- Trip detail và seat availability.
- SeatHold command.
- CRUD thông thường.
- Payment webhook.
- Báo cáo online/export.
- Không double-book hoặc duplicate dưới tải đồng thời.

### 9.3. Sẵn sàng và phục hồi — NFR-REL-001..006

- Availability mục tiêu.
- RPO và RTO.
- Backup và restore test.
- Lỗi Notification/Reporting không làm hỏng giao dịch đã commit.
- Retry và dead-letter cho event.
- Health/readiness check.

### 9.4. Khả năng mở rộng — NFR-SCALE-001..004

- Các miền nghiệp vụ có thể scale độc lập.
- Không phụ thuộc session trong memory của một instance.
- Consumer/job chạy nhiều instance nhưng không xử lý logical event hai lần.
- Read model/cache không thay đổi nguồn sự thật giao dịch.

### 9.5. Bảo mật — NFR-SEC-001..012

- TLS.
- Password hashing.
- Access/refresh token policy.
- Rate limiting.
- Chống brute force.
- Authorization, ownership và tenant scope.
- Input validation, SQL injection, XSS, CSRF và CORS.
- Quản lý secret.
- Xác minh webhook và chống replay.
- Mã hóa/mask PII.
- Quét dependency/container image.

### 9.6. Quyền riêng tư — NFR-PRIV-001..

- Tối thiểu hóa dữ liệu thu thập.
- Nêu mục đích thu thập CCCD/CMND nếu có.
- Quyền xem/cập nhật dữ liệu hồ sơ.
- Manifest chỉ hiển thị dữ liệu tối thiểu.
- Export PII có permission, expiry và audit.
- Retention/deletion được phê duyệt.

### 9.7. Logging, monitoring và audit — NFR-OBS-001..006

- Structured log có timestamp, service, environment, level, correlation ID và error code.
- Không log secret/token/OTP/PII nhạy cảm.
- Metrics cho latency, error rate, queue, hold, payment và refund.
- Trace context qua các bước Booking–Payment.
- Alert cho sự cố quan trọng.
- Audit log tách khỏi debug log và hạn chế quyền truy cập.

### 9.8. Tương thích, khả dụng và accessibility — NFR-UX-001..004

- Trình duyệt được hỗ trợ.
- Responsive từ kích thước màn hình tối thiểu được duyệt.
- Luồng cốt lõi dùng được bằng bàn phím.
- Mục tiêu WCAG 2.1 AA.
- Lỗi dùng thuật ngữ nhất quán và không lộ chi tiết nội bộ.

### 9.9. Bảo trì và phát hành — NFR-MAIN-001..

- Tài liệu và test cho từng thành phần.
- Unit, integration, contract và concurrency test.
- Cấu hình tách khỏi bản build.
- Migration tương thích khi rolling deployment.
- Có phương án rollback không phá hủy dữ liệu.

<a id="chuong-10"></a>

## 10. Nghiệm thu và truy vết

### 10.1. Acceptance Criteria P0 hiện có

| ID | Nội dung kiểm chứng chính |
|---|---|
| AC-AUTH-001 | Đăng ký không tạo tài khoản trùng. |
| AC-AUTH-002 | Operator không truy cập dữ liệu tenant khác. |
| AC-SEAT-001 | Hai Customer giữ cùng ghế đồng thời chỉ một người thành công. |
| AC-SEAT-002 | Giữ nhiều ghế phải thành công toàn bộ hoặc thất bại toàn bộ. |
| AC-SEAT-003 | Không tạo Booking từ SeatHold hết hạn. |
| AC-BOOK-001 | Server tính lại giá, không tin total từ client. |
| AC-BOOK-002 | Request lặp không tạo Booking thứ hai. |
| AC-PAY-001 | Webhook hợp lệ cập nhật Payment, Booking, TripSeat và Ticket đúng. |
| AC-PAY-002 | Webhook lặp không tạo tác động lần hai. |
| AC-PAY-003 | Webhook sai số tiền không phát hành Ticket. |
| AC-PAY-004 | Callback trễ không gây double-book và tạo compensation/manual case. |
| AC-CANCEL-001 | Hiển thị policy, phí và số tiền hoàn trước xác nhận. |
| AC-CANCEL-002 | Hủy lặp không tạo Refund thứ hai. |
| AC-TICKET-001 | Check-in đúng Trip cập nhật trạng thái và audit. |
| AC-TICKET-002 | Ticket sai Trip bị từ chối. |
| AC-TRIP-001 | Xung đột lịch xe/tài xế làm publish bị từ chối. |
| AC-TRIP-002 | Hủy Trip xử lý Ticket, Refund và Notification. |
| AC-NFR-001 | Đạt tải/latency và không phát sinh dữ liệu trùng. |
| AC-OBS-001 | Truy vết được giao dịch qua correlation ID mà không lộ dữ liệu nhạy cảm. |

### 10.2. Acceptance Criteria cần bổ sung để phủ đủ FR

- Đăng nhập, refresh/logout và reset mật khẩu.
- Cập nhật hồ sơ và xác minh lại thông tin.
- Tìm kiếm, lọc, sắp xếp và phân trang.
- Xem Booking/Ticket của chính Customer.
- Quản lý organization, xe, tài xế, route và stop theo tenant.
- Chuyển trạng thái Trip và xem manifest.
- Promotion/voucher.
- Review và kiểm duyệt.
- Notification preference và retry.
- Tra cứu giao dịch/audit.
- Khiếu nại.
- Báo cáo tenant, timezone và export.
- Responsive, accessibility và tương thích Web/Mobile.

### 10.3. Mẫu Acceptance Criteria

| Thuộc tính | Nội dung |
|---|---|
| ID | `AC-NHOM-xxx` |
| Given | `[Tiền điều kiện và dữ liệu]` |
| When | `[Hành động/sự kiện]` |
| Then | `[Kết quả quan sát và đo được]` |
| Liên kết | `[GOAL, UC, BR, FR/NFR và Test Case]` |

### 10.4. Ma trận truy vết

| Goal | Business Process | Use Case | Business Rule | FR/NFR | Sơ đồ | Acceptance/Test Case |
|---|---|---|---|---|---|---|
| GOAL-002 | BP-01 | UC-BOOK-01 | BR-SEAT-004..005 | FR-BOOK-002..003 | FIG-ACT-01, FIG-SEQ-03, FIG-STATE-01 | AC-SEAT-001..002 |
| GOAL-002 | BP-01 | UC-PAY-01 | BR-PAY-003..006 | FR-PAY-003..007 | FIG-SEQ-04, FIG-STATE-02 | AC-PAY-001..004 |
| `[Bổ sung đầy đủ]` |  |  |  |  |  |  |

### 10.5. Kiểm tra độ phủ trước khi baseline

- Mỗi GOAL được ít nhất một BP/UC và FR/NFR hiện thực hóa.
- Mỗi Use Case có FR và AC liên quan.
- Mỗi FR/NFR MUST có ít nhất một AC/Test Case.
- Mỗi BR được dùng hoặc loại bỏ; không để rule mồ côi.
- Mỗi sơ đồ liên kết tới BP/UC/FR/State cụ thể.
- Không có FR chỉ tồn tại trong sơ đồ mà không có văn bản.

<a id="chuong-11"></a>

## 11. Phụ lục

### 11.1. Danh mục sơ đồ bắt buộc

| Loại | Mã | Số lượng |
|---|---|---:|
| Use Case Diagram | FIG-UC-01..04 | 4 |
| Activity Diagram | FIG-ACT-01..07 | 7 |
| Sequence Diagram | FIG-SEQ-01..09 | 9 |
| State Diagram | FIG-STATE-01..04 | 4 |
| Tổng |  | 24 |

### 11.2. Danh mục mã lỗi

| Mã lỗi | Trường hợp | Hành vi mong đợi |
|---|---|---|
| VALIDATION_ERROR | Dữ liệu không hợp lệ | Trả lỗi theo trường. |
| AUTHENTICATION_REQUIRED | Thiếu/hết hạn phiên | Yêu cầu đăng nhập/refresh. |
| ACCESS_DENIED | Sai role/tenant/ownership | Không tiết lộ dữ liệu ngoài scope. |
| RESOURCE_NOT_FOUND | Không tìm thấy trong scope | Trả mã chung. |
| IDEMPOTENCY_CONFLICT | Cùng key, khác payload | Không thực hiện command. |
| TRIP_NOT_SELLABLE | Trip không còn bán | Yêu cầu chọn Trip khác. |
| SEAT_UNAVAILABLE | Ghế không còn khả dụng | Trả ghế bị ảnh hưởng. |
| SEAT_HOLD_EXPIRED | SeatHold hết hạn | Yêu cầu giữ lại ghế. |
| BOOKING_EXPIRED | Booking hết hạn | Không tạo Payment mới. |
| PAYMENT_PROCESSING | Chưa có kết quả cuối | Client chờ/polling có giới hạn. |
| PAYMENT_VERIFICATION_FAILED | Webhook không hợp lệ | Không xác nhận Booking; tạo log/case. |
| CANCELLATION_NOT_ALLOWED | Không thỏa policy | Trả lý do và policy. |
| TICKET_ALREADY_CHECKED_IN | Scan lặp | Trả kết quả check-in trước đó. |
| UPSTREAM_UNAVAILABLE | Dịch vụ phụ thuộc lỗi | Thông báo thử lại phù hợp. |
| RATE_LIMITED | Vượt giới hạn | Trả thời gian thử lại. |

### 11.3. Nội dung chuyển sang tài liệu khác

| Nội dung | Tài liệu phù hợp |
|---|---|
| Danh mục Microservice, ranh giới và giao tiếp nội bộ | Software Architecture Document |
| Endpoint, request/response và schema | API/OpenAPI Specification |
| Event envelope và event schema chi tiết | Event Contract Specification |
| ERD vật lý, bảng, PK/FK và migration | Database Design Document |
| Container, Docker Compose và deployment | Deployment Guide |
| Test step và test data chi tiết | Test Plan/Test Case Specification |

### 11.4. Vấn đề cần quyết định

- Payment Gateway chính thức.
- Notification Provider chính thức.
- Chính sách hủy/đổi vé và mức phí.
- SeatHold timeout.
- Phạm vi Promotion/Review trong MVP.
- Retention và deletion policy.
- Ngưỡng hiệu năng/người dùng đồng thời được phê duyệt.
- Trình duyệt và phiên bản Mobile tối thiểu.
