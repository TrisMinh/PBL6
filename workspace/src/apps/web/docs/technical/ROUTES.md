# Route frontend

**Trạng thái:** Đã duyệt cho mock · **Cập nhật:** 2026-10-18

| Route | Quyền | Mục đích |
|---|---|---|
| `/` | Public | Trang chủ, prerender |
| `/trips` | Public | Tìm, lọc và sắp xếp chuyến |
| `/explore` | Public | Khám phá tỉnh/thành và search danh mục mô phỏng |
| `/explore/:provinceSlug` | Public | Điểm đón, điểm trả và nhà xe mô phỏng theo tỉnh/thành |
| `/booking/:sessionId/seats` | Booking session | Chọn ghế |
| `/booking/:sessionId/passengers` | Booking session | Thông tin hành khách |
| `/booking/:sessionId/review` | Booking session | Kiểm tra đặt vé |
| `/payment/:bookingId/vnpay` | Booking session | Chuẩn bị VNPay |
| `/payment/vnpay/return` | Public callback | Xử lý kết quả idempotent |
| `/tickets/lookup` | Public | Tra cứu vé guest |
| `/tickets/:ticketCode` | Lookup/account session | Chi tiết vé |
| `/account/tickets` | Customer session | Lịch sử vé đã phát hành |
| `/bookings/:bookingCode/cancel` | Lookup/account session | Chọn vé hủy, xác nhận, hoàn tiền |
| `/login` | Guest | Đăng nhập |
| `/register` | Guest | Đăng ký |
| `/forgot-password` | Guest | Quên mật khẩu |
| `/admin/organizations` | Admin | Danh sách tổ chức |
| `/admin/organizations/:organizationId` | Admin | Chi tiết tổ chức |
| `/admin/staff` | Admin | Danh sách nhân viên |
| `/admin/staff/:staffId` | Admin | Chi tiết nhân viên |
| `/admin/bookings` | Admin | Danh sách đơn đặt vé |
| `/admin/bookings/:bookingId` | Admin | Chi tiết đơn |
| `/admin/payments` | Admin | Danh sách thanh toán |
| `/admin/payments/:paymentId` | Admin | Chi tiết thanh toán |
| `/admin/refunds` | Admin | Danh sách hoàn tiền |
| `/admin/refunds/:refundId` | Admin | Chi tiết hoàn tiền |

Search/filter/sort/pagination nằm trong query string. Modal Admin dùng `?dialog=create|edit`; loading/empty/error/forbidden là trạng thái page, không phải route mới.

Plan05 Task5 chuẩn hóa admin list keys `query`, `organizationId`, `status`, `page`, `pageSize` qua shared Zod boundary. Default page1/pageSize20 được bỏ khỏi URL; invalid/repeated list values được thay bằng canonical safe value qua replace một lần. Filter reset page1, pagination giữ filters; clear xóa query/organization/status/page nhưng giữ pageSize và các key ngoài ownership như `dialog`. Resource pages bắt đầu nối contract này từ Task6.

`TripFilters({ searchParams, onChange })` nhận URLSearchParams hiện tại và phát object clone qua callback; component không tự navigate/fetch. Sort chỉ departure/price-asc/price-desc; vehicleType optional sleeper-34/cabin-22 (Tất cả xóa key). Đặt lại chỉ xóa mọi entry sort/vehicleType, giữ nguyên tất cả entry khác, kể cả bốn core fields và key lặp. URLSearchParams chịu trách nhiệm encoding, không ghép query strings. Override sai hoặc lặp hiển thị default an toàn mà không tự rewrite URL khi render.

Theo ruling Supervisor, vehicleType chỉ là URL/UI boundary; không thêm vào TripSearch, query key, HTTP repository hay MSW endpoint. TripResultsPage đã mount TripFilters trên /trips, lọc/sort trên array mới từ readonly Query data; server sort/core validation vẫn theo contract hiện có. setSearchParams nhận params clone và giữ core/entry khác. Đổi loại xe không tạo request mới khi core/sort không đổi.

TripResultsPage từ chối core/sort key lặp trước shared-schema safeParse. Invalid/missing/same-route/past date có PageState và Tìm lại chuyến về /; hook chỉ mount khi core hợp lệ. Loading có status, lỗi có copy an toàn + Thử lại/Sửa tìm kiếm, empty có Sửa tìm kiếm và vẫn giữ filters để reset. Success hiển thị h1 theo route domain, số kết quả và danh sách TripCard. Plan04 Task3: Chọn chuyến available gọi create-session mutation qua typed repository, lưu validated draft trước SPA navigation bằng bookingSeatsPath(sessionId). Pending hiển thị status và selected CTA aria-busy; mọi card bị khóa. Failure giữ /trips và prior draft, role=alert có copy an toàn cùng retry hoặc link sửa tìm kiếm. Sold-out không tạo request. Hook nằm trên ResultsList URL-key remount nên sort/filter không mở khóa pending hoặc tạo key mới. Guard/noindex hiện có được giữ; trang chọn ghế vẫn là placeholder, chưa có SeatMap/countdown.

Supervisor duyệt giữ metadata /trips công khai hiện có trong Task9: Tìm chuyến | BLUE và description chung, không thêm loader/request chỉ để SEO. Metadata theo tên điểm đi/đến vẫn là enhancement thuộc acceptance metadata/SEO hiện có của TASK011; chưa khẳng định đã triển khai.

## Phạm vi khung route hiện tại

Plan 02 khởi tạo các route canonical bằng Framework Mode; Plan04 Task10 thêm `/account/tickets` dưới customer-session guard và Task11 triển khai `/bookings/:bookingCode/cancel`. Chỉ `/` được prerender; các route khác dùng SPA fallback. Guard hiện có cho admin, customer account và booking/payment preparation; trang hủy tự quyết định guest/account authority qua typed resource trước khi hiển thị dữ liệu.

Plan06 Task8 khóa tên fallback thực tế là `build/client/__spa-fallback.html` qua `pnpm verify:build`. Static-host verification phục vụ artifact này cho route không có file vật lý và đã xác nhận direct navigation `/trips`, `/booking/invalid-session/seats` và `/admin/bookings` tải ứng dụng rồi áp dụng validation/guard tương ứng, không trả server404. Hosting thật phải cấu hình rewrite tương đương tới fallback này.

Catch-all `*` nằm dưới CustomerLayout, hiển thị 404 có link về `/` và `noindex, nofollow`. Trong SPA, trạng thái này không tự đặt HTTP status của hosting thành 404. Root ErrorBoundary phân biệt lỗi 403/404 và lỗi không xác định, có nội dung tiếng Việt/link phục hồi/noindex, không hiển thị payload, message hoặc stack nội bộ. Admin customer-role nhận 403 trước khi render AdminLayout; guest/hết hạn chuyển `/login`. Booking thiếu/sai hoặc hết hạn ngoài exact seat route chuyển `/trips?reason=expired`, không tạo route expired riêng. Riêng draft hết hạn có sessionId khớp tại exact `/booking/:sessionId/seats` vẫn mount seat frame để modal phục hồi có ngữ cảnh; mọi passenger/review/payment/mismatch/invalid state tiếp tục fail-closed.

Plan06 Task5 gom metadata của toàn bộ 25 leaf route qua `createMeta`: tiêu đề nhận hậu tố `| BLUE`, mọi trang có description tiếng Việt. Admin/auth/booking/payment, chi tiết vé/hủy vé và 404 dùng `noindex, nofollow`; `/`, `/trips`, `/tickets/lookup` có metadata công khai. `robots.txt` cho phép crawl public content và chặn các họ route `/admin/`, `/account/`, `/booking/`, `/bookings/`, `/payment/`. Chỉ `/` được prerender; chưa tạo canonical hoặc sitemap URL vì chưa có production domain.
## Seat route — Plan 04 Task 5 (current)

`/booking/:sessionId/seats` now delegates to SeatSelectionPage rather than a placeholder; existing guard and noindex metadata remain. Results forwards canonical passengerCount into session creation. Successful exact-count selection navigates via bookingPassengersPath(sessionId), now implemented by Task6 below.

## Passenger route — Plan 04 Task 6 (current)

`/booking/:sessionId/passengers` delegates to PassengerDetailsPage under the unchanged BookingSessionRoute and CustomerLayout. Metadata remains Thông tin hành khách | BLUE, description and noindex/nofollow. useSeats restores trusted trip/seat codes; invalid layout/selection gets recovery to bookingSeatsPath. Valid form PUTs contact/passengers, commits the full verified draft and SPA navigates via bookingReviewPath. Review remains a placeholder for Task7; no booking/payment request is made.

HOLD_EXPIRED và countdown expiry tại exact matching seat route giữ draft mounted cho tới khi hành khách chọn hành động phục hồi. Modal seat route giải phóng hold và xóa draft ngay trước SPA navigation bằng canonical search params; đóng modal cũng thực hiện cùng recovery an toàn. Clock/guard expiry ở route khác vẫn dùng bare fail-closed recovery. Initial/background query failure và retry giữ safe state; background failure giữ dữ liệu đang nhập mounted.

Results handles `reason=expired` before core-search validation/useTrips. Bare guard redirects offer Home recovery; page-triggered expiry with validated Trip metadata preserves only canonical route/date/passenger params using URLSearchParams and the Vietnam service date. Recovery does not make an incomplete trips query and clears the old draft. Server holds release through repository GET, never UI mock access. These statements supersede the earlier Task3 placeholder description.

## Review route — Plan 04 Task 7 (current)

/booking/:sessionId/review now delegates to BookingReviewPage under existing CustomerLayout/BookingSessionRoute. Named meta remains Kiểm tra đặt vé | BLUE, description and noindex/nofollow. The page renders one matching business h1, trusted journey/operator/schedule/pickup, seat/passenger/contact review, mock policy and original countdown/fare total. Invalid/missing contact/selection fails closed with recovery, no POST; layout loading/error has retry.

Confirm uses the existing typed repository/mutation; key persists before POST, verified success stores bookingId before SPA paymentVnPayPath(bookingId). /payment/:bookingId/vnpay still contains the Task8 placeholder and has unchanged matching-ID/expiry guard. Back/refresh review of an already-created booking removes edit links, shows a locked notice and replays/resumes the same booking. Direct seat/passenger routes after creation show locked recovery. No new route, payment call, query PII or attempt key is introduced.

## VNPay checkout / public callback — Plan 04 Task 8

Existing /payment/:bookingId/vnpay now delegates to VnPayPage under the unchanged matching-booking/original-expiry guard. It shows trusted summary, only VNPay and normal pay/cancel; four labelled scenarios are dev/test only. Existing /payment/vnpay/return delegates to VnPayReturnPage outside BookingSessionRoute, so successful refresh works after draft clearing. Both export existing Vietnamese metadata and noindex,nofollow.

paymentReturnPath(transactionId,resultId) uses URLSearchParams. Callback accepts exactly those two unique opaque IDs, never status/PII; invalid query does not fetch. Safe loading/error/retry/not-found/expired recovery and four Vietnamese result headings are implemented. Pending explicitly rechecks; failed/cancelled retry only with matching live draft. Success links via canonical ticketPath and lists issued summaries; Task9 implements ticket detail/lookup with separate access validation below. Expiry uses existing public Results recovery, whose generic public metadata remains unchanged.

## Tra cứu / vé điện tử — Plan04 Task9

Existing /tickets/lookup thindelegate TicketLookupPage (public metadata hiện có), form POST body-only proof, canonical ticketPath sau validated stored access. Existing /tickets/:ticketCode thindelegate TicketDetailPage (static title/description, noindex,nofollow). Không thêm token/proof/query param hay route mới. Payment ticket link chưa có grant hiển thị Cần xác thực để xem vé và CTA /tickets/lookup; không suy ra quyền từ mã vé.

Detail waits SSR-safe access hydration, kiểm tra code thuộc grant rồi mới GET header token. Loading/error/retry/not-found/missing/expired/malformed recovery không echo raw input. Expiry timer/focus và server401/410 xóa quyền/cache. Card hiển thị một issued ticket/seat/passenger cùng canonical route, payment reference và liên kết các vé cùng scope. Account access/history/cancel còn downstream; không link chức năng chưa có.

## Auth và account history — Plan04 Task10

`/login`, `/register`, `/forgot-password` delegate tới auth pages thật dưới CustomerLayout và giữ `noindex,nofollow`. Login nhận intended route trong router state, sanitizer chỉ trả canonical local route; customer fallback `/account/tickets`, admin fallback `/admin/organizations`. Customer tới admin nhận403; admin tới account nhận403. Register/forgot success vẫn ở route hiện tại với neutral copy và link login.

`/account/tickets` nằm dưới CustomerSessionRoute, chờ SSR-safe hydration, yêu cầu customer session có opaque token và giữ intended route khi redirect login. Trang `noindex,nofollow`, filter hỗ trợ all/issued/cancelled, có loading/empty/error/retry/logout và link canonical tới detail/hủy vé khi còn issued. `/tickets/:ticketCode` chọn account header khi customer session hợp lệ, nếu không giữ nguyên guest lookup flow Task9; hai cơ chế không downgrade lẫn nhau.

## Hủy vé một phần — Plan04 Task11

`/bookings/:bookingCode/cancel` delegate tới CancellationPage và luôn `noindex,nofollow`. Route không có query authority: bookingCode chỉ chọn resource; page phải có guest lookup token scope đúng vé hoặc customer session sở hữu vé. Invalid/missing code/access hiển thị phục hồi an toàn, không fetch/render private data từ mã đơn lẻ.

Trang tải các vé issued có thể hủy, hỗ trợ none/A01/A02/both, mở Radix confirm với exact ticket code và ước tính mô phỏng100%. Thành công chuyển sang cùng route với processing refund state; guest/account detail và history đọc lifecycle từ server mock sau refresh. Không có route refund completion hoặc callback ngân hàng; Task12 chưa bắt đầu.

## Organization routes — Plan05 Task6

Plan05 Task6 mount trang tổ chức thật tại `/admin/organizations` và `/admin/organizations/:organizationId` dưới admin guard hiện hành. List sở hữu `query`, `status`, `page`, `pageSize`; create dùng `?dialog=create`, detail edit dùng `?dialog=edit`. Đóng hoặc lưu thành công chỉ xóa `dialog`, giữ nguyên các query key an toàn khác; detail 404 được tách khỏi lỗi tải có retry.

## Staff routes — Plan05 Task7

`/admin/staff` và `/admin/staff/:staffId` nay delegate tới Staff list/detail thật dưới admin guard. List dùng canonical `query`, `organizationId`, `status`, `page`, `pageSize`; create dùng `?dialog=create`, detail edit dùng `?dialog=edit`. Đóng hoặc mutation thành công chỉ xóa `dialog`, giữ filters/page và param ngoài ownership; list có loading/empty/error+retry, detail tách 404 khỏi lỗi tải. Không thêm route form riêng hoặc route giao dịch Task8.

## Transaction routes — Plan05 Task8

`/admin/bookings`, `/admin/payments`, `/admin/refunds` và ba route `/:id` tương ứng nay mount sáu page read-only dưới admin guard, đều có `noindex,nofollow`. List dùng shared canonical URL filters/pagination và row link; detail hiển thị relationship ID có link khi contract hỗ trợ. List tách loading/empty/403/generic error; detail tách loading/403/404/generic error. Nút retry chỉ có trên lỗi retryable. Task8 không thêm mutation hoặc route mới.

Plan05 Task9 xác minh toàn bộ admin routes qua browser ở1440×900 và360×800. Navigation desktop và mobile drawer đều giữ guard; list/detail/dialog giữ canonical URL state; transaction 403 không retry và lỗi dịch vụ có retry. Không thêm route mới.

## Organization/Staff fidelity — Plan07 Task8 (chờ Supervisor)

`/admin/organizations/:organizationId?view=members` là biến thể member view cùng resource, có status filter URL-owned. Thêm thành viên dùng `dialog=create-member`; sửa dùng `dialog=edit-member&staffId=...`. Đóng/lưu chỉ xóa keys dialog và staffId, giữ view/filter/param ngoài ownership. Staff list `dialog=create` và detail `dialog=edit` quản lý membership bằng nhà xe/nhân viên cố định khi sửa, role/status/reason; tài khoản PLATFORM_SUPPORT dùng cùng query để quản lý quyền nền tảng, không tạo membership nhà xe.

Mapping exact31node, fixture và từng ảnh1440/360 nằm trong [Task8 ledger](../quality/TASK8_ADMIN_FIDELITY_LEDGER.md). Navbar active luôn theo route: Staff URL giữ Nhân viên kể cả năm Figma backdrop có underline Đơn đặt vé sai ngữ cảnh (ruling Supervisor).

Admin header account là dialog thuộc shell quản trị, không navigate vào Customer-only account history. Đăng xuất dùng session boundary hiện có, clearadmin Query cache và replace tới `/login`; open state không tạo route/profile mới.
