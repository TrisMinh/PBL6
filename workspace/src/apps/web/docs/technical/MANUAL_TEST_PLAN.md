# Kịch bản kiểm thử thủ công FE + BE

Ngày lập: **01/11/2026**, múi giờ **Asia/Ho_Chi_Minh**. Phạm vi: web tại `workspace/src/apps/web` và các API đang được gateway cung cấp. Không bao gồm kiểm thử native mobile, hạ tầng production hoặc chứng nhận cổng thanh toán thật.

**Đây là kế hoạch để bạn thực hiện, không phải báo cáo mọi case đã PASS.** Mỗi dòng ghi `PASS`, `FAIL`, `BLOCKED` hoặc `NOT_RUN` vào sổ kết quả ở cuối file. Case chưa có nút/trang tương ứng ghi `BLOCKED_FE`; nếu cần có thể kiểm tra API riêng, nhưng không coi FE đã PASS.

## 1. Chuẩn bị

### Địa chỉ và khởi động

| Thành phần | Địa chỉ |
| --- | --- |
| FE | http://localhost:5173 |
| Gateway BE | http://localhost:5080 |
| Gateway readiness | http://localhost:5080/ready |
| Hộp thư local Mailpit | http://localhost:8025 |
| Payment simulator | http://localhost:8099; nên mở bằng nút thanh toán trên FE để có giao dịch hợp lệ |

Nếu các dịch vụ chưa chạy, mở PowerShell:

```powershell
cd D:\Project\PBL6\workspace\src\infra
$dockerExe = 'C:\Users\ADMIN\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe'
& $dockerExe compose -f docker-compose.yml -f docker-compose.apps.yml up -d --wait gateway mailpit payment-simulator redis
& $dockerExe compose -f docker-compose.yml -f docker-compose.apps.yml ps
```

Mở terminal khác nếu FE chưa chạy:

```powershell
cd D:\Project\PBL6\workspace\src\apps\web
$env:VITE_API_MODE = 'live'
$env:VITE_API_BASE_URL = ''
$env:API_PROXY_TARGET = 'http://localhost:5080'
npm.cmd run dev -- --host 0.0.0.0 --port 5173 --strictPort
```

Không bật `VITE_API_MODE=mock` khi kiểm thử BE. Mở F12 → Network → Fetch/XHR → Preserve log; trong Console giữ lại lỗi đỏ. Request đi qua proxy có thể hiện URL `localhost:5173/api/v1/...`, điều này bình thường. Ở các bảng dưới, API được viết ngắn, mặc định thêm tiền tố **`/api/v1`**. `/ready`, `/integrations/...`, `/internal/...` không có tiền tố đó.

### Tài khoản và dữ liệu

Mật khẩu **mọi tài khoản `@demo.test`** dưới đây: **`OperatorPass1`**.

| Ký hiệu | Tài khoản | Mục đích |
| --- | --- | --- |
| CB / CC | `customer.b@demo.test` / `customer.c@demo.test` | Hai khách độc lập |
| OB / OC | `operator.b@demo.test` / `operator.c@demo.test` | Hai nhà xe độc lập |
| FB | `operator_finance.b@demo.test` | Kế toán nhà xe B |
| SB | `operator_scheduler.b@demo.test` | Xếp lịch nhà xe B |
| VB | `operator_operations.b@demo.test` | Vận hành nhà xe B |
| DB | `driver.b@demo.test` | Tài xế được phân công |
| PF | `platform_finance@demo.test` | Kế toán nền tảng |
| EMPTY | `empty.customer@demo.test` | Khách chưa có dữ liệu |
| BAD | `disabled@demo.test`, `locked@demo.test`, `pending_verification@demo.test` | Trạng thái đăng nhập không hợp lệ |
| ADMIN | `admin.seed@example.test` / **`AdminPass1234`** | Admin nền tảng; dùng mật khẩu riêng này |

Các tài khoản support, auditor, tài xế hết hạn/đình chỉ và nhà xe C có vai trò tương tự được liệt kê đầy đủ ở [EXPANDED_DEMO_DATA.md](./EXPANDED_DEMO_DATA.md).

| Dữ liệu | Dùng ở đâu |
| --- | --- |
| Đà Nẵng → Huế, **15/11/2026** | 111 chuyến đang bán lúc seed, thử >100 kết quả, lọc và phân trang |
| Đà Nẵng → Huế, **03–08/11/2026** | Chuyến cơ bản, Lăng Cô là điểm trung gian |
| Đà Nẵng → Huế, **04/11/2026**, chọn BLUE Demo B | Chuyến BOARDING, cho phép trả sau, có phân công tài xế |
| Huế → Đà Nẵng, **16/11/2026** | Chiều ngược lại |
| TP.HCM → Đà Lạt, **17/11/2026** | Tuyến khác |
| Hà Nội → Sa Pa, **18/11/2026** | Tuyến khác |
| Đà Nẵng → TP.HCM, **19/11/2026** | Một điểm đi có nhiều điểm đến |
| `XB-FAMILY-1`, `XB-FAMILY-2` | 3 hành khách, lần lượt trả trước / trả sau |
| `XB-EDGE-1` | Đã hoàn 40%; còn 60% để thử giới hạn hoàn |
| `XB-EDGE-2` … `XB-EDGE-5` | Hoàn REQUESTED / PROCESSING / FAILED và booking REFUND_PENDING |
| `XC-...` | Cùng loại dữ liệu, nhưng thuộc khách/nhà xe C |

Số lượng chỉ là mốc lúc tạo; sau thao tác hủy/đặt thêm sẽ thay đổi. Pending và hold active seed **tự hết hạn sau khoảng 10 phút**: tạo đơn/hold mới cho case cần pending, không coi mẫu cũ hết hạn là lỗi.

ID chính xác đọc trong `workspace/src/apps/web/tmp/expanded-demo/manifest.json`. URL chi tiết live dùng **UUID** từ response, không thay bằng mã hiển thị `XB-...`.

### Cách tổ chức một lượt test

1. Dùng ba cửa sổ trình duyệt/profile riêng cho CB, CC và OB; session lưu theo cửa sổ/tab, không giả định hai tab luôn chia sẻ đăng nhập.
2. Đặt mã dữ liệu tự tạo dạng `QA-1101-01`, `QA-1101-02` để tìm lại. Tạo tài khoản/xe/tuyến riêng cho case sửa, vô hiệu hóa và hủy; không khóa tài khoản admin duy nhất.
3. Thử các case đọc trước, sau đó tạo/sửa, cuối cùng hủy/hoàn tiền/phân quyền. Một vé dùng để check-in không dùng tiếp cho case hủy vé chưa sử dụng.
4. Ghi lại `tripId`, `seatId`, `bookingId`, `ticketId`, `paymentId`, `refundId` của luồng **mới tạo**. `seatId` đặt vé là ID inventory của chuyến, không phải ID seat template của xe.
5. Xem API trong Network: request body, HTTP status, response và `correlationId` khi lỗi. Chụp màn hình cả UI và response, không chia sẻ access/refresh token.

## 2. Chạy nhanh luồng hoàn chỉnh trước

### Luồng A — đặt trả trước → thanh toán → phát vé → check-in

1. CB tìm Đà Nẵng → Huế ngày 04/11, chọn BLUE Demo B và một ghế AVAILABLE.
2. Nhập thông tin liên hệ hợp lệ, tên hành khách; ở trang review chọn điểm đón Lăng Cô, điểm trả Huế, kênh **trực tuyến**.
3. Xác nhận. Trong Network phải thấy tạo hold rồi tạo booking. Ghi lại booking UUID và tổng tiền. Đơn ban đầu `PENDING_PAYMENT`.
4. Thanh toán → simulator → **Thanh toán thành công**. FE trở về, kiểm tra trạng thái bằng BE. Sau khi event được xử lý, đơn `PAID`, vé `ISSUED`, ghế thuộc đơn.
5. `/account/tickets`: có đúng vé, tên và ghế. F5 vẫn còn. Không chỉ nhìn lời báo thành công ở trang redirect.
6. OB mở `/operator/bookings/trips/{tripId}/passengers`, nhập public code vé → kiểm tra → check-in. Vé chuyển `CHECKED_IN`; manifest và tài khoản khách phản ánh trạng thái mới.
7. Check-in lại phải bị từ chối về nghiệp vụ, không ghi nhận lên xe lần hai.

### Luồng B — trả sau

1. Dùng ghế khác trên chuyến có `allowPayLater=true`, chọn **thanh toán sau**.
2. Xác nhận → đơn `CONFIRMED`, vé được phát, không mở VNPay.
3. Đối soát là `PAY_LATER`, không có payment capture giả và hoa hồng thu online bằng 0 theo mô hình BE hiện tại.

### Luồng C — hủy và hoàn tiền

1. Tạo một đơn trả trước mới, thanh toán thành công; **chưa check-in**.
2. Mở vé → chính sách hủy → chọn vé → lấy preview. Ghi `fee`, `refundAmount`, `previewId`.
3. Nhập lý do → xác nhận hủy. Ghế được nhả theo kết quả BE; vé hết hiệu lực. Theo dõi trạng thái booking, refund và đối soát tới khi nhất quán.
4. Nếu booking vào `REFUND_PENDING` nhưng không có tiến trình hoàn tiếp, ghi rõ `BLOCKED`/`FAIL` theo API thực tế; không bấm tạo refund lặp để tự coi luồng đã PASS. Kiểm tra riêng chức năng hoàn tiền thủ công ở phần 8.

Chỉ chuyển sang test diện rộng sau khi lưu kết quả ba luồng này. Các bảng dưới là checklist chi tiết; `P0` là tính đúng tiền/ghế/quyền, `P1` là nghiệp vụ chính, `P2` là trải nghiệm/phụ trợ.

## 3. Môi trường, đăng nhập và hồ sơ

| ID | Ưu tiên | Thao tác FE / chuẩn bị | API đối chiếu | Kết quả cần kiểm tra | K?t qu? |
| --- | --- | --- | --- | --- | --- |
| ENV-01 | P0 | Mở FE và readiness | `GET /ready` | 200, không có 503 ở các API chính; backend không healthy thì ghi BLOCKED_ENV | NOT_RUN |
| ENV-02 | P0 | F5 trang tài khoản đã đăng nhập | `GET /users/me`, `GET /tickets` | Dữ liệu BE thật; không xuất hiện fixture mock khác tài khoản | NOT_RUN |
| AUTH-01 | P0 | CB đăng nhập đúng thông tin | `POST /auth/login` | 200, có session hợp lệ, truy cập được dữ liệu riêng | NOT_RUN |
| AUTH-02 | P1 | Nhập sai mật khẩu một lần | `POST /auth/login` | Không đăng nhập; lỗi rõ ràng, không tiết lộ dữ liệu tài khoản | NOT_RUN |
| AUTH-03 | P1 | Thử lần lượt ba tài khoản BAD | `POST /auth/login` | Bị từ chối theo trạng thái, không nhận access token hợp lệ | NOT_RUN |
| AUTH-04 | P1 | Bỏ trống email/mật khẩu, email sai định dạng | Login | FE báo lỗi; nếu gửi trực tiếp BE cũng từ chối input sai | NOT_RUN |
| AUTH-05 | P1 | Đăng ký email và số điện thoại QA mới | `POST /auth/register` | 202, có challenge; chưa coi là tài khoản active trước xác minh | NOT_RUN |
| AUTH-06 | P1 | Lấy mã trong Mailpit, xác minh | `POST /auth/verify` | Mã đúng thành công; mã sai/hết hạn không kích hoạt tài khoản | NOT_RUN |
| AUTH-07 | P2 | Gửi lại mã xác minh | `POST /auth/resend-verification` | Có phản hồi phù hợp, không tạo tài khoản trùng; kiểm tra mã mới/giới hạn gửi | NOT_RUN |
| AUTH-08 | P1 | Đăng ký lại cùng email hoặc cùng số điện thoại | `POST /auth/register` | Không tạo hai user trùng; thông báo nghiệp vụ, không lỗi 500 | NOT_RUN |
| AUTH-09 | P1 | Quên mật khẩu trên tài khoản QA | `POST /auth/forgot-password` | 202; thư/mã tới Mailpit nếu pipeline mail hoạt động | NOT_RUN |
| AUTH-10 | P1 | Đổi mật khẩu bằng challenge/code nhận được | `POST /auth/reset-password` | Mật khẩu mới đăng nhập được; mã sai, dùng lại hoặc hết hạn bị xử lý đúng | NOT_RUN |
| AUTH-11 | P0 | Đợi access token hết hạn rồi mở danh sách | `POST /auth/refresh` và request được retry | Refresh đúng một chu trình hợp lệ; không vòng lặp 401, không nhân đôi mutation | NOT_RUN |
| AUTH-12 | P0 | Đăng xuất rồi Back/F5 vào tài khoản | `POST /auth/logout`, GET cần quyền | Session/cache nhạy cảm được xóa; refresh token đã revoke không cấp session mới. Không mặc định JWT cũ mất hiệu lực ngay nếu BE không có revocation tức thời | NOT_RUN |
| AUTH-13 | P0 | Đăng xuất CB rồi đăng nhập CC | Me/tickets/bookings | Không chớp hoặc giữ lại vé, hồ sơ, thông báo của CB | NOT_RUN |
| PROFILE-01 | P1 | Sửa tên và điện thoại trong hồ sơ | `PATCH /users/me` | Body có expectedVersion; lưu rồi F5 còn dữ liệu mới; email readonly | NOT_RUN |
| PROFILE-02 | P1 | Tên/điện thoại rỗng hoặc không hợp lệ | PATCH me | Bị từ chối, giữ dữ liệu cũ, có thông báo | NOT_RUN |
| PROFILE-03 | P1 | Hai cửa sổ mở cùng phiên bản hồ sơ, lưu A rồi B | PATCH me với version cũ | B bị conflict; không âm thầm ghi đè cập nhật mới | NOT_RUN |

**Mail:** không tự tìm mã trong DB để đánh dấu email E2E PASS. Nếu Mailpit/email worker không nhận được thư, ghi BLOCKED_MAIL và giữ riêng kết quả API register/reset.

## 4. Tìm chuyến, địa điểm và khám phá

| ID | Ưu tiên | Thao tác FE | API đối chiếu | Kết quả cần kiểm tra | K?t qu? |
| --- | --- | --- | --- | --- | --- |
| SEARCH-01 | P1 | Focus điểm đi, gõ `da nang` | `GET /explore/routes` | Tìm được Đà Nẵng; danh sách không bị phần dưới đè lên | NOT_RUN |
| SEARCH-02 | P1 | Chọn Đà Nẵng, mở điểm đến | Catalogue tuyến | Chỉ hiện nơi có tuyến từ Đà Nẵng; không hiện origin-only như điểm đến giả | NOT_RUN |
| SEARCH-03 | P1 | Nhập text không có trong danh sách rồi submit | Không có search hợp lệ | FE yêu cầu chọn địa điểm thật, không gửi chuỗi tự do làm ID | NOT_RUN |
| SEARCH-04 | P1 | Chọn đi/đến rồi đổi điểm đi | Form | Điểm đến không còn hợp lệ phải được xóa hoặc yêu cầu chọn lại | NOT_RUN |
| SEARCH-05 | P2 | Đổi chiều bằng ⇄ | Catalogue tuyến | Chỉ đổi khi có tuyến ngược; ngày không bị tự đổi; vẫn cần chọn ngày có chuyến ngược | NOT_RUN |
| SEARCH-06 | P2 | Dùng ArrowUp/Down, Enter, Escape, Tab | Form | Chọn đúng, đóng menu đúng; không vô tình submit hoặc đổi sang option khác | NOT_RUN |
| SEARCH-07 | P1 | Bỏ trống ngày, chọn ngày quá khứ, cùng điểm đi/đến | `GET /trips` khi thử API trực tiếp | FE báo lỗi; BE không trả kết quả sai hoặc 500 | NOT_RUN |
| SEARCH-08 | P1 | Tìm tuyến ngày 15/11/2026 | `GET /trips?...page=0&size=100`, trang tiếp | Lúc seed 111 chuyến, FE không âm thầm bỏ kết quả sau 100; không trùng ID giữa trang | NOT_RUN |
| SEARCH-09 | P1 | Lọc giá, tiện ích, loại xe, buổi/giờ | GET trips và lọc FE | Mọi thẻ hiện ra thỏa điều kiện; filter local áp dụng trên đủ trang đã tải | NOT_RUN |
| SEARCH-10 | P1 | Sắp giá tăng/giảm, giờ đi | GET trips có sort | Sắp đúng trên toàn danh sách; không chỉ sắp riêng từng trang | NOT_RUN |
| SEARCH-11 | P1 | Đổi filter, Back/Forward, F5 URL kết quả | Query string / cache | Không giữ kết quả của tìm kiếm trước hoặc bỏ điều kiện | NOT_RUN |
| SEARCH-12 | P1 | Chọn ngày không có chuyến | GET trips trả items rỗng | Trạng thái trống và nút sửa tìm kiếm, không lỗi kỹ thuật | NOT_RUN |
| SEARCH-13 | P0 | Mở chuyến SOLD_OUT trong manifest | `GET /trips/{id}/seats` | Không có ghế AVAILABLE và không đặt được; đối chiếu riêng số ghế còn ở thẻ tìm kiếm | NOT_RUN |
| SEARCH-14 | P0 | Tìm chuyến draft/cancelled/ngừng bán | GET public trips | Không cho bán chuyến không hợp lệ; mở bằng URL/ID cũng không vượt kiểm tra BE | NOT_RUN |
| SEARCH-15 | P1 | Đối chiếu chi tiết và điểm dừng của một chuyến | GET trips/{id}, GET trips/{id}/stops | Điểm dừng, thứ tự, thời gian và quyền đón/trả khớp; không lẫn route khác | NOT_RUN |
| EXPLORE-01 | P2 | Mở `/explore`, thẻ tuyến và chi tiết | GET explore/routes, GET trips | Link dùng đúng origin/destination; có empty/error state nếu không có tuyến | NOT_RUN |
| EXPLORE-02 | P2 | Bấm các tuyến phổ biến trên trang chủ | URL đích + API | Không coi ảnh/thẻ marketing là bằng chứng có chuyến; nếu tuyến chưa bán phải giải thích hợp lý | NOT_RUN |

## 5. Ghế, giữ chỗ và tạo đơn

| ID | Ưu tiên | Thao tác FE / API bổ sung | API đối chiếu | Kết quả cần kiểm tra | K?t qu? |
| --- | --- | --- | --- | --- | --- |
| BOOK-01 | P0 | Mở sơ đồ ghế sau đăng nhập | `GET /trips/{id}/seats` | Mã, trạng thái và giá khớp inventory; ghế booked/held/disabled không chọn được như AVAILABLE | NOT_RUN |
| BOOK-02 | P1 | Chọn 1, 2, 3 hành khách | Chọn ghế / tổng tiền | Đúng số ghế; thiếu/thừa không tiếp tục; tổng không tính lặp ghế | NOT_RUN |
| BOOK-03 | P1 | Thử quá 6 hành khách hoặc seat ID lặp qua API | POST seat-holds/bookings | Giới hạn theo contract; không tạo dữ liệu bẩn | NOT_RUN |
| BOOK-04 | P1 | Thiếu tên hành khách, email/điện thoại sai | Form hành khách, POST bookings | FE báo đúng trường; BE cũng kiểm tra, không tin riêng FE | NOT_RUN |
| BOOK-05 | P1 | Quay lại sửa ghế trước khi xác nhận | Chưa POST hold | Danh sách hành khách giữ đúng ghế còn chọn; tổng cập nhật đúng | NOT_RUN |
| BOOK-06 | P0 | Review chọn Lăng Cô → Huế | POST seat-holds, POST bookings | Hold và mọi passenger gửi đúng UUID điểm đã chọn; summary/giờ đón cũng khớp | NOT_RUN |
| BOOK-07 | P0 | Thử điểm đón sau điểm trả qua API | POST hold/bookings | BE từ chối thứ tự sai; không ghi booking | NOT_RUN |
| BOOK-08 | P0 | Tạo đơn trả trước mới | POST hold → POST bookings | Đúng một booking PENDING_PAYMENT; contact, passenger, currency, expectedTotal khớp | NOT_RUN |
| BOOK-09 | P0 | Tạo đơn trả sau trên chuyến cho phép | POST bookings paymentChannel=PAY_LATER | CONFIRMED, vé được phát; không yêu cầu mở cổng online | NOT_RUN |
| BOOK-10 | P0 | Gửi PAY_LATER cho chuyến không cho phép | POST bookings | BE từ chối; không tạo vé trả sau trái chính sách | NOT_RUN |
| BOOK-11 | P0 | Sửa expectedTotal thấp hơn, currency sai hoặc seat ngoài hold qua API | POST bookings | BE từ chối; không tin giá/ghế do browser sửa | NOT_RUN |
| BOOK-12 | P0 | Click xác nhận nhanh hai lần | POST bookings, Idempotency-Key | Không trùng đơn, vé hoặc chiếm hai lần cùng ghế | NOT_RUN |
| BOOK-13 | P0 | Gửi lại cùng request và cùng key | POST hold/bookings | Cùng kết quả/ID, không thêm bản ghi; key cũ với body khác phải bị từ chối | NOT_RUN |
| BOOK-14 | P0 | Mất phản hồi sau khi BE giữ ghế, bật mạng và F5 | GET hold, replay POST cùng key | Nhận ra hold của mình, có thể tiếp tục/nhả; không tự chặn vì ghế mình đang HELD | NOT_RUN |
| BOOK-15 | P0 | Bấm bỏ đặt vé sau khi có hold, chưa có booking | `DELETE /seat-holds/{token}` | Hold được nhả, inventory khả dụng trở lại; không nhả booking đã tiêu thụ hold | NOT_RUN |
| BOOK-16 | P0 | Chờ hold mới hết hạn >10 phút, đọc lại inventory | GET hold, GET seats | Không tạo booking từ hold hết hạn; ghế được phục hồi sau xử lý expiry | NOT_RUN |
| BOOK-17 | P0 | CB và CC tạo hold cùng inventory seat gần đồng thời | POST hold bằng hai session | Chỉ một hold được sở hữu ghế; người thua nhận conflict. Hai tab chỉ chọn trên FE chưa đủ vì hold được tạo khi xác nhận | NOT_RUN |
| BOOK-18 | P0 | Dùng hold token CB với token CC | GET/DELETE hold, POST bookings | Bị chặn quyền; CC không đọc/nhả/tiêu thụ hold của CB | NOT_RUN |
| BOOK-19 | P1 | F5 từng bước seats/passengers/review | Draft + GET trip/seats | Không mất dữ liệu đã lưu bất ngờ, không dùng draft của tài khoản trước | NOT_RUN |

**BOOK-17:** dùng hai cửa sổ đăng nhập khác nhau; xác nhận gần đồng thời. Để có race thật, có thể gửi hai POST hold từ hai terminal với token khác nhau. Không đánh giá đồng thời bằng hai request tuần tự cách nhau vài giây. BE là nơi quyết định thắng/thua.

## 6. Thanh toán và callback

Mỗi case thành công/thất bại/hủy dùng **booking mới riêng**. Không dùng lại đơn check-in hoặc đã refund để thử thanh toán mới.

| ID | Ưu tiên | Thao tác | API đối chiếu | Kết quả cần kiểm tra | K?t qu? |
| --- | --- | --- | --- | --- | --- |
| PAY-01 | P0 | Mở checkout của đơn mới | `POST /bookings/{id}/payments` | Một payment, amount/currency khớp booking; redirect hợp lệ | NOT_RUN |
| PAY-02 | P0 | Simulator chọn thành công | Webhook `/integrations/payments/{provider}/webhooks`, GET payments/bookings/tickets | Payment SUCCEEDED → booking PAID → vé ISSUED sau event; không chỉ dựa query string redirect | NOT_RUN |
| PAY-03 | P0 | Simulator chọn thất bại | Webhook và GET payment | Không phát vé PAID giả; lỗi rõ ràng; ghi khả năng thanh toán lại còn thiếu nếu gặp | NOT_RUN |
| PAY-04 | P0 | Ở return page hủy giao dịch chưa hoàn tất | `POST /payments/{id}/cancel` | Chuyển trạng thái hợp lệ, không báo thanh toán thành công; booking/ghế xử lý theo lifecycle, không mặc định cancel payment là cancel booking | NOT_RUN |
| PAY-05 | P1 | Lần lượt chọn QR/ATM/tài khoản/VNPay ở đơn riêng | Body method + provider checkout URL | BE phải truyền lựa chọn tới cổng nếu sản phẩm hứa hỗ trợ; chỉ body đổi nhưng cổng không đổi thì chưa PASS | NOT_RUN |
| PAY-06 | P0 | Double click thanh toán / F5 checkout | POST payment và GET list payments | Không tạo nhiều capture/payment cho cùng booking | NOT_RUN |
| PAY-07 | P0 | Đóng tab simulator rồi mở lại account | GET bookings và booking payments | Đọc đúng trạng thái BE; nếu chưa thanh toán có cách quay lại phù hợp, không tự báo thành công | NOT_RUN |
| PAY-08 | P0 | Sửa URL return thêm `status=success`, `vnp_ResponseCode=00` khi chưa trả tiền | GET booking/payments | Query giả không làm payment/booking thành công | NOT_RUN |
| PAY-09 | P0 | Dùng token CC tạo/hủy payment thuộc CB | POST/GET payment endpoints | Bị chặn; không thay trạng thái hoặc lộ thông tin | NOT_RUN |
| PAY-10 | P0 | Gọi cancel sau payment đã SUCCEEDED | POST payment cancel | Không đảo giao dịch đã thu thành CANCELLED; trạng thái tiền giữ đúng | NOT_RUN |
| PAY-11 | P0 | Thử checkout sau booking đã hết hạn | POST payment | BE từ chối; FE giải thích, không redirect tới cổng để thu tiền vô chủ | NOT_RUN |
| PAY-12 | P0 | Mất mạng sau tạo payment, bật mạng thử lại | POST cùng key/GET status | Không nhân đôi payment; dùng được trạng thái thực tế | NOT_RUN |
| PAY-13 | P0 | Backend nâng cao: replay cùng webhook sandbox đã ký hợp lệ | POST integration webhook | Không nhân đôi vé, doanh thu, settlement; dùng payload fixture hợp lệ từ provider/test harness, không tự đoán chữ ký | NOT_RUN |
| PAY-14 | P0 | Backend nâng cao: webhook chữ ký sai, tiền/txn không khớp | Integration webhook | Từ chối hoặc không xử lý thành công; không phát vé. Không thay secret BE để ép case PASS | NOT_RUN |
| PAY-15 | P1 | Backend nâng cao: callback đến sau cancel/expiry hoặc sai thứ tự | Integration webhook + GET trạng thái | Có chính sách nhất quán, không vừa nhả ghế vừa phát vé cho cùng chỗ | NOT_RUN |

Webhook server-to-server không nhất thiết hiện trong Network trình duyệt. Dùng log BE/simulator và correlation/event ID khi cần. Nếu không có payload ký hợp lệ để replay, ghi `BLOCKED_TEST_HARNESS` cho PAY-13/PAY-15, không coi simulator click một lần là đủ kiểm thử trùng webhook.

## 7. Vé, tra cứu, thông báo và hủy vé

| ID | Ưu tiên | Thao tác FE | API đối chiếu | Kết quả cần kiểm tra | K?t qu? |
| --- | --- | --- | --- | --- | --- |
| TICKET-01 | P1 | `/account/tickets`, chuyển Vé/Đơn | `GET /tickets`, `GET /bookings` | Đúng tài khoản, trạng thái và phân trang; vé phát hành không mất khi F5 | NOT_RUN |
| TICKET-02 | P1 | EMPTY mở account | Hai list rỗng | Empty state đúng, có tìm chuyến; không coi rỗng là lỗi kết nối | NOT_RUN |
| TICKET-03 | P1 | Mở vé bằng nút Xem vé | `GET /tickets/{uuid}`, GET trip | Mã vé, tên, ghế, trạng thái và giờ Việt Nam đúng | NOT_RUN |
| TICKET-04 | P1 | `/tickets/lookup` nhập public code hoặc booking code của CB | GET danh sách được quyền | Tìm đúng vé/nhóm vé; mã không tồn tại báo không tìm thấy | NOT_RUN |
| TICKET-05 | P0 | CC tra mã của CB hoặc mở UUID vé CB | GET ticket/list | Không lộ vé CB. Lookup live yêu cầu đăng nhập; chưa có public lookup bằng số điện thoại | NOT_RUN |
| NOTIFY-01 | P1 | Mở chuông, bấm xem thêm | GET notifications với cursor | Trang tiếp không lặp/mất item; 28 mẫu đủ qua trang 20 | NOT_RUN |
| NOTIFY-02 | P1 | Đánh dấu thông báo đã đọc, F5 | PATCH notifications/{id}/read | read=true tồn tại sau reload, badge thay đổi trong các mục đã tải | NOT_RUN |
| NOTIFY-03 | P0 | CC gọi read notification của CB | PATCH read | Bị chặn; không thay thông báo người khác | NOT_RUN |
| NOTIFY-04 | P1 | Gửi cursor sai định dạng, đổi limit ngoài phạm vi | GET notifications | BE xử lý input hợp lệ theo contract, FE không trắng trang hoặc vòng lặp tải thêm | NOT_RUN |
| CANCEL-01 | P0 | Vé chưa check-in → chính sách → preview | POST bookings/{id}/cancellation-preview | Chưa thay đổi đơn/vé/tiền; fee + refund khớp số vé được chọn | NOT_RUN |
| CANCEL-02 | P0 | Xác nhận preview còn hạn với lý do | POST bookings/{id}/cancel | Dùng đúng previewId và rowVersion; phản hồi chấp nhận được đối chiếu lại bằng GET | NOT_RUN |
| CANCEL-03 | P0 | `XB-FAMILY-1`, chọn 1/3 vé rồi preview | Preview | Chỉ tính vé được chọn; lưu kết quả trước khi xác nhận | NOT_RUN |
| CANCEL-04 | P0 | Xác nhận hủy 1/3 vé | Cancel + GET ba vé/inventory/payment | Không hủy/nhả ghế hai hành khách không được chọn; tiền hoàn không vượt giá trị phần bị hủy. Sai khác ghi FAIL_BE, không sửa dữ liệu để che | NOT_RUN |
| CANCEL-05 | P1 | Trả sau FAMILY-2 hủy | Preview/cancel | Không có refund tiền online chưa từng thu; ghế và trạng thái đúng | NOT_RUN |
| CANCEL-06 | P0 | Chọn vé CHECKED_IN/USED/đã hủy để preview/cancel | Preview/cancel trực tiếp nếu FE ẩn | BE từ chối theo chính sách; không hoàn hoặc nhả ghế trái phép | NOT_RUN |
| CANCEL-07 | P0 | Preview cũ/hết hạn, version cũ, preview thuộc đơn khác | Cancel trực tiếp | Không cập nhật nhầm đơn, trả lỗi nghiệp vụ thay vì 500 | NOT_RUN |
| CANCEL-08 | P0 | Double click cancel, gửi lại cùng key | Cancel | Không hủy/hoàn hai lần; kiểm tra tổng refund bằng GET finance | NOT_RUN |
| CANCEL-09 | P0 | CC hủy đơn CB | Preview/cancel | Bị chặn quyền, không lộ thông tin hoặc thay tiền | NOT_RUN |

Với CANCEL-03/04, chỉ kiểm tra preview trước nếu bạn muốn giữ nguyên bộ FAMILY để thử lại. Xác nhận hủy là thay đổi thật trên DB demo, không tự trở về trạng thái đầu.

## 8. Nhà xe, tài xế, tài nguyên và vận hành

Các case sửa/tạo dưới đây dùng dữ liệu QA mới. Bắt đầu bằng OB; dùng OC để thử quyền chéo. Khi FE dùng UUID input, lấy ID từ response/list, không dùng public code làm UUID.

| ID | Ưu tiên | Trang/thao tác | API đối chiếu | Kết quả cần kiểm tra | K?t qu? |
| --- | --- | --- | --- | --- | --- |
| OP-01 | P0 | OB `/operator/trips`, `/operator/bookings` | GET operator trips/bookings | Chỉ dữ liệu nhà xe B; OC chỉ nhà xe C | NOT_RUN |
| OP-02 | P1 | Hồ sơ nhà xe trên trang chuyến | GET/PATCH operator/organization | Sửa liên hệ thành công, F5 còn; có expectedVersion | NOT_RUN |
| OP-03 | P1 | Bật trả sau, công bố chuyến QA mới | PATCH org + POST publish + public GET trip | Chính sách snapshot của chuyến mới đúng; chuyến đã công bố không bị đổi ngầm | NOT_RUN |
| OP-04 | P1 | `/operator/vehicles`: thêm xe QA | POST operator/buses | Tạo đúng 1 xe, thông tin hợp lệ, biển số trùng bị từ chối | NOT_RUN |
| OP-05 | P1 | Sửa xe QA, F5 | PATCH operator/buses/{id} | Giá trị mới đúng; không ghi đè version mới từ cửa sổ khác | NOT_RUN |
| OP-06 | P0 | Quản lý sơ đồ ghế xe QA | PUT operator/buses/{id}/seats | Mã/tọa độ không trùng; state enable/disable lưu đúng; không phá inventory chuyến đã bán | NOT_RUN |
| OP-07 | P1 | Vô hiệu hóa xe QA không có lịch | POST buses/{id}/deactivate | Status đổi và không chọn cho lịch mới; nếu xe đang có ràng buộc phải báo lý do | NOT_RUN |
| OP-08 | P1 | `/operator/drivers/new`, dùng user DRIVER QA chưa có profile | POST operator/drivers | Tạo hồ sơ hợp lệ; UUID người dùng và ngày bằng lái đúng | NOT_RUN |
| OP-09 | P1 | Sửa / vô hiệu hóa tài xế QA | PATCH driver, POST deactivate | Lưu đúng, conflict rõ; không nhận tài xế hết hạn/không hoạt động cho lịch trái chính sách | NOT_RUN |
| OP-10 | P1 | `/operator/routes/new`: tạo tuyến QA | POST operator/routes | Điểm đi khác điểm đến, thời lượng/độ dài hợp lệ | NOT_RUN |
| OP-11 | P1 | Sửa tuyến, thêm điểm dừng | PATCH route, PUT route/{id}/stops | Sequence/offset tăng đúng, cờ đón/trả đúng; reload còn dữ liệu | NOT_RUN |
| OP-12 | P1 | Vô hiệu hóa tuyến QA | POST route deactivate | Không bán/tạo lịch trái chính sách; lịch đã có giữ snapshot đúng | NOT_RUN |
| OP-13 | P0 | `/operator/trips/new`: tuyến QA, xe QA, tài xế QA, giờ VN tương lai | POST operator/trips | Một draft đúng giờ ISO/giá; arrival > departure; resource thuộc tenant B | NOT_RUN |
| OP-14 | P0 | Tạo lịch trùng xe hoặc tài xế | POST/PATCH trips | Conflict rõ, không có hai lịch hoạt động chồng nhau | NOT_RUN |
| OP-15 | P0 | Sửa draft rồi công bố | PATCH trip, POST trip/{id}/publish | Inventory được import; public chỉ bán khi inventory ready, không lộ draft | NOT_RUN |
| OP-16 | P0 | Chuyển trạng thái lần lượt đúng quy trình | POST trip/{id}/status-transitions | SCHEDULED → BOARDING → DEPARTED → IN_TRANSIT → ARRIVED → COMPLETED; cấm nhảy ngược/sai | NOT_RUN |
| OP-17 | P0 | Hủy chuyến QA có khách chưa sử dụng | POST trip/{id}/cancel, GET booking/tickets | Dừng bán, khách/ghế/hoàn tiền xử lý nhất quán sau event; không mất thông tin lịch sử | NOT_RUN |
| OP-18 | P1 | Backend: thử DELETE trip | DELETE operator/trips/{id} | **405 là kết quả đúng**: BE không hỗ trợ xóa cứng chuyến | NOT_RUN |
| OP-19 | P0 | OB mở manifest đúng chuyến | GET operator/trips/{id}/manifest | Đủ tên, ghế, điểm đón; chuyến FULL có 24 khách | NOT_RUN |
| OP-20 | P0 | Scan public code hợp lệ rồi xác nhận | POST tickets/validate, POST tickets/{id}/check-in | Validate chưa check-in; xác nhận mới đổi sang CHECKED_IN, dùng đúng rowVersion | NOT_RUN |
| OP-21 | P0 | Scan vé khác chuyến, mã giả, vé hủy/đã check-in | Hai scan endpoints | Từ chối đúng, không đổi vé khác | NOT_RUN |
| OP-22 | P0 | Đổi mã nhập khi validate đang chạy | Validate request cũ + check-in | Không hiển thị/xác nhận nhầm ticket từ phản hồi cũ; BE vẫn kiểm tra ticketId, token, tripId | NOT_RUN |
| OP-23 | P0 | DB xem phân công, check-in đúng chuyến được giao | GET driver/assignments, scan endpoints | Đúng chuyến được giao; vé chuyến khác/tenant khác bị chặn | NOT_RUN |
| OP-24 | P0 | OC gọi sửa tài nguyên/manifest của B | Operator endpoints | 403/404 theo contract, không trả hoặc sửa dữ liệu B | NOT_RUN |
| OP-25 | P1 | Thử SB, VB, FB với các nút tài nguyên/vận hành | GET/mutation operator endpoints | Quyền theo BE; không lấy quyền OB làm chuẩn cho mọi vai trò; ẩn nút FE không thay kiểm tra BE | NOT_RUN |

## 9. Hoàn tiền, đối soát, payout và báo cáo

| ID | Ưu tiên | Trang/thao tác | API đối chiếu | Kết quả cần kiểm tra | K?t qu? |
| --- | --- | --- | --- | --- | --- |
| FIN-01 | P0 | OB `/operator/bookings` → Xem giao dịch | GET bookings/{id}/payments, GET payments/{id} | Đúng payment của đơn và tenant, amount/status đúng | NOT_RUN |
| FIN-02 | P0 | Chọn payment SUCCEEDED, tạo hoàn một phần với mã QA mới | POST refunds | 202/accepted theo contract; GET refund/payment/settlement khớp, refund không vượt captured | NOT_RUN |
| FIN-03 | P0 | `XB-EDGE-1`: hoàn > phần 60% còn lại | POST refunds | Bị từ chối; successful refunds cộng lại không quá tiền đã thu | NOT_RUN |
| FIN-04 | P0 | Gửi lại cùng refundReference / key | POST refunds | Không tạo/ghi tiền hoàn hai lần; GET lại đủ để chứng minh | NOT_RUN |
| FIN-05 | P0 | Hoàn payment FAILED/CANCELLED/REFUNDED hoặc bookingId không khớp | POST refunds | BE từ chối, không tạo refund thành công giả | NOT_RUN |
| FIN-06 | P0 | Kế toán C hoàn payment B, khách tự gọi finance refund | POST refunds, GET refund | Không vượt quyền dù sửa URL/body; customer không được quyền create finance refund | NOT_RUN |
| FIN-07 | P1 | Xem REQUESTED/PROCESSING/FAILED/SUCCEEDED | GET operator/refunds và /{id} | FE hiển thị đúng trạng thái mẫu, không gắn nhãn tất cả đã hoàn | NOT_RUN |
| FIN-08 | P0 | `/operator/settlements` B/C, so với đơn vừa tạo | GET operator/settlements | Scope đúng; gross = commission + operatorNet; trả sau không ghi capture online | NOT_RUN |
| FIN-09 | P0 | Sau refund, so settlement/ledger/report | GET payments/refunds/settlements/reports; DB nếu cần | Không đếm thu hoặc hoàn hai lần, số tiền không âm ngoài dòng ledger đảo hợp lệ | NOT_RUN |
| FIN-10 | P1 | `/operator/reports`: doanh thu, đơn, lấp đầy; khoảng 01/10–30/11/2026 | GET reports/revenue, bookings, occupancy | Có dữ liệu tháng trước và tháng này; occupancy nhìn theo departure, bookings/revenue theo mốc BE, không nhầm trường | NOT_RUN |
| FIN-11 | P1 | Đổi ngày, khoảng rỗng, from > to | Report API | Chặn khoảng sai, khoảng rỗng có empty state; không giữ báo cáo range trước | NOT_RUN |
| FIN-12 | P0 | FB/PF và customer gọi báo cáo | Report API | FB chỉ B, PF theo quyền toàn nền tảng; customer bị chặn | NOT_RUN |
| FIN-13 | P0 | ADMIN `/admin/payments?view=settlements`: tạo payout QA | POST admin/payouts | Body đúng org/period/currency/amount; không dùng fixture SENT để kết luận có chuyển khoản thật | NOT_RUN |
| FIN-14 | P0 | Period ngược, tiền âm, currency sai hoặc FB tự tạo payout | POST admin/payouts | Input/quyền bị kiểm tra; không payout trái phép | NOT_RUN |
| FIN-15 | P1 | Xem ba payout mẫu trong DB/API nếu có | Payout API hiện chỉ có create | Không đánh dấu FE list PASS nếu chưa có endpoint/trang danh sách; ghi BLOCKED_FE/BE cho phần chưa cung cấp | NOT_RUN |

## 10. Admin: nhà xe, người dùng và phân quyền

| ID | Ưu tiên | Thao tác bằng ADMIN | API đối chiếu | Kết quả cần kiểm tra | K?t qu? |
| --- | --- | --- | --- | --- | --- |
| ADMIN-01 | P0 | Mở `/admin/organizations`, `/admin/staff` | GET admin/organizations, admin/users | Đủ list, phân trang, chi tiết; không 500 khi có inactive/pending user | NOT_RUN |
| ADMIN-02 | P1 | Tạo nhà xe QA mới, xem chi tiết | POST admin/organizations, GET /{id} | Code duy nhất, liên hệ/allowPayLater đúng, reload còn | NOT_RUN |
| ADMIN-03 | P1 | Code trùng, thiếu trường, commission/field sai qua API | POST org | Từ chối dữ liệu sai, không tạo tenant trùng | NOT_RUN |
| ADMIN-04 | P0 | Tạo user QA riêng rồi đổi ACTIVE/DISABLED | PATCH admin/users/{id}/status | Có lý do/version; đăng nhập/refresh sau thay đổi tuân chính sách, không tự mặc định JWT cũ bị revoke tức thời | NOT_RUN |
| ADMIN-05 | P0 | Thay roles user QA và đăng nhập/refresh lại | PUT admin/users/{id}/roles | Quyền mới đúng, quyền cũ không giữ vô hạn; không sửa user ADMIN đang dùng | NOT_RUN |
| ADMIN-06 | P0 | Thêm user QA vào org QA, sửa vai trò membership | POST/PATCH admin/organizations/{id}/members | Đúng tenant/user, lý do và expectedVersion; không tạo membership trùng trái ràng buộc | NOT_RUN |
| ADMIN-07 | P0 | Ngừng quyền membership, kiểm tra session user QA | PATCH membership + request tài nguyên | Không còn quyền tenant khi BE đánh giá quyền mới; ghi rõ kết quả nếu FE gửi status không khớp DB | NOT_RUN |
| ADMIN-08 | P1 | Hai cửa sổ sửa user/member cùng version | PATCH/PUT với expectedVersion cũ | Conflict, không ghi đè im lặng | NOT_RUN |
| ADMIN-09 | P0 | `/admin/bookings`, `/admin/payments`, `/admin/refunds` và chi tiết | GET admin lists/details | Dữ liệu tổng hợp đúng; link UUID đúng, số tiền/trạng thái không mất field | NOT_RUN |
| ADMIN-10 | P0 | Customer/OB mở admin routes và gọi admin identity API trực tiếp | GET/POST/PATCH admin users/org/member | Bị chặn ở BE theo policy; FE guard không phải lớp bảo vệ duy nhất | NOT_RUN |
| ADMIN-11 | P1 | PF mở trang finance và gọi API tương ứng | Admin FE guard / finance APIs | Nếu API 200 nhưng FE 403 thì ghi FAIL_FE/KNOWN, không coi thiếu dữ liệu | NOT_RUN |

## 11. Kiểm tra lỗi, quyền và trải nghiệm xuyên suốt

| ID | Ưu tiên | Thao tác | API đối chiếu | Kết quả cần kiểm tra | K?t qu? |
| --- | --- | --- | --- | --- | --- |
| SEC-01 | P0 | Bỏ Authorization hoặc dùng token ngẫu nhiên | GET tài nguyên riêng | 401; không trả dữ liệu nhạy cảm | NOT_RUN |
| SEC-02 | P0 | Đổi UUID của resource B sang C trong URL/body | Ticket/booking/payment/refund/manifest/operator mutation | 403/404 hoặc list được scope, không đọc/sửa chéo | NOT_RUN |
| SEC-03 | P0 | Gọi endpoint chứa `admin/payments` bằng FB | GET admin/payments | **200 có thể là đúng** vì BE scope theo org. Đối chiếu ID/booking nguồn của C không xuất hiện, không đánh giá theo tên URL | NOT_RUN |
| SEC-04 | P0 | Tăng/giảm expectedVersion ở mutation | PATCH/profile/trip/member/cancel/check-in | Version cũ bị từ chối; lấy version mới khi tải lại, không tự retry ghi đè | NOT_RUN |
| SEC-05 | P0 | Thiếu key mutation yêu cầu idempotency, replay key cùng/khác body | POST/PUT tương ứng | Lỗi hợp lệ hoặc replay đúng policy; không duplicate dữ liệu tiền/ghế | NOT_RUN |
| SEC-06 | P1 | UUID sai cú pháp và UUID hợp lệ không tồn tại | GET detail và mutation | Lỗi 4xx rõ; FE không trắng trang | NOT_RUN |
| SEC-07 | P0 | Thử gọi `/internal/...` thông qua gateway | Gateway port 5080 | Không được dùng để giả paid/import quote trái phép. Nếu route ngoài ý muốn truy cập được thì ghi lỗi cấu hình, không dùng nó để hoàn tất test | NOT_RUN |
| UX-01 | P1 | F12 Network → Offline khi đọc list, rồi Online → retry | GET list | Có error/retry, không hiển thị lỗi như empty state giả | NOT_RUN |
| UX-02 | P0 | Offline/timeout trong lúc ghi tiền/ghế | Mutation + GET reconcile | Không hiện thành công giả, không sinh request khác nội dung với key cũ | NOT_RUN |
| UX-03 | P1 | Đổi tab tài khoản/filter/route khi request cũ đang pending | GET/validate mutations | Phản hồi cũ không ghi lên trạng thái lựa chọn mới | NOT_RUN |
| UX-04 | P1 | Viewport 390px, 768px, 1440px | FE | Không tràn ngang ngoài vùng table/carousel có chủ đích; menu không bị đè/cắt | NOT_RUN |
| UX-05 | P1 | Zoom 200%, Tab/Shift+Tab, Enter, Escape | FE | Nhãn/input/nút có focus, dropdown dùng được bàn phím, lỗi chỉ đúng trường | NOT_RUN |
| UX-06 | P1 | Double click nút lưu, request chậm | Mutation | Loading/disabled hợp lý, không gửi lặp vô hạn | NOT_RUN |
| UX-07 | P2 | Kiểm tra tiền/giờ/tên trạng thái và tiếng Việt | UI + response | VND không sai bậc 100 lần, ngày theo +07, không dùng UTC để hiển thị giờ đón; không còn mã state khó hiểu ở nơi cần nhãn | NOT_RUN |
| UX-08 | P1 | Sau mỗi mutation F5 và mở cửa sổ mới | GET resource | Dữ liệu thực đã lưu, không chỉ optimistic state/localStorage | NOT_RUN |
| UX-09 | P2 | Mở URL không tồn tại, deep link, Back/Forward | FE route | 404/điều hướng hợp lý, không tự rơi vào trang mock | NOT_RUN |

## 12. Những điểm đã thấy trong code cần ưu tiên xác nhận lại

Đây là **nghi vấn/lỗi đã biết ở lần rà code**, chưa được đóng chỉ bằng việc seed dữ liệu:

| Liên quan | Điểm cần xác nhận | Cách ghi kết quả |
| --- | --- | --- |
| BOOK-14/15 | Review live chỉ chấp nhận seat AVAILABLE; hold của chính mình có thể làm không mở lại được ReadyReview/nút nhả khi reload | Nếu tái hiện, FAIL_FE; ghi holdToken/status đã tồn tại, không chỉ chụp form |
| BOOK-06 | Tùy chọn điểm đón lưu metadata nhưng summary/giờ có mặt vẫn có thể lấy đầu chuyến | FAIL_FE nếu request đúng nhưng UI sai; FAIL_BE nếu response lưu sai |
| PAY-03/05 | BE có thể trả lại payment FAILED/CANCELLED cũ và chưa dùng method để xây URL provider | Không coi đổi dropdown là PASS chức năng phương thức; ghi request + trạng thái/URL trả về |
| ADMIN-11 | Mapping UI chỉ nhận PLATFORM_ADMIN, PF có thể bị chặn trang dù BE cho phép tài chính | FAIL_FE/KNOWN, vẫn kiểm tra BE riêng |
| SEARCH-13 | `availableSeatCount` public trip có thể dựa sức chứa xe thay vì inventory thực | API inventory hết ghế mới là bằng chứng không còn bán; ghi sai khác ở thẻ tìm kiếm |
| CANCEL-04 | Cần kiểm tra kỹ hủy một phần có làm thay trạng thái toàn đơn/vé khác không | Không mặc định tính năng hoàn chỉnh; ghi đủ ba ticket và ghế trước/sau |
| OP-22 | Kết quả validate cũ có thể tới sau khi mã scan đã được thay | Ghi cả token dùng validate và token/ticket dùng check-in; BE phải chặn mismatch |

## 13. Cách phân biệt FAIL, BLOCKED và chưa hỗ trợ

- FE báo thành công nhưng F5 mất dữ liệu / GET BE chưa đổi: **FAIL**, không phải PASS.
- List trả 200 rỗng đúng quyền/dữ liệu: có thể **PASS empty state**; request 500/503 lại hiển thị “chưa có dữ liệu”: **FAIL_FE**, kèm lỗi môi trường nếu có.
- API đúng nhưng không có trang/nút: **BLOCKED_FE** hoặc tính năng chưa triển khai; không tính FE đã nối đầy đủ.
- Payout SENT seed không chứng minh chuyển khoản; refund SUCCEEDED seed không chứng minh webhook/refund worker. Chỉ case tạo mới và quan sát đủ chuỗi mới đánh dấu **E2E PASS**.
- API tài chính/danh sách cần thời gian consumer: chờ/refetch và ghi độ trễ; nếu sau một ngưỡng thử hợp lý, ví dụ 30 giây ở local, chưa đồng bộ thì lưu log/correlation và ghi BLOCKED/FAIL, không tự sửa DB để ép kết quả.
- Kiểm thử hai khách cùng ghế, webhook trùng hoặc lỗi mạng cần tạo tình huống runtime; không thể thay bằng một record fixture.

## 14. Mẫu ghi kết quả và thứ tự đề nghị

Ưu tiên: **luồng A/B/C → toàn bộ P0 → P1 → P2**. Chia nhiều lượt; không cần làm hết trong một phiên. Ước lượng phụ thuộc lỗi môi trường và tốc độ ghi bằng chứng, không chốt “full PASS” khi còn BLOCKED/P0 chưa chạy.

Copy mẫu này cho mỗi lỗi:

```text
Case ID:
Ngày/giờ (+07):
PASS / FAIL_FE / FAIL_BE / BLOCKED_ENV / BLOCKED_FE / NOT_RUN:
Tài khoản + vai trò:
URL FE:
tripId / bookingId / ticketId / paymentId:
Bước tái hiện:
Mong đợi:
Thực tế:
API method + path + HTTP status:
error.code / correlationId:
Ảnh hoặc log (đã bỏ token):
```

Muốn chạy lại nhóm kiểm tra API không tạo giao dịch mới:

```powershell
cd D:\Project\PBL6
node workspace/scripts/verify-expanded-fe-demo.cjs
```

Script kiểm tra đăng nhập và đọc API; kết quả lưu `workspace/src/apps/web/tmp/expanded-demo/api-verification.json`. Con số kiểm tra của script không thay thế toàn checklist thủ công và không làm mọi case tự chuyển PASS.

Mẫu gọi API thủ công, replay request và chuẩn bị dữ liệu xem [MANUAL_API_EXAMPLES.md](./MANUAL_API_EXAMPLES.md).
