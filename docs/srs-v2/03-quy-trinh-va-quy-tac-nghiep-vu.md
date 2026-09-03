# 3. Quy trình và quy tắc nghiệp vụ

[← Chương 2](./02-tong-quan-san-pham.md) · [Mục lục](./README.md) · [Chương 4 →](./04-use-cases/README.md)

## 3.1. Tổng quan các quy trình nghiệp vụ

Nền tảng bao gồm bảy quy trình nghiệp vụ chính, bao phủ hoạt động của khách hàng, nhà xe, tài xế và quản trị viên:

| ID | Quy trình | Tác nhân chính | Kết quả |
|---|---|---|---|
| `BP-01` | Tìm chuyến và đặt vé | Guest, Customer | Customer giữ được ghế, thanh toán và nhận Ticket hợp lệ. |
| `BP-02` | Hủy vé và hoàn tiền | Customer | Ticket bị hủy và Refund được xử lý theo policy. |
| `BP-03` | Đổi vé | Customer | Ticket mới thay thế Ticket cũ an toàn và chênh lệch tài chính được xử lý. |
| `BP-04` | Tạo và mở bán chuyến xe | Operator Staff | Trip có đầy đủ snapshot ghế và sẵn sàng để bán. |
| `BP-05` | Thực hiện chuyến và check-in | Driver, Operator Staff | Hành khách được check-in, Trip hoàn tất và Customer có thể đánh giá chuyến đã sử dụng. |
| `BP-06` | Hủy chuyến xe | Operator Staff, Admin | Ticket bị ảnh hưởng được vô hiệu, Refund được tạo và Customer được thông báo. |
| `BP-07` | Quản lý tài khoản, nhà xe và nền tảng | Guest, User, Operator Staff, Admin | Tài khoản, quyền, dữ liệu nhà xe, giao dịch và báo cáo được quản lý đúng phạm vi. |

Mỗi quy trình dưới đây chỉ trình bày mục tiêu, luồng nghiệp vụ tổng quát, các ngoại lệ quan trọng và Use Case tham chiếu. Tác nhân chi tiết, tiền/hậu điều kiện và các nhánh đầy đủ được đặc tả tại Chương 4; trạng thái nghiệp vụ nằm tại Chương 6 và tiêu chí nghiệm thu nằm tại Chương 10. Sơ đồ chỉ minh họa hành vi đã được quy định trong văn bản và không tạo thêm yêu cầu mới.

## 3.2. BP-01 — Tìm chuyến và đặt vé

### Mục tiêu

Giúp Customer tìm được Trip phù hợp, giữ ghế, tạo Booking, thanh toán và nhận Ticket mà không xảy ra bán trùng ghế.

### Luồng nghiệp vụ chính

| Bước | Tác nhân | Xử lý | Kết quả |
|---:|---|---|---|
| 1 | Guest/Customer | Nhập điểm đi, điểm đến, ngày đi và số hành khách để tìm kiếm. | Danh sách Trip còn khả năng bán được hiển thị. |
| 2 | Customer | Chọn Trip, xem sơ đồ ghế và chọn một hoặc nhiều ghế. | Các ghế được chọn tại client để gửi yêu cầu giữ chỗ. |
| 3 | Hệ thống | Kiểm tra lại khả năng bán và giữ toàn bộ ghế trong một thao tác nguyên tử. | SeatHold `ACTIVE` được tạo; các TripSeat chuyển sang `HELD`. |
| 4 | Customer/Hệ thống | Nhập Passenger, điểm đón/trả và Promotion nếu có; hệ thống tính lại giá và tạo Booking. | Booking `PENDING_PAYMENT` có tổng tiền chính thức được tạo từ SeatHold. |
| 5 | Customer/Payment Gateway | Customer chọn phương thức và thực hiện thanh toán. | Payment được tạo và kết quả được gửi về hệ thống. |
| 6 | Hệ thống | Xác minh provider, chữ ký, transaction ID, amount và currency. | Payment hợp lệ được ghi nhận `SUCCEEDED`. |
| 7 | Hệ thống | Cập nhật Booking, TripSeat và phát hành Ticket theo cơ chế idempotent. | Booking `PAID`, TripSeat `BOOKED` và mỗi Booking Item có một Ticket `ISSUED`. |
| 8 | Hệ thống/Notification Provider | Tạo Notification và cung cấp Ticket QR trên Web/Mobile. | Customer nhận hoặc truy cập được vé điện tử. |

### Ngoại lệ quan trọng

| STT | Tình huống | Cách xử lý |
|---:|---|---|
| 1 | Không có Trip phù hợp. | Trả danh sách rỗng; không coi là lỗi hệ thống. |
| 2 | Ghế không còn `AVAILABLE` hoặc SeatHold đã hết hạn. | Từ chối toàn bộ thao tác liên quan và giải phóng ghế hợp lệ; không giữ một phần. |
| 3 | Passenger, điểm đón/trả, Promotion hoặc idempotency key không hợp lệ. | Không tạo tác động mới; trả lỗi tương ứng và luôn dùng giá do server tính. |
| 4 | Payment chưa có kết quả cuối, webhook lặp hoặc dữ liệu xác minh không hợp lệ. | Giữ trạng thái phù hợp để truy vấn/đối soát; không xác nhận Booking hoặc tạo Ticket lặp. |
| 5 | Payment thành công trễ nhưng ghế đã thuộc Booking khác. | Không chiếm lại ghế; tạo Refund bù trừ hoặc hồ sơ xử lý thủ công. |
| 6 | Notification Provider lỗi. | Không rollback giao dịch đã hoàn tất; retry Notification theo policy. |

**Tham chiếu:** `UC-SEARCH-01`, `UC-BOOK-01..02`, `UC-PROMO-01`, `UC-PAY-01`, `UC-TICKET-01` và `UC-NOTIF-01`. Quy tắc liên quan: `BR-SEAT-*`, `BR-BOOK-*`, `BR-PAY-*` và `BR-TICKET-001`.

## 3.3. BP-02 — Hủy vé và hoàn tiền

### Mục tiêu

Thu hồi quyền sử dụng Ticket đủ điều kiện và hoàn đúng số tiền cho Customer theo policy đã được chốt khi đặt vé.

### Luồng nghiệp vụ chính

| Bước | Tác nhân | Xử lý | Kết quả |
|---:|---|---|---|
| 1 | Customer | Chọn một hoặc nhiều Ticket/Booking Item muốn hủy. | Yêu cầu xem trước việc hủy được tạo. |
| 2 | Hệ thống | Kiểm tra ownership, trạng thái, giờ khởi hành và policy snapshot; tính phí và số tiền hoàn. | Preview hủy vé được hiển thị mà chưa thay đổi trạng thái. |
| 3 | Customer | Xác nhận preview còn hiệu lực bằng command có idempotency key. | Yêu cầu hủy chính thức được gửi. |
| 4 | Hệ thống | Kiểm tra lại điều kiện, chuyển Ticket sang `CANCELLED` và mở lại ghế nếu Trip còn bán. | Quyền sử dụng Ticket bị thu hồi; TripSeat trở về `AVAILABLE` khi phù hợp. |
| 5 | Hệ thống/Payment Gateway | Tạo và xử lý Refund nếu số tiền hoàn lớn hơn 0. | Refund được theo dõi đến trạng thái cuối hoặc trạng thái cần retry. |
| 6 | Hệ thống/Notification Provider | Gửi trạng thái Ticket và Refund. | Customer được thông báo về kết quả xử lý. |

### Ngoại lệ quan trọng

| STT | Tình huống | Cách xử lý |
|---:|---|---|
| 1 | Ticket không thuộc Customer hoặc không đủ điều kiện hủy. | Từ chối và giữ nguyên dữ liệu; trả lý do/policy liên quan. |
| 2 | Preview đã cũ hoặc số tiền thay đổi. | Tính lại và yêu cầu Customer xác nhận lại. |
| 3 | Payment Gateway timeout hoặc Refund `FAILED`. | Giữ Ticket `CANCELLED`; retry Refund hoặc chuyển xử lý thủ công. |
| 4 | Command lặp hoặc tổng Refund có nguy cơ vượt Payment thành công. | Trả cùng kết quả đối với command lặp; từ chối khoản hoàn vượt mức và tạo cảnh báo đối soát. |
| 5 | Notification Provider lỗi. | Không rollback việc hủy/hoàn tiền; retry thông báo độc lập. |

**Tham chiếu:** `UC-CANCEL-01` và `UC-NOTIF-01`. Quy tắc liên quan: `BR-CANCEL-*` và `BR-PAY-007..010`.

## 3.4. BP-03 — Đổi vé

### Mục tiêu

Chuyển Passenger sang Trip/ghế mới theo policy mà không làm mất Ticket cũ nếu quy trình đổi vé thất bại. Đây là chức năng mức `SHOULD`.

### Luồng nghiệp vụ chính

| Bước | Tác nhân | Xử lý | Kết quả |
|---:|---|---|---|
| 1 | Customer/Hệ thống | Customer chọn Ticket; hệ thống kiểm tra ownership, trạng thái, thời gian và policy đổi vé. | Điều kiện đổi vé được xác định. |
| 2 | Customer/Hệ thống | Customer chọn Trip/ghế mới; hệ thống giữ ghế mới trước khi tác động Ticket cũ. | SeatHold mới được tạo an toàn. |
| 3 | Hệ thống | Tính phí đổi và chênh lệch giữa giá cũ với giá mới. | Phương án tài chính được hiển thị để Customer xác nhận. |
| 4 | Customer/Payment Gateway | Thanh toán bổ sung hoặc tiếp nhận Refund phần chênh lệch theo policy. | Điều kiện tài chính được xử lý. |
| 5 | Hệ thống | Phát hành Ticket mới và hủy Ticket cũ bằng thao tác nhất quán hoặc saga được kiểm soát. | Ticket mới `ISSUED`; Ticket cũ `CANCELLED`. |
| 6 | Hệ thống/Notification Provider | Giải phóng ghế cũ nếu còn được bán lại và gửi Notification. | Inventory được cập nhật và Customer nhận kết quả đổi vé. |

### Ngoại lệ quan trọng

| STT | Tình huống | Cách xử lý |
|---:|---|---|
| 1 | Không giữ được ghế mới hoặc SeatHold mới hết hạn. | Không tác động Ticket cũ; yêu cầu Customer chọn lại. |
| 2 | Payment bổ sung thất bại. | Giải phóng hold mới và giữ nguyên hiệu lực Ticket cũ. |
| 3 | Đã thu thêm tiền nhưng không phát hành được Ticket mới. | Hoàn khoản thu bổ sung hoặc tạo manual case; không hủy Ticket cũ trước điểm commit. |
| 4 | Ticket mới đã phát hành nhưng Ticket cũ chưa hủy được. | Chạy quy trình phục hồi có audit; không để hai Ticket cùng có hiệu lực ngoài policy. |
| 5 | Command được gửi lặp. | Trả kết quả đổi vé hiện có; không tạo thêm Ticket, Payment hoặc Refund. |

**Tham chiếu:** `UC-CHANGE-01` và `UC-NOTIF-01`. Quy tắc liên quan: `BR-CANCEL-001..002`, `BR-CANCEL-005..007` và `BR-PAY-*`.

## 3.5. BP-04 — Tạo và mở bán chuyến xe

### Mục tiêu

Cho phép Operator Staff tạo một Trip hợp lệ, chốt dữ liệu cần thiết và chuẩn bị đầy đủ TripSeat trước khi mở bán.

### Luồng nghiệp vụ chính

| Bước | Tác nhân | Xử lý | Kết quả |
|---:|---|---|---|
| 1 | Operator Staff | Tạo Trip nháp; chọn Route, Bus, Driver, thời gian, fare và policy. | Thông tin Trip được nhập để kiểm tra. |
| 2 | Hệ thống | Kiểm tra tenant, dữ liệu bắt buộc, trạng thái Bus/Driver và giấy phép tài xế. | Tính hợp lệ của dữ liệu được xác định. |
| 3 | Hệ thống | Kiểm tra xung đột lịch Bus/Driver, bao gồm khoảng đệm cấu hình. | Bus và Driver được xác nhận có thể phân công. |
| 4 | Operator Staff | Xem thông tin tổng hợp và xác nhận mở bán. | Yêu cầu mở bán Trip được gửi. |
| 5 | Hệ thống quản lý Trip | Chuyển Trip sang `SCHEDULED` và chốt snapshot lịch trình, giá, policy, sơ đồ ghế. | Trip và snapshot được công bố. |
| 6 | Hệ thống Booking | Tạo đầy đủ TripSeat từ snapshot trước khi đánh dấu Trip có thể bán. | Trip xuất hiện trong tìm kiếm và có thể được đặt vé. |

### Ngoại lệ quan trọng

| STT | Tình huống | Cách xử lý |
|---:|---|---|
| 1 | Bus/Driver không hoạt động, giấy phép không hợp lệ hoặc thuộc tenant khác. | Từ chối mở bán Trip. |
| 2 | Bus/Driver có lịch chồng lấn. | Từ chối và trả thông tin xung đột trong phạm vi actor được phép xem. |
| 3 | Thời gian hoặc dữ liệu bắt buộc không hợp lệ. | Trả validation error và giữ Trip ở dạng nháp. |
| 4 | Tạo TripSeat thất bại hoặc yêu cầu mở bán bị gửi lặp. | Chưa mở bán Trip; retry an toàn và không tạo snapshot/inventory trùng. |

**Tham chiếu:** `UC-OPS-05`. Quy tắc liên quan: `BR-TRIP-001..002`, `BR-SEAT-010` và `BR-TENANT-*`. Sơ đồ: [Sequence publish Trip](../diagrams/subdiagrams/sequences/sequence-publish-trip.html).

## 3.6. BP-05 — Thực hiện chuyến và check-in

### Mục tiêu

Cho phép Driver/Operator Staff xem đúng dữ liệu vận hành, xác nhận hành khách lên đúng chuyến và cập nhật Trip theo vòng đời được quy định.

### Luồng nghiệp vụ chính

| Bước | Tác nhân | Xử lý | Kết quả |
|---:|---|---|---|
| 1 | Driver/Operator Staff | Chọn Trip được phân công hoặc thuộc tenant được phép. | Trip cần vận hành được lựa chọn. |
| 2 | Hệ thống | Kiểm tra tenant/assignment và tải manifest với lượng PII tối thiểu. | Danh sách hành khách đúng phạm vi được hiển thị. |
| 3 | Customer/Driver | Customer xuất trình QR/mã Ticket; Driver hoặc Operator Staff quét hay nhập mã. | Ticket được gửi để kiểm tra. |
| 4 | Hệ thống | Xác minh code, quyền actor, Trip và Ticket state; cập nhật Ticket hợp lệ. | Ticket chuyển `ISSUED → CHECKED_IN` đúng một lần và có audit. |
| 5 | Driver/Operator Staff | Thực hiện các hành động chuyển trạng thái Trip theo quyền. | Trip lần lượt chuyển qua `BOARDING → DEPARTED → IN_TRANSIT → ARRIVED → COMPLETED`. |
| 6 | Hệ thống | Hoàn tất Trip và cập nhật dữ liệu liên quan. | Ticket đã check-in chuyển `USED`; dữ liệu báo cáo được cập nhật. |
| 7 | Customer/Admin/Operator Staff | Customer tạo Review cho Ticket `USED`; actor có quyền kiểm duyệt khi cần. | Review được tạo tối đa một lần; thao tác kiểm duyệt giữ lịch sử và audit. |

### Ngoại lệ quan trọng

| STT | Tình huống | Cách xử lý |
|---:|---|---|
| 1 | Driver không được phân công hoặc Operator Staff không đủ quyền. | Từ chối truy cập manifest và không trả PII. |
| 2 | QR/code không hợp lệ, sai Trip hoặc Ticket không ở trạng thái `ISSUED`. | Từ chối check-in và giữ nguyên Ticket. |
| 3 | Ticket đã `CHECKED_IN`. | Trả kết quả/thời điểm check-in trước đó; không tạo transition thứ hai. |
| 4 | Chuyển Trip sai thứ tự hoặc xung đột version. | Giữ nguyên trạng thái; trả lỗi và yêu cầu tải lại dữ liệu khi cần. |
| 5 | Client mất kết nối hoặc projection cập nhật chậm. | Không tự xác nhận check-in; hiển thị thời điểm dữ liệu gần nhất và đồng bộ lại theo policy. |
| 6 | Ticket không đủ điều kiện Review hoặc actor kiểm duyệt thiếu quyền/reason. | Từ chối thao tác và giữ nguyên dữ liệu Review. |

**Tham chiếu:** `UC-OPS-06`, `UC-DRIVER-01` và `UC-REVIEW-01..02`. Quy tắc liên quan: `BR-TICKET-*`, `BR-REVIEW-*`, `BR-TRIP-003` và `AUTHZ-005..007`.

## 3.7. BP-06 — Hủy chuyến xe

### Mục tiêu

Dừng một Trip hợp lệ, vô hiệu Ticket bị ảnh hưởng và khởi tạo Refund an toàn mà không để lại trạng thái hủy một phần không được kiểm soát.

### Luồng nghiệp vụ chính

| Bước | Tác nhân | Xử lý | Kết quả |
|---:|---|---|---|
| 1 | Operator Staff/Admin | Chọn Trip, nhập lý do và xem số Booking/Ticket/Payment có thể bị ảnh hưởng. | Phạm vi ảnh hưởng được hiển thị trước xác nhận. |
| 2 | Operator Staff/Admin | Xác nhận yêu cầu hủy bằng command có idempotency key. | Yêu cầu hủy chính thức được gửi. |
| 3 | Hệ thống | Kiểm tra quyền, tenant, Trip state và version; chuyển Trip sang `CANCELLED` và ghi audit. | Trip bị hủy đúng một lần. |
| 4 | Hệ thống | Xác định các Booking/Ticket bị ảnh hưởng và vô hiệu quyền sử dụng Ticket. | Ticket của Trip không còn sử dụng được. |
| 5 | Hệ thống/Payment Gateway | Tạo và xử lý Refund theo policy hủy bởi nhà xe, không áp dụng phí hủy của Customer. | Các khoản đủ điều kiện được đưa vào luồng hoàn tiền. |
| 6 | Hệ thống/Notification Provider | Gửi Notification; cập nhật báo cáo/đối soát và theo dõi trường hợp chưa hoàn tất. | Customer được thông báo; lỗi được retry hoặc chuyển xử lý thủ công. |

### Ngoại lệ quan trọng

| STT | Tình huống | Cách xử lý |
|---:|---|---|
| 1 | Yêu cầu hủy được gửi lặp. | Trả cùng logical cancellation; không hủy hoặc tạo Refund lần thứ hai. |
| 2 | Trip đã `DEPARTED`. | Từ chối theo luồng thông thường hoặc yêu cầu policy/quyền đặc biệt đã phê duyệt. |
| 3 | Xử lý nhiều Booking bị gián đoạn. | Tiếp tục từ checkpoint; xử lý mỗi Booking/Refund theo cơ chế idempotent. |
| 4 | Refund hoặc Notification bị lỗi. | Không khôi phục Trip/Ticket; retry độc lập hoặc chuyển manual case. |
| 5 | Actor không đủ quyền hoặc Trip ngoài tenant. | Từ chối và không tiết lộ dữ liệu ngoài phạm vi. |

**Tham chiếu:** `UC-TRIP-01` và `UC-NOTIF-01`. Quy tắc liên quan: `BR-TRIP-004..006`, `BR-CANCEL-008` và `BR-PAY-007..008`.

## 3.8. BP-07 — Quản lý tài khoản, nhà xe và nền tảng

### Mục tiêu

Quản lý vòng đời tài khoản, quyền truy cập, dữ liệu nhà xe và hoạt động quản trị/báo cáo trong đúng phạm vi ownership, tenant và permission.

### Luồng nghiệp vụ chính

Các nhóm bên dưới là những luồng quản lý độc lập thuộc cùng phạm vi BP-07, không phải các bước bắt buộc diễn ra tuần tự.

| Nhóm nghiệp vụ | Tác nhân | Xử lý chính | Kết quả |
|---|---|---|---|
| Đăng ký và xác minh | Guest, Notification Provider | Kiểm tra dữ liệu, tạo tài khoản chờ xác minh và gửi OTP/link có thời hạn. | User được kích hoạt sau khi xác minh thành công. |
| Phiên, hồ sơ và thông báo | User/Customer | Đăng nhập, refresh/logout, reset mật khẩu, cập nhật hồ sơ và cấu hình kênh thông báo. | Phiên và hồ sơ đúng trạng thái; thay đổi định danh được xác minh lại khi cần. |
| Organization và phân quyền | Admin | Tạo/phê duyệt Organization; quản lý User, role, membership và trạng thái tài khoản. | User có đúng quyền trong đúng Organization; thay đổi nhạy cảm có audit và thu hồi phiên khi cần. |
| Dữ liệu nhà xe | Operator Staff | Quản lý Organization, Bus, sơ đồ ghế, DriverProfile, Route và Stop theo permission. | Dữ liệu chỉ thay đổi trong tenant; bản ghi đã tham chiếu và snapshot lịch sử được bảo toàn. |
| Quản trị nội dung và hỗ trợ | Admin/Operator Staff | Quản lý Promotion, kiểm duyệt Review và xử lý khiếu nại trong phạm vi được cấp. | Thay đổi được kiểm soát và giữ lịch sử/audit. |
| Tra cứu và báo cáo | Admin/Operator Finance | Tra cứu Booking, Ticket, Payment, Refund, audit; xem và xuất báo cáo. | Dữ liệu đúng phạm vi được hiển thị; export lớn chạy bất đồng bộ và được kiểm tra lại quyền khi tải. |

### Ngoại lệ quan trọng

| STT | Tình huống | Cách xử lý |
|---:|---|---|
| 1 | Định danh trùng, OTP/token không hợp lệ hoặc đăng nhập sai quá ngưỡng. | Không tạo tài khoản/phiên trái phép; áp dụng rate limit, khóa tạm và audit theo policy. |
| 2 | Actor không đủ quyền, membership không hoạt động hoặc cố truy cập tenant khác. | Từ chối mà không tiết lộ dữ liệu ngoài scope. |
| 3 | User/Bus/Seat/Driver/Route đã được tham chiếu hoặc có xung đột version. | Không hard delete hay ghi đè âm thầm; deactivate/soft delete hoặc yêu cầu tải lại dữ liệu. |
| 4 | Notification Provider lỗi trong luồng xác minh/reset. | Giữ trạng thái phù hợp, cho phép gửi lại và không kích hoạt/thay đổi mật khẩu âm thầm. |
| 5 | Projection chậm hoặc actor mất quyền trước khi tải export. | Hiển thị thời điểm dữ liệu gần nhất; kiểm tra lại quyền và từ chối tải khi không còn hợp lệ. |

**Tham chiếu:** `UC-AUTH-01..04`, `UC-PROFILE-01`, `UC-OPS-01..04`, `UC-PROMO-01`, `UC-REVIEW-02`, `UC-NOTIF-01`, `UC-ADMIN-01..03` và `UC-REPORT-01`. Quy tắc liên quan: `AUTHZ-*`, `BR-TENANT-*`, `BR-DATA-*` và `BR-AUDIT-*`.

## 3.9. Yêu cầu authorization

| ID | Yêu cầu |
|---|---|
| AUTHZ-001 | Mọi endpoint không public phải xác thực phiên/access token hợp lệ. |
| AUTHZ-002 | Thành phần xử lý nghiệp vụ phải tự kiểm tra quyền; không chỉ dựa vào Gateway hoặc việc client ẩn nút. |
| AUTHZ-003 | Truy vấn tenant phải ràng buộc bằng organization ID từ identity context, không tin giá trị trong request body. |
| AUTHZ-004 | Customer chỉ xem/sửa Booking và Ticket thuộc customer ID của mình. |
| AUTHZ-005 | Driver chỉ truy cập Trip có assignment còn hiệu lực. |
| AUTHZ-006 | Thay đổi role, khóa User hoặc can thiệp Payment/Refund phải tạo audit event. |
| AUTHZ-007 | Manifest chỉ cung cấp PII tối thiểu cần cho vận hành. |
| AUTHZ-008 | Giao tiếp service-to-service phải có danh tính/credential riêng, không dùng token Admin. |

## 3.10. Quy tắc ghế và SeatHold

| ID | Quy tắc |
|---|---|
| BR-SEAT-001 | Tính duy nhất của ghế bán áp dụng trên `(tripId, seatId)` hoặc định danh TripSeat tương đương. |
| BR-SEAT-002 | SELECTED là trạng thái cục bộ tại client, không phải trạng thái TripSeat phía server. |
| BR-SEAT-003 | TripSeat chỉ dùng các trạng thái được định nghĩa tại chương trạng thái. |
| BR-SEAT-004 | Một TripSeat có tối đa một SeatHold ACTIVE hoặc một Ticket còn hiệu lực. |
| BR-SEAT-005 | Giữ nhiều ghế phải thành công toàn bộ hoặc thất bại toàn bộ. |
| BR-SEAT-006 | SeatHold hết hạn theo timeout cấu hình; thời điểm chính xác được trả bằng `expiresAt`. |
| BR-SEAT-007 | Request lặp cùng idempotency key và payload trả lại cùng logical hold. |
| BR-SEAT-008 | Hold hết hạn được giải phóng chủ động và cũng được kiểm tra lại khi có request kế tiếp. |
| BR-SEAT-009 | Cache/TTL có thể hỗ trợ hiệu năng nhưng ràng buộc giao dịch bền vững là nguồn chống double-book. |
| BR-SEAT-010 | Sơ đồ ghế của Trip đã publish là snapshot; thay đổi Bus template không tự đổi TripSeat. |

## 3.11. Quy tắc Booking và giá

| ID | Quy tắc |
|---|---|
| BR-BOOK-001 | Chỉ Customer đã xác thực mới tạo SeatHold và Booking. |
| BR-BOOK-002 | Một SeatHold chỉ được consume bởi tối đa một Booking. |
| BR-BOOK-003 | Mỗi ghế trong Booking có đúng một Passenger và sau thanh toán có đúng một Ticket. |
| BR-BOOK-004 | Giá được tính tại server từ fare, fee, discount và policy snapshot; giá client chỉ mang tính tham khảo. |
| BR-BOOK-005 | Booking lưu đầy đủ subtotal, discount, fee, total, currency và phiên bản policy tại thời điểm xác nhận. |
| BR-BOOK-006 | Tiền VND dùng số nguyên đồng hoặc decimal chính xác; không dùng float/double. |
| BR-BOOK-007 | Booking PENDING_PAYMENT quá hạn mà chưa có Payment hợp lệ chuyển EXPIRED. |
| BR-BOOK-008 | Booking PAID không sửa trực tiếp Passenger/TripSeat; thay đổi phải qua quy trình đổi vé. |
| BR-BOOK-009 | Không cho đặt Trip đã DEPARTED hoặc trạng thái sau đó. |
| BR-BOOK-010 | Tạo Booking phải có idempotency key; cùng key và payload trả cùng Booking, khác payload trả conflict. |

## 3.12. Quy tắc Payment và Refund

| ID | Quy tắc |
|---|---|
| BR-PAY-001 | Chỉ miền Payment giao tiếp với Payment Gateway và sở hữu trạng thái Payment/Refund. |
| BR-PAY-002 | Booking chỉ chuyển PAID sau kết quả Payment thành công đã được xác minh. |
| BR-PAY-003 | Provider transaction/event ID phải duy nhất; webhook lặp không tạo tác động lần hai. |
| BR-PAY-004 | Amount và currency phải khớp Payment intent; mismatch không được xác nhận Booking. |
| BR-PAY-005 | Callback không có chữ ký hợp lệ bị từ chối và ghi security log an toàn. |
| BR-PAY-006 | Payment thành công trễ không được chiếm ghế đã bán; phải bù trừ hoặc xử lý thủ công. |
| BR-PAY-007 | Tổng Refund thành công không vượt Payment amount thành công. |
| BR-PAY-008 | Refund có reason, nguồn yêu cầu và idempotency key. |
| BR-PAY-009 | Không lưu PAN/CVV; chỉ lưu token/mã tham chiếu cần thiết. |
| BR-PAY-010 | Client redirect không phải bằng chứng thanh toán; webhook/reconciliation mới là nguồn xác nhận. |

## 3.13. Quy tắc hủy và đổi vé

| ID | Quy tắc |
|---|---|
| BR-CANCEL-001 | Policy hủy/đổi được snapshot vào Booking/Ticket. |
| BR-CANCEL-002 | Hiển thị phí và số tiền hoàn trước xác nhận cuối. |
| BR-CANCEL-003 | Ticket CHECKED_IN, USED, CANCELLED hoặc REFUNDED không được Customer hủy. |
| BR-CANCEL-004 | Customer không được hủy sau giờ khởi hành; can thiệp đặc biệt phải có quyền và audit. |
| BR-CANCEL-005 | Ghế chỉ trở lại AVAILABLE khi hủy có hiệu lực và Trip còn cho phép bán. |
| BR-CANCEL-006 | Đổi vé phải giữ được ghế mới trước khi hủy quyền trên ghế cũ. |
| BR-CANCEL-007 | Đổi vé thất bại phải giữ nguyên vé cũ hoặc chạy compensation rõ ràng. |
| BR-CANCEL-008 | Trip bị nhà xe hủy tạo Refund theo policy nhà xe, không áp phí hủy Customer. |

## 3.14. Quy tắc Trip và vận hành

| ID | Quy tắc |
|---|---|
| BR-TRIP-001 | Chỉ Trip đủ Route, Bus, Driver, schedule, fare, policy và seat snapshot mới được mở bán. |
| BR-TRIP-002 | Cùng Bus hoặc Driver không có assignment chồng lấn, gồm buffer cấu hình. |
| BR-TRIP-003 | Driver chỉ cập nhật Trip được phân công và theo chuyển trạng thái cho phép. |
| BR-TRIP-004 | Trip có Booking/Ticket không được hard delete; chỉ được cancel. |
| BR-TRIP-005 | Thay đổi lịch/điểm sau khi bán vé phải tạo thông báo cho Customer bị ảnh hưởng. |
| BR-TRIP-006 | Trip cancellation phải idempotent và tạo đúng một logical cancellation. |

## 3.15. Quy tắc Ticket, Review, Tenant, dữ liệu và audit

| ID | Quy tắc |
|---|---|
| BR-TICKET-001 | Ticket có public code khó đoán và QR token có chữ ký hoặc đủ ngẫu nhiên. |
| BR-TICKET-002 | Check-in chỉ hợp lệ cho đúng Trip và Ticket ISSUED. |
| BR-TICKET-003 | Scan lặp trả kết quả đã check-in, không tạo check-in thứ hai. |
| BR-TICKET-004 | Ticket đã check-in chuyển USED khi Trip hoàn tất theo policy. |
| BR-REVIEW-001 | Một Ticket USED được tạo tối đa một Review bởi Customer sở hữu. |
| BR-REVIEW-002 | Ẩn Review không xóa lịch sử; lưu moderator, reason và timestamp. |
| BR-TENANT-001 | Dữ liệu Operator phải có organization ownership hoặc nguồn ownership tương đương. |
| BR-TENANT-002 | Operator không được truyền organization tùy ý để vượt tenant scope. |
| BR-DATA-001 | ID nghiệp vụ không xung đột giữa các miền/thành phần. |
| BR-DATA-002 | Timestamp lưu và trao đổi theo quy ước thời gian thống nhất, có timezone khi qua API. |
| BR-DATA-003 | Entity giao dịch có createdAt, updatedAt và concurrency token khi cần. |
| BR-DATA-004 | User/xe/tài xế/tuyến đã được tham chiếu phải deactivate hoặc soft delete. |
| BR-AUDIT-001 | Thay đổi role, tenant, Trip, giá/policy, Booking override, Payment/Refund và check-in phải audit. |
| BR-AUDIT-002 | Audit record là append-only đối với actor thông thường. |

[← Chương 2](./02-tong-quan-san-pham.md) · [Mục lục](./README.md) · [Chương 4 →](./04-use-cases/README.md)
