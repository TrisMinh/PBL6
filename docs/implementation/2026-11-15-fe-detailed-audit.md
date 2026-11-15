# Báo cáo bàn giao FE Travel v3 — 15/11/2026

## 1. Kết luận dành cho chủ dự án

**FE web đã có nền tảng và phần lớn màn hình, đang ở giai đoạn tích hợp và hoàn thiện giao diện live; chưa đạt điều kiện nghiệm thu toàn bộ Travel v3.** Customer là nhóm có luồng đầy đủ nhất. Operator đã nối nhiều nghiệp vụ vào presentation riêng. Admin vẫn là khoảng trống lớn: bản mock có màn theo Figma, nhưng live chuyển sang bảng/detail/form chung.

Không nên giao tiếp tiến độ bằng một tỷ lệ duy nhất. Có ba mức khác nhau: đã có giao diện, đã có code gọi BE, và đã chứng minh chạy đúng với BE thật. Repo đạt hai mức đầu ở nhiều chức năng; đợt kiểm tra này chưa chứng minh mức thứ ba cho toàn bộ hệ thống.

Điểm chặn hiện tại: **21 lỗi ESLint; 16/1.408 unit/integration test lỗi; 8/24 browser fidelity check lỗi; bộ live contract chưa chứng minh được hành trình hoàn chỉnh**. Build và TypeScript qua không có nghĩa UI/luồng nghiệp vụ đã được nghiệm thu.

## 2. Phạm vi và phương pháp

- Nhánh: `codex/fe-be-integration`, HEAD nền `0bae8172`. Giữ nguyên các thay đổi gỡ backoffice tạm của lượt trước; không sửa tính năng FE trong đợt audit.
- Thiết kế online: [Travel v3](https://www.figma.com/design/OCkWSOZQ8Pq8AejXccajpO/Travel-v3). Đã đọc metadata Customer Desktop `7:5`, Operator Desktop `7:7`, Admin Desktop `7:11`, Customer App `7:6`, Driver App `7:10`.
- Dùng `figma-design-to-code`: lấy design context kèm ảnh ở Seat Map `29:103`, Operator Schedule `700:164`, Admin Bookings `1187:878`; lấy thêm ảnh Home `128:870`. Dùng `figma-use` cho đọc cấu trúc file, không sửa canvas.
- Kiểm tra source, route, repository, session, shared API, test và tài liệu. Inventory tự sinh gồm **56 module route/layout/guard, 33 module có nhánh mock/live, 17 module route dùng trang quản trị/vận hành live chung**. Các con số này đếm file, không đếm số màn hoàn thành.
- Đã cài frozen lockfile bằng Node `24.22.0` / pnpm `10.34.7` qua npm exec; không đổi phiên bản Node/pnpm toàn máy.
- Chụp 6 trường hợp live UI: Home, Admin Bookings, Operator Bookings tại 1440 và 360px. API bị intercept bằng fixture kiểm soát, không dùng tài khoản/giao dịch thật.
- Chạy typecheck, lint, full unit/integration, production build, browser fidelity tại 360/1440 và live contract test. Không chạy toàn bộ E2E ở cả 5 viewport; không chạy Lighthouse/axe toàn hệ thống hay native app build.

Tất cả frame mẫu, trạng thái, record và modal trong Figma không tương ứng một-một với route. Các frame Legacy/Archive/QA không được tính là tính năng sản phẩm còn thiếu. Metadata và Plugin API có số child khác nhau trong kết quả trả về; vì vậy không lấy tổng số frame làm mẫu số tính phần trăm.

## 3. Customer web — tracking theo luồng

| Nhóm màn / Figma | Route hoặc implementation | Đã có | Phần còn lại / giới hạn |
|---|---|---|---|
| Home `128:870` | `/`, HomePage, SearchForm, PopularRoutes | Hero, logo/asset, search, cam kết, tuyến, trust, hỗ trợ, footer; live dùng tuyến API | Có sai lệch geometry desktop trong check hiện tại. Dữ liệu rỗng làm section tuyến khác ảnh mẫu là trạng thái dữ liệu, không phải thiếu component |
| Search `28:30` | `/trips`, TripResultsPage | Tìm chuyến, lọc, sắp xếp, trạng thái tải/lỗi/rỗng, CTA | 2 unit test tìm chuyến lỗi; browser 360/1440 không đạt `white-space` của tên nhà xe |
| Đăng nhập `64:427` | `/login`, backendAuthRepository | API login, xử lý khóa/rate limit, redirect theo workspace và intended URL | Google/Facebook live chưa hỗ trợ; không tính nút hiển thị là đã tích hợp OAuth |
| Đăng ký `64:431`, quên mật khẩu `64:435` | `/register`, `/forgot-password` | Có form và API 202, không giả báo đã hoàn tất tài khoản | Chưa kiểm thử gửi email/hoàn tất xác minh với dịch vụ thật trong audit |
| Xác minh/reset bổ sung | `/verify-email`, `/reset-password` | Có route và action API | Không có bằng chứng visual mới cho từng màn |
| Seat map `29:103`, `234:4` | `/booking/:sessionId/seats`; thêm `/trips/:tripId/seats` | Có sơ đồ, lựa chọn, mapping inventory, session và deep link sau login | Cần kiểm chứng đủ loại xe/inventory thực tế. Không lấy 2 loại mock làm bằng chứng mọi layout BE đúng |
| Conflict / expired / limit `29:223`, `29:267`, `238:65` | SeatSelectionPage và repository | Có state và test trong repo | Chưa chạy tình huống 2 trình duyệt tranh ghế với BE thật; phải phân biệt thời hạn draft local với hold thật |
| Passenger `30:344` | `/booking/:sessionId/passengers` | Form hành khách, validation, session, liên hệ | Desktop fidelity check lệch x 7,5px; 360px trong bộ check qua |
| Review `30:416` | `/booking/:sessionId/review` | Điểm đón/trả, quote, payment channel, hold rồi tạo booking; pay-later theo chính sách | Cần chứng minh retry/idempotency, hết hạn và thay giá với BE; desktop geometry chưa qua |
| Checkout `561:306` | `/payment/:bookingId/vnpay`, BackendPaymentPage, LiveCheckoutView | Đọc đơn, deadline, payment method, tạo payment và redirect; recovery/access notice | 4 unit test payment lỗi nhưng test vẫn seed query key cũ; chưa thể kết luận timer sản phẩm hỏng. Cần cập nhật kiểm thử rồi nghiệm thu lại |
| Return `30:469`, `74:462` | `/payment/vnpay/return` | Poll/recheck từ BE, success/failure/cancel/recovery | Các text containment check qua; geometry desktop processing chưa qua; chưa kiểm thử VNPay/webhook thật |
| Vé đã phát hành `30:489` | `/tickets/:ticketCode`, LiveTicketDetailPage | Có live detail/QR/trạng thái, route mock/live riêng | Desktop geometry chưa qua; chưa xác nhận quét QR với hệ thống thật |
| Vé/đơn của tôi, tra vé | `/account/tickets`, `/tickets/lookup` | Có live account, booking/ticket lists và mở lại checkout | Lookup live giới hạn vé/đơn của người đang đăng nhập; không tương đương tra cứu khách vãng lai |
| Hủy/hoàn `1109:311`, `1112:*`, `1046:140` | `/bookings/:bookingCode/cancel`, `/refunds/:refundId` | LiveCancellationPage, LiveRefundPage; preview phí/version, gửi yêu cầu, theo dõi | Nhận yêu cầu hủy không đồng nghĩa đã hoàn tiền. Cần nghiệm thu flow thực tế và state async |
| Explore bổ sung | `/explore`, `/explore/:provinceSlug` | Có `/api/v1/explore/routes` và UI live | Theo mapping repo không có canonical Figma frame; không đánh dấu pixel-match |

**Khác biệt nghiệp vụ cần chốt:** draft nhập liệu chưa phải hold BE. Source có cơ chế tạo hold khi xác nhận; trong khi thiết kế seat map mô tả countdown giữ ghế. Đây là điểm cần kiểm tra copy/state chính xác để khách không hiểu nhầm ghế đã được giữ. Không khẳng định là bug khi chưa đối chiếu toàn luồng live.

## 4. Operator web — tracking chi tiết

| Nhóm / node Figma đại diện | Route | Implementation live / tiến độ | Còn thiếu |
|---|---|---|---|
| Schedule `700:164` | `/operator/trips` | LiveOperatorSchedule, reuse ScheduleCard; có dữ liệu API, resource lookup, thông báo mở bán | Chưa visual-review mọi filter/state live theo Figma |
| Create `764:8` | `/operator/trips/new` | TripEditor thay form tạo chuyến tạm; có chọn tài nguyên và datetime | Nghiệm thu tạo chuyến với BE thật, validation/conflict và dữ liệu resource |
| Review/publish `1118:253`, `688:151`, `1129:233` | `/operator/trips/review` | TripReview, workflow, kiểm tra inventory trước thông báo mở bán | Chưa browser-test xung đột xe/tài xế và publish chậm với BE |
| Edit draft `1130:234`, `1130:428` | `/operator/trips/draft/edit` | Dùng workflow/editor mới | Chưa chứng minh toàn bộ state reassigned/conflict đúng với thiết kế |
| Trip detail `779:9` | `/operator/trips/:tripId` | BackendTripDetailPage, API detail và action vận hành | Live vẫn là presentation chung; chưa thay bằng TripDetailPage của mock/Figma |
| Recent bookings `786:10` | `/operator/bookings` | BackendOperatorPage resource bookings; xem payment/refund | Có dữ liệu nhưng khác presentation Travel v3; đã chụp bằng chứng desktop/mobile |
| Trip passenger lists `786:456` | `/operator/bookings/trips` | BackendOperatorPage resource passengerTrips | Cần nối data vào màn Figma riêng |
| Manifest `788:12` | `/operator/bookings/trips/:tripId/passengers` | BackendManifestPage và check-in | Cần presentation Figma + nghiệm thu check-in/retry/quyền |
| Refund list `694:206` | `/operator/refund-requests` | BackendOperatorPage resource refunds | Thiếu bố cục/filter/summary đầy đủ của Figma live |
| Refund tracking `1016:223`, `1018:*` | `/operator/refund-requests/:bookingCode` | BackendRefundDetailPage | Các hồ sơ mẫu phải map bằng dữ liệu thật vào template; chưa dùng presentation mock đầy đủ |
| Routes `794:12`, `794:333`, `795:14` | `/operator/routes`, `/new`, `/:routeId/edit` | LiveRouteManagementPage, LiveRouteEditorPage; thêm/sửa route và stop modal riêng | Nhánh query `?stops` còn LiveRouteStopsEditor chung; cần test các thao tác thật |
| Add stop modal `800:15` | Trong route editor | Có LiveRouteStopModal | Chưa nghiệm thu đủ pickup/dropoff/sequence/time offset với BE |
| Vehicle variants `829:16`, `838:*`, `954:*` | `/operator/vehicles` | LiveVehicleManagementPage và mapping layout trong liveVehicleLayouts | Không được suy ra mọi biến thể hình xe trong Figma đã đúng; nhánh `?new`/`?edit` vẫn dùng LiveVehicleEditor chung |
| Drivers list `965:31` | `/operator/drivers` | LiveDriversPage gọi BE | Cần kiểm thử filter/status/dữ liệu thực tế |
| Add/edit driver `965:71`, `971:107` | `/operator/drivers/new`, `/:driverId/edit` | LiveDriverEditorPage, tạo/sửa/deactivate hồ sơ | Form dùng ID tài khoản có sẵn, ghi rõ chưa cập nhật thông tin cá nhân tại đây; chưa tương đương tất cả field/upload của mock |
| Reports `705:192` | `/operator/reports` | LiveReportsPage/LiveRevenueChart; gọi revenue/bookings, chọn khoảng thời gian, so sánh kỳ trước | Chưa đối chiếu số tiền/tổng hợp với DB thực tế, chưa nghiệm thu mọi control/chart |
| Organization/membership, settlement | `?view=organization`, `/operator/settlements` | Có profile/actions và bảng đối soát live | Không đồng nghĩa hoàn thành màn “Tổ chức & thành viên” của sidebar mock; settlement vẫn presentation chung |

Nguồn route xác nhận 7 module operator còn dùng nhóm Backend* chung: bookings, trip-passenger-lists, passenger-manifest, refund-requests, refund-tracking, trip-detail, settlements.

## 5. Admin web — khoảng trống chính

| Family Figma | Route | Mock | Live hiện tại |
|---|---|---|---|
| Organizations list/detail/create `1185:*` | `/admin/organizations`, `/:organizationId` | Có trang, modal và shared primitives theo Figma | BackendAdminPage/BackendAdminDetailPage; create dạng form chung trong details; có membership API/actions |
| Staff list/detail/member dialogs `1186:*`, `1215:*`, `1230:*`, `1234:*`–`1239:*` | `/admin/staff`, `/:staffId` | Có template và dialog cho record mẫu | Chuyển sang resource users, form quyền/thành viên chung; không phải toàn bộ staff UX trong Figma |
| Bookings `1187:878`, `1254:*`–`1256:*` | `/admin/bookings`, `/:bookingId` | Có presentation danh sách/chi tiết | Bảng chung và detail chung; thiếu projection khách hàng/nhà xe/ngày tạo trong list hiện tại |
| Payments `1248:782` và detail | `/admin/payments`, `/:paymentId` | Có màn theo Figma | Bảng/detail chung; có refund create và view settlement/payout bổ sung |
| Refunds `1248:841` và detail | `/admin/refunds`, `/:refundId` | Có màn theo Figma | Bảng/detail chung, link theo dõi refund |
| List/detail states `1269:*`, `1277:*` | Các route phía trên | Có loading/empty/error/forbidden/not-found family | Shared ApiFailure/ResourcePage thay presentation state Figma |
| Filters `1273:*` | Query/org/status trên list | Có URL-state filters trong mock | ResourcePage chỉ có search/status local; chưa tương đương org/query controls và URL behavior của Figma |

**10/10 module route admin list/detail hiện rẽ sang BackendAdminPage/BackendAdminDetailPage khi live.** Đây là đếm route list/detail đang tồn tại, không phải tỷ lệ công việc toàn admin.

Quan sát trực quan ở `/admin/bookings`: shell topnav gần thiết kế, nhưng phần giới thiệu chuyển vào card lớn; thêm eyebrow/Làm mới; không có bộ chọn nhà xe; bảng chỉ còn mã đơn/trạng thái/tổng/kênh thanh toán. Đây là thay đổi cấu trúc, không chỉ chênh vài px. Tại 360px live dùng bảng cuộn ngang bên trong, chưa phải labeled-card presentation được mô tả ở mock.

ResourcePage và getLiveRows hiện lấy lần lượt tất cả trang API `size=100`, sau đó search/filter và chia 12 hàng phía client. Không còn là phân trang tương tác hoàn toàn phía server như một số tài liệu cũ mô tả. Dữ liệu lớn có thể làm tải đầu lâu và giữ nhiều record trong bộ nhớ; cần đo và quyết định thiết kế, chưa có benchmark thực tế.

## 6. Customer App / Driver App

Travel v3 có hai page App riêng, không thể gộp thành tiến độ responsive của web.

- `workspace/src/apps/mobile` tồn tại: Expo/React Native với auth, search/results, chọn ghế, hành khách, payment/status, booking/ticket, profile, notifications. Đây là source tích hợp từ workspace, chưa có bằng chứng đã chuyển toàn bộ sang thiết kế Customer App Travel v3.
- App.tsx vẫn có tab tint cam `#ff6a00`; UI source dùng components/style riêng. Chưa build/chạy native app trong audit, nên không nghiệm thu giao diện, camera/deep link hay performance.
- Không tìm thấy flow màn tài xế riêng trong App.tsx hoặc `mobile/src`: lịch phân công, manifest, scanner camera, các state check-in, transition chuyến theo `35:*`, `1135:*`–`1168:*` của Figma. Việc operator có LiveTicketCheckIn không thay thế Driver App.
- README FE web cũ loại native app/driver ra khỏi phạm vi. Nếu chủ dự án chỉ nghiệm thu web thì App là phạm vi cần quản lý riêng; nếu nghiệm thu toàn Travel v3, đây là khối chưa được chứng minh hoàn thành.

## 7. Kết quả kiểm tra mới, không dùng kết quả lịch sử

| Kiểm tra | Kết quả | Diễn giải |
|---|---|---|
| Frozen dependency install | Qua | Node 24.22.0 / pnpm 10.34.7; Husky báo không thấy `.git` ở root app, cần kiểm tra lại hook khi tích hợp monorepo |
| Typecheck | Qua | `react-router typegen && tsc --noEmit` |
| Production build | Qua | Build client/server và 2/2 prerender test; không thay thế verify-static-build/deploy |
| ESLint | **21 lỗi, 0 warning** | Lỗi return type, setState trong effect, unused import, Fast Refresh export |
| Unit/integration | **1.392 qua / 16 lỗi; 158 file qua / 9 file lỗi** | Tổng 1.408 test, 167 file |
| Browser fidelity mock 360/1440 | **16 qua / 8 lỗi** | Sau khi cài Chromium đúng phiên bản; lần chạy đầu thiếu browser được coi là lỗi môi trường, không tính là regression UI |
| Live UI capture | **6/6 render**, không pageerror, không document overflow | 3 trang × 2 widths với intercepted HTTP; không chứng minh BE thật |
| Live contract browser | **0/1 qua, tái hiện 2 lần** | Đã login và tới trang tài khoản; test chờ heading cũ nên dừng trước booking/payment. Đây chưa phải bằng chứng login sản phẩm lỗi |

### 7.1 Phân loại 16 unit test lỗi

| Nhóm | Số | Nhận định từ source/log |
|---|---:|---|
| Route inventory / refund export | 2 | Expected route count 30 vs actual 31; refund re-export không phù hợp cách test inspect module. Cần đồng bộ contract test với route mới, không suy ra khách truy cập không được |
| Home same-route validation | 1 | Kỳ vọng validation/navigation chưa qua; cần tái hiện qua UI |
| Search sort/filter/reset | 2 | Số card 3 thay vì 2, số request 2 thay vì 1; cần kiểm tra logic filter và kỳ vọng sau chỉnh search |
| Payment | 4 | Test seed cache key cũ `['live-api','booking',id]`, production dùng `liveQueryKey` thêm user/session. Vì vậy test có thể không nạp dữ liệu seed. Chưa kết luận timer/checkout hỏng |
| Focus menu customer/admin | 2 | `toHaveFocus` không đạt; cần tái hiện keyboard trong browser trước khi kết luận lỗi accessibility thực tế |
| Semantic tokens | 3 | SearchForm.css, TripCard.css, AuthShell.css còn primitive màu/shadow, trái contract test |
| Outline/focus style | 1 | NotificationBell.css bị test bắt outline none. Cần kiểm tra style thay thế thực tế, không đánh đồng regex fail với chắc chắn mất focus |
| robots policy | 1 | Log có CRLF, expected LF; nghiêng về test phụ thuộc xuống dòng Windows, chưa phải lỗi SEO sản phẩm |

### 7.2 Browser fidelity: lỗi xác định được

- Search card tên nhà xe: expected `white-space: nowrap`, actual `normal` ở cả 360 và 1440.
- Sáu check geometry desktop Home, Passenger, Review, Checkout, Payment Processing, Ticket đều lệch trục x **7,5px** so với contract ±1px. Cùng một độ lệch có thể xuất phát container/scrollbar/viewport chung; chưa xác định nguyên nhân, không tính là sáu thiết kế bị thiếu độc lập.
- Các check mobile của Home/Passenger/Review/Checkout/Payment/Ticket và text containment payment-return qua. Đây là kiểm tra geometry/state được viết sẵn, không phải pixel diff mọi màn Figma.

### 7.3 Hiệu năng và khả năng bảo trì

- 4 PNG tuyến phổ biến trong build khoảng 2,27–2,63 MB/file; cần xem xét tối ưu ảnh/delivery đúng asset. Chưa đo LCP/CLS nên không kết luận Core Web Vitals đạt hay trượt.
- Shared session/client đã có phân biệt cache theo user/session, refresh và idempotency; đây là nền tích hợp tốt nhưng test payment chưa theo kịp thay đổi query key.
- `z.record(z.string(), z.unknown())` được dùng rộng ở generic resources; các DTO chưa chặt bằng feature schemas. Cần kiểm tra projection/nullability/fields khi thay bảng chung bằng màn Figma.
- UI mock/live tách component trên nhiều route khiến bản mock đẹp không tự bảo đảm bản production giữ được giao diện đó.

### 7.4 Giải thích live contract test lỗi

Chạy lại khi build đã kết thúc vẫn fail cùng assertion `getByRole('heading', {name:'Vé của tôi', exact:true})`. Snapshot lỗi cho thấy tài khoản đã đăng nhập và trang có heading **“Những hành trình của tôi”**; “Vé của tôi” hiện là **button chọn tab**, không còn là heading. Đây là test đã lỗi thời so với LiveAccountPage. Snapshot còn có lỗi profile do fixture test không bao phủ đầy đủ request mới. Cần cập nhật fixture/locator, rồi chạy tiếp tới payment/cancellation; không suy ra bước sau đang đúng hoặc sai khi test chưa tới được.

Source CustomerLayout.css có `scrollbar-gutter: stable`; đây là một nghi vấn có cơ sở cho độ lệch desktop 7,5px lặp lại. Chưa thử thay CSS vì audit không sửa sản phẩm và chưa xác nhận quan hệ nhân quả.

## 8. Backlog đề nghị để FE tiếp tục

| Ưu tiên | Công việc | Điều kiện hoàn thành |
|---|---|---|
| P1 | Nối data live vào presentation admin hiện có | 5 family list/detail giữ cấu trúc Travel v3, org/query/status hoạt động, loading/403/404/error đúng và API projection có test |
| P1 | Hoàn thiện presentation operator còn chung | Trip detail, bookings, passenger lists/manifest, refund list/tracking có UI Figma và action BE |
| P1 | Khôi phục quality gate | Sửa 21 lint; phân loại/sửa 16 test; browser geometry/name wrap qua; không chỉ xóa assertion |
| P1 | Nghiệm thu đặt vé thật | Login → search → seats → hold → booking → VNPay return → ticket → cancellation/refund với BE thật; thêm conflict/expiry/retry và phân quyền |
| P2 | Nghiệm thu resource workflow | Tạo/sửa tuyến/stop, xe/seat layout, driver; field chưa hỗ trợ có copy đúng và không giả thành công |
| P2 | Responsive và accessibility live | Kiểm tra 360/768/1024/1440/1920 cho các route thay presentation; keyboard drawer/dialog/filter và table/cards |
| P2 | Hiệu năng danh sách/ảnh | Quyết định server pagination/filter và tối ưu delivery PNG; đo trước/sau |
| P2 | Đồng bộ tài liệu và tracking | README bỏ mock-only; BACKEND_INTEGRATION cập nhật đúng code; TODO tách UI/mock/live/acceptance |
| Theo phạm vi sản phẩm | Customer App / Driver App | Chốt phạm vi riêng và nghiệm thu native; không báo đã làm chỉ vì Figma có frame hoặc API có endpoint |

## 9. Bằng chứng có thể kiểm tra lại

- [Inventory Figma](fe-audit-2026-11-15/figma-inventory.json), [Inventory route](fe-audit-2026-11-15/route-inventory.json).
- [Unit/integration log](fe-audit-2026-11-15/unit-tests.log), [ESLint log](fe-audit-2026-11-15/lint.log), [Build log](fe-audit-2026-11-15/build.log), [Browser fidelity log](fe-audit-2026-11-15/fidelity-browser.log).
- [Live contract chạy lại](fe-audit-2026-11-15/live-browser-recheck.log), [snapshot lỗi live](fe-audit-2026-11-15/live-contract-error-context.md).
- [Live capture data](fe-audit-2026-11-15/live-capture.json), [script tái lập](fe-audit-2026-11-15/capture-live.mjs).
- Admin: [Figma](fe-audit-2026-11-15/figma-admin-bookings.png), [live 1440](fe-audit-2026-11-15/live-admin-bookings-1440.png), [live 360](fe-audit-2026-11-15/live-admin-bookings-360.png).
- Home: [Figma](fe-audit-2026-11-15/figma-home.png), [live 1440](fe-audit-2026-11-15/live-home-1440.png); live capture dùng danh sách tuyến rỗng có chủ đích.
- Operator: [Figma schedule](fe-audit-2026-11-15/figma-operator-schedule.png), [live bookings](fe-audit-2026-11-15/live-operator-bookings-1440.png). Đây là hai route khác nhau, không dùng làm cặp pixel diff.

Báo cáo này thay thế đánh giá sơ bộ trước khi kết nối Figma và cài dependencies. Không commit/push trong đợt audit. Không chỉnh sửa thiết kế Figma, API backend, hay logic sản phẩm FE để làm test qua.
