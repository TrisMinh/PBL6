# Mapping màn hình Figma

**File:** Travel v3 · `OCkWSOZQ8Pq8AejXccajpO`  
**Customer page:** `7:5` · **Admin page:** `7:11`

## Customer canonical

TASK-014 thêm `/explore` và `/explore/:provinceSlug` theo yêu cầu user; **không có canonical Figma frame**, không gán node hoặc claim pixel-match. Hai trang reuse BLUE shell/logo/tokens; route/component/CSS/layout/data provenance và evidence nằm trong [EXPLORE.md](./EXPLORE.md). Header mapping hiện hành: Trang chủ `/` exact, Khám phá `/explore`+descendants, Điểm đến `/trips`, Vé xe `/tickets/lookup`; query không tạo active trùng.

| Node | Frame | Route/component | Trạng thái | Bằng chứng viewport |
|---|---|---|---|---|
| `128:870` | Home / Guest | `/` — full HomePage | Worker remediation ready; Supervisor verdict pending | Figma + implementation full-page `w1440`; implementation `w360`; fidelity/visual `w360/w1440`; responsive `w360..w1920` |
| `28:30` | Search / Results | `/trips` — validation, states/retry, filters và TripCard | Implemented + verified | visual `w360/w1440`; responsive `w360..w1920` |
| `29:103` | Seat Map / Sleeper 34 | `/booking/:sessionId/seats` | Implemented + verified | visual `w360/w1440`; critical E2E |
| `234:4` | Seat Map / Cabin 22 | cùng route, vehicle variant | Implemented + verified | visual `w360/w1440`; responsive `w360..w1920` |
| `29:223` | Seat conflict rollback | cùng route, conflict state | Implemented + verified | visual `w360/w1440`; critical E2E |
| `29:267` | Hold expired | cùng route, expired state | Implemented + verified | visual `w360/w1440`; critical E2E |
| `238:65` | Selection limit 6 | cùng route, limit state | Implemented + verified | functional E2E `w360..w1920` |
| `30:344` | Passenger Details | `/booking/:sessionId/passengers` | Implemented + verified | visual `w360/w1440`; responsive `w360..w1920` |
| `30:416` | Booking Review | `/booking/:sessionId/review` | Implemented + verified | visual `w360/w1440`; responsive `w360..w1920` |
| `561:306` | VNPay Checkout | `/payment/:bookingId/vnpay` | Implemented + verified | visual `w360/w1440`; responsive `w360..w1920` |
| `30:469` | Payment Return / Processing | `/payment/vnpay/return` | Implemented + verified | visual `w360/w1440`; critical E2E |
| `74:462` | Payment Return / Failed | cùng route, failed state | Implemented + verified | visual `w360/w1440`; critical E2E |
| `30:489` | Ticket Detail / Issued | `/tickets/:ticketCode` | Implemented + verified | visual `w360/w1440`; axe/responsive `w360..w1920` |
| `64:427` | Đăng nhập | `/login` | Implemented + verified | visual `w360/w1440`; functional E2E `w360..w1920` |
| `64:431` | Đăng ký | `/register` | Implemented + verified | shared AuthShell + functional E2E `w360..w1920` |
| `64:435` | Quên mật khẩu | `/forgot-password` | Implemented + verified | shared AuthShell + functional E2E `w360..w1920` |
| `1109:311` | Cancel A01+A02 | `/bookings/:bookingCode/cancel` | Implemented + verified | visual `w360/w1440`; critical E2E |
| `1112:324` | Cancel A01 | cùng route, selection state | Implemented + verified | functional E2E `w360..w1920` |
| `1112:463` | Cancel A02 | cùng route, selection state | Implemented + verified | functional E2E `w360..w1920` |
| `1112:602` | Cancel none | cùng route, empty selection | Implemented + verified | visual `w360/w1440`; functional E2E |
| `1112:741`, `1112:925` | Confirm cancellation | cùng route, confirm step | Implemented + verified | visual `w360/w1440`; critical E2E |
| `1046:140`, `1112:876`, `1112:1060` | Refund processing | cùng route, processing step | Implemented + verified | visual `w360/w1440`; critical E2E |

## Plan 04 Task 12 — E2E slice evidence

Playwright đi qua UI thật từ Home `128:870` → Results `28:30` → Seat Map `29:103` → Passenger `30:344` → Review `30:416` → VNPay `561:306` → success/ticket `30:489`. Conflict dùng hai booking session thật trên mock contract để tạo trạng thái `29:223`; hold expiry dùng fake clock trên `expiresAt` gốc cho `29:267`. Luồng được chạy tại exact1440×900 và360×800, kiểm tra không overflow ngoài ý muốn, action tối thiểu44px, focus, reduced motion, console/runtime và URL không lộ proof/PII. E2E aftersales tiếp tục phủ lookup và các frame cancel/refund đã mapping phía trên. Đây là bằng chứng hành vi, không phải tuyên bố pixel-match toàn frame.

## Plan 07 Task 1 — full Home fidelity remediation

Ngày 2026-10-24 Worker đọc exact Figma node `128:870` và screenshot bằng session `ab17283e-3aca-41ab-8439-c972913edcae`. Home hiện compose hero/search → product truths → popular routes → trust journey → support → editorial footer, dùng official logo node `163:11`, hero/trust crop node `128:875/128:964`, bốn route images `128:937/943/949/955` và leading icon `128:897/902/907/912` từ local assets. Bằng chứng, mismatch ledger và geometry nằm tại [`FIGMA_FIDELITY_AUDIT.md`](../quality/FIGMA_FIDELITY_AUDIT.md); verdict cuối vẫn do Supervisor đưa ra.

## Bằng chứng HomeHero Task 6 (superseded)

Official Figma context/screenshot đã đọc cho `128:870`, hero `128:874` và booking box `128:892` ngày2026-10-20. Asset bus tại node128:875 và dot16px tại128:897/902/907/912 được tải đúng từ asset URLs trả về, lưu local `src/assets/home/hero-bus.png` và `search-dot.svg`, không dùng screenshot như asset hoặc link tạm runtime. Hero giữ copy gốc, form dùng native controls, dot là background decorative đúng16px.

Ruling scope cũ chỉ áp dụng cho Task6 và đã bị Plan07 supersede. Official logo, Newsreader600 và toàn bộ lower sections nay thuộc implementation Task1 ở trên; đoạn Task6 này chỉ giữ làm lịch sử.

## TripCard Task 7 evidence

Đã đọc official get_design_context + screenshot Search/Results28:30 và child Trip result215:156 ngày2026-10-20. Component TripCard giữ hierarchy operator/vehicle → lịch trình/duration → ghế/fare → Chọn chuyến; thêm ngày Việt Nam hai đầu để rõ chuyến qua đêm. Supervisor duyệt Phosphor Bus/Ticket, operator initial text và CSS dashed line/dot thay prototype mark/Lucide assets; không tải asset mới hoặc dùng URL tạm runtime. Domain hiện có sleeper-34/cabin-22 thay nhãn Limousine trong prototype. Chưa dựng full Results/filter/sort/list route trong Task7.

## TripFilters Task 8 evidence

Task8 đã đọc lại official Results28:30 context + inline screenshot: Filters panel215:105 có Bộ lọc/Đặt lại/Loại xe, sort nằm cạnh result heading. Chỉ triển khai sort và optional vehicle domain theo plan; giữ token/native selects, desktop inline/mobile Radix bottom sheet. Departure-time/price/amenities và richer sidebar không thuộc Task8. Không asset mới, không claim Variables/fullframe pixel-match hoặc nối Results route trong task này.

## TripResults Task 9 evidence

Task9 đối chiếu lại official get_design_context28:30 và inline screenshot: heading theo tuyến, count thật và responsive TripCard grid1/2/3cột. Giữ accepted CustomerLayout/nav, TripFilters inline/mobile và domain/mock data; không dựng lại full top searchbox, richer sidebar hoặc pagination chưa có contract. Edit-search link về Home thay full searchbox Results. Generic public metadata giữ theo ruling; metadata động thuộc existing TASK011 SEO. CTA available chỉ thông báo accessible bản mô phỏng chưa hỗ trợ đặt vé, Plan04 thay handler; không POST/session/navigation booking. Browser thật đã kiểm tra cả năm width và states success/loading/error retry/empty/invalid. Không claim fullframe pixel-match, asset mới hoặc Variables verification.

## Admin canonical

Plan07 Task8 đang thay thế các ghi chú “shared template” của Organization/Staff bên dưới bằng [ledger31case](../quality/TASK8_ADMIN_FIDELITY_LEDGER.md). Mỗi exact node có fixture/URL/ảnh Figma/BEFORE/final riêng; mọi verdict hiện pending Supervisor. Không dùng một ảnh đại diện làm chứng cứ cho nhiều hồ sơ/modal.

| Node/family | Frame | Route/component | Trạng thái | Bằng chứng viewport |
|---|---|---|---|---|
| `1185:61` | Tổ chức / danh sách | `/admin/organizations` | Implemented + verified | visual `w360/w1440`; axe/responsive `w360..w1920` |
| `1185:760` | Chi tiết tổ chức | `/admin/organizations/:organizationId` | Implemented + verified | visual `w360/w1440`; axe/responsive `w360..w1920` |
| `1185:834` | Thêm tổ chức modal | `?dialog=create` | Implemented + verified | visual `w360/w1440`; keyboard focus E2E |
| `1186:764` | Nhân viên / danh sách | `/admin/staff` | Implemented + verified | route E2E `w360..w1920`; admin browser `360/1440` |
| `1186:778` | Chi tiết nhân viên | `/admin/staff/:staffId` | Implemented + verified | route E2E `w360..w1920`; admin browser `360/1440` |
| `1215:*`, `1230:*` | Các hồ sơ nhân viên mẫu | cùng detail route | Implemented + verified | shared detail template `w360..w1920` |
| `1234:272`, `1236:312`, `1237:*`, `1238:*`, `1239:*` | Thêm/sửa nhân viên modal | `?dialog=create|edit` | Implemented + verified | shared dialog, keyboard/admin E2E `360/1440` |
| `1187:878` | Tra cứu booking | `/admin/bookings` | Implemented + verified | visual `w360/w1440`; responsive `w360..w1920` |
| `1248:782` | Thanh toán / danh sách | `/admin/payments` | Implemented + verified | shared visual `w360/w1440`; responsive `w360..w1920` |
| `1248:841` | Hoàn tiền / danh sách | `/admin/refunds` | Implemented + verified | shared visual `w360/w1440`; responsive `w360..w1920` |
| `1254:*`, `1255:*`, `1256:*` | Chi tiết hồ sơ giao dịch mẫu | route detail tương ứng | Implemented + verified | shared detail template `w360..w1920` |
| `1269:*` | Loading/empty/error/forbidden | state của list route | Implemented + verified | visual `w360/w1440`; state E2E |
| `1273:*` | Query/org/status controls | filter component | Implemented + verified | admin E2E `360/1440`; responsive `w360..w1920` |
| `1277:*` | Loading/not found/error/forbidden detail | state của detail route | Implemented + verified | visual/shared state `w360/w1440`; state E2E |

Frame có tên `Legacy`, `BACKUP` hoặc `QA` không tạo route sản phẩm. Mỗi record mẫu map vào một route template, không tạo page riêng theo mã mẫu.

Plan05 Task4 cung cấp presentation primitive cho các family list ở trên: semantic table/caption trên desktop và cùng dữ liệu thành labeled cards dưới768px; `1269:*` dùng shared busy/empty/error contract. Primitive chưa được gắn vào resource route cho tới Task6+ và không thêm screen/route mới.

Plan05 Task5 triển khai family `1273:*` thành shared `AdminFilters`: query, organization, status, clear và pagination đều dùng URL state. Layout responsive360..1920 được định nghĩa bằng BEM/token CSS; resource-specific options và browser composition được nối từ Task6+, không tạo route/frame mới trong Task5.

Plan05 Task8 nối sáu route transaction thật với list nodes `1187:878`, `1248:782`, `1248:841` và detail samples `1254:814`, `1254:974`, `1254:1134` thuộc family `1254:*`–`1256:*`. Family `1269:*`/`1277:*` map thành loading/empty/error/forbidden/not-found riêng; 403/404 không retry. Shared table tự chuyển thành labeled cards dưới768px, detail grid về một cột, control/link tương tác tối thiểu44px và reduced-motion. Plan05 Task9 đã xác minh route thật tại360/1440; Plan06 tiếp tục responsive matrix ở đủ năm viewport. Không claim pixel/full-frame equivalence.

## Trạng thái lỗi dùng chung

Plan 02 dùng PageState cho catch-all `*` (404) và root ErrorBoundary (403/404/lỗi chưa xác định). Đây là state dùng chung với recovery link, không bổ sung màn hình nghiệp vụ hoặc route theo từng frame. Catch-all dùng CustomerLayout; không tạo trang `/403` hoặc `/404` riêng. Các flow canonical trong hai bảng đã được triển khai và xác minh; state dùng chung được phủ bởi unit/E2E tương ứng.

## Seat seeds Task 2 evidence — Plan 04

Official get_design_context responses and inline screenshots inspected for seat map29:103 (lower232:61,upper232:120) and cabin234:4. Sleeper A/B01..17 uses main3columns×4rows plus rear5; cabin A/B01..11 uses2columns×5rows plus rear1. Figma sold examples A09/B11 sleeper and B08 cabin retained. Prototype selected B01/B02 sleeper and A03 cabin are seeded available because selection belongs to sessions. HeldB07 and disabledB17/A11 are explicit mock state variations; per-trip additional sold seats reconcile canonical availability counts. No UI/asset was implemented/downloaded for this data task; no Variables verification or full-frame fidelity claim. Actual SeatMap/BookingSummary remains Task5.

## Results booking CTA — Plan 04 Task 3

Existing Results28:30/TripCard context is retained; this task only replaces deferred CTA with pending/error/retry behavior and navigation to the existing guarded29:103/234:4 seat route. Target route still has placeholder content; no SeatMap/countdown/new asset/full-frame or Variables claim. TripCard presentational hierarchy/token CSS is unchanged apart from explicit pending/disabled props; accessible feedback follows existing Button/PageState conventions.
## Plan 04 Task 5 design evidence

Official Figma MCP get_design_context returned design context and screenshots for29:103,234:4 and29:223. SeatSelectionPage/SeatMap/BookingSummary/SeatConflictDialog implement the seat slice: two decks, sleeper34/cabin22 geometry, state legend, trip strip, summary/countdown and conflict recovery. Canonical mock codes are A01/B01 etc; the modal uses actual conflict codes rather than prototype B2 placeholder. Approved deviations: retained accepted CustomerLayout/Phosphor/Seat primitive/semantic tokens; no fee row because the contract has no fee. Only header logo asset URL was returned and belongs to the retained shell; no new content asset created/downloaded. No Variables/full-frame claim. Passenger/review/payment are later tasks.

## Passenger details — Plan 04 Task 6 evidence

Plan07 Task4 reopened exact node `30:344` in Worker session `73528f2c-a6dc-40da-879f-fd7a18d1491c`, captured the complete 1440×1040 frame and made the exact passenger route own the frame without the generic footer. PassengerDetailsPage now follows the 820/430 desktop composition, per-seat identity cards, shared pickup, email/note delivery block and passenger summary; the complete content stacks below 1024 without horizontal overflow.

The visible user/mobile/mail/note/pin/chevron/bus/pickup marks are exact local exports under `src/assets/booking/passenger-review`, not Phosphor substitutes or temporary Figma URLs. RHF/Zod, the canonical booking session, selected-seat ownership and original countdown remain authoritative. Canonical operator/date/stops/fare replace the unrelated static prototype sample, and no unsupported service fee is invented. Final 1440/360 evidence and the node-to-file geometry ledger live in `FIGMA_FIDELITY_AUDIT.md`; verdict remains pending Supervisor acceptance.

## Booking review — Plan 04 Task 7 evidence

Plan07 Task4 independently reopened exact node `30:416` in the same Worker session and implemented its separate route-owned 1440×1040 frame. BookingReview now follows the 820/430 composition, operator journey timeline, masked passenger cards, shared pickup, policy hierarchy, confirmation notice and payment-oriented summary. Check-in is deterministically derived as 20 minutes before the canonical departure.

The bus/timeline/passenger/phone/pickup/policy/quote/verified marks are exact local Figma exports. The accepted BLUE logo remains shared through BrandLogo. Booking lock/idempotency, privacy masking, expiry ownership and VNPay-only flow remain unchanged; fee/promotion values absent from the canonical contract are not fabricated. Final evidence and per-case pending verdict are recorded in `FIGMA_FIDELITY_AUDIT.md`.

## VNPay checkout / return — Plan 04 Task 8 evidence

Official Figma MCP get_design_context for OCkWSOZQ8Pq8AejXccajpO nodes561:306,30:469,74:462 returned full context and inline screenshots, inspected directly. Checkout follows provider/transaction/safety panel with220px brand area and right summary, stacked below1024. Return follows wide ticket-style status/booking-code card, trusted journey/time/details and sidebar progress/recovery, stacked below768.

Supervisor-approved adaptations: keep accepted CustomerLayout/fonts/tokens and project Phosphor leaf icons; trusted fictional trip/operator instead of prototype RedLine; no invented service fee/promotion/method switch/history/automatic bank reconciliation. VNPay label is typography; returned generic shield/bus/status/progress SVGs reuse existing leaves/CSS semantics. No new asset required/created/downloaded. Pending has explicit recheck; success/cancel are additional required states. No fallback, Figma Variables verification or full-frame equivalence claim.

## Guest ticket detail — Plan04 Task9 evidence

Official Figma get_design_context fileOCkWSOZQ8Pq8AejXccajpO node30:489 trả full context và inline screenshot, đã đọc trực tiếp. TicketCard theo top accent/brand/status, route/date header, lộ trình hai đầu, facts grid và perforated/sidebar stub; mobile stacked, body split từ768, sidebar308px từ1024. Detail map /tickets/:ticketCode. Lookup không có canonical frame, dùng CustomerLayout/native Input/Button/tokens/BEM và ghi đây là adaptation, không claim Figma fidelity.

Supervisor duyệt giữ shell/fonts/leaf icons/CSS timeline/perforation thay returned generic SVGs, canonical mock journey/operator thay prototype RedLine. Một card là một issued Ticket/seat/passenger thay prototype gộp nhiều ghế. QR chỉ Phosphor marker có nhãn Minh họa mã vé — không dùng để quét, không payload/claim scan. Omit PDF/share/check-in-time/history/cancel vì chưa có contract. Không asset mới required/created/downloaded, không fallback/Variables/full-frame equivalence claim. Private proof/token không được đưa vào visual marker.

## Auth và account history — Plan04 Task10 evidence

Official Figma nodes `64:427`, `64:431`, `64:435` đã được đọc với context/screenshot. Login dùng email/password, provider buttons và public demo credentials; register dùng fullName/email/phone/password/confirm; forgot dùng email. Giữ CustomerLayout, fonts/tokens/logo; không thêm remember/phone login, legal link chưa có content route, story carousel hay verification workflow. Copy luôn nói rõ tài khoản/email là mô phỏng.

Sáu asset từ đúng auth nodes được lưu local tại `src/assets/auth`: `scenic-bus.png` (1,910,761 bytes), `backdrop.png` (1,664,198 bytes), `robot-happy.svg` (2,334 bytes), `robot-worried.svg` (2,336 bytes), `google.svg` (1,325 bytes), `facebook.svg` (668 bytes). Callsite là AuthShell/LoginForm; ảnh scenic chỉ hiện từ1024px, form responsive360..1920. `/account/tickets` không có canonical frame, là adaptation bằng CustomerLayout/shared Button/StatusBadge/tokens/BEM; không claim pixel/full-frame/Variables equivalence.

## Partial cancellation/refund — Plan04 Task11 evidence

Official Travel v3 nodes `1109:311`, `1112:324`, `1112:463`, `1112:602`, `1112:741`, `1112:925`, `1046:140`, `1112:876`, `1112:1060` đã được đối chiếu. Context/screenshot trực tiếp bao phủ select both, none disabled, confirm một vé và refund processing; metadata xác nhận các biến thể A01/A02/both và confirm/result còn lại. UI giữ cấu trúc heading + journey/selection bên trái, sticky summary bên phải ở desktop và stack ở mobile.

Supervisor-approved adaptation: contract mock hoàn100% selected fare thay prototype fee/rate; copy luôn ghi “ước tính mô phỏng”. Dùng CustomerLayout, semantic tokens, Button/StatusBadge, Radix Dialog và CSS/BEM hiện có; canonical fixture route/code/passenger thay prototype. Không tạo asset mới, không claim Variables/full-frame equivalence hoặc refund ngân hàng thật. Route map `/bookings/:bookingCode/cancel`; detail/history cancelled là lifecycle extension, không có canonical frame riêng.

## Organization UI — Plan05 Task6

Plan05 Task6 đã nối official Figma nodes `1185:61`, `1185:760`, `1185:834` vào route tổ chức thật. List dùng search/status, semantic table trên desktop và labeled cards dưới 768px; detail có ba nhóm thông tin; create/edit dùng cùng Radix dialog hai cột và xếp một cột trên mobile. Scenic bus asset local hiện có được tái sử dụng. Kiểm tra route thật tại 1440 và 360 xác nhận focus trap, target tối thiểu 44px, không overflow và reduced-motion CSS; đây là bằng chứng hành vi/responsive, không tuyên bố pixel-match toàn frame.

## Staff UI — Plan05 Task7

Plan05 Task7 nối official nodes `1186:764` và `1186:778` vào list/detail route; các family `1215:*`, `1230:*` dùng cùng record template. Một Radix dialog dùng chung cho create/edit map family `1234:272`, `1236:312`, `1237:*`–`1239:*`, có organization selector từ repository, strict profile fields và trạng thái active/inactive. Giữ shared AdminDataTable dưới 768px thành labeled cards, native controls tối thiểu 44px, focus-visible và reduced-motion; scenic bus local được tái sử dụng, không có asset mới. Official context/screenshot trực tiếp đã đọc cho bốn node chính. Browser surface của phiên không khả dụng nên không claim route browser 360/1440 hoặc pixel/full-frame equivalence.

## Admin final browser evidence — Plan05 Task9

Playwright route thật đã bù toàn bộ nghĩa vụ browser còn lại tại 1440×900 và360×800: Organizations, Staff và booking/payment/refund list/detail; mobile drawer; semantic desktop table/mobile labeled cards; create/edit dialogs và focus nằm trong modal; control tối thiểu44px; reduced-motion; không horizontal overflow. Bộ `@admin` đạt8/8, bao gồm 403 terminal và 503 retry với đúng hai network-console errors dự kiến, không page/runtime error hay dữ liệu riêng tư. Đây là evidence hành vi/responsive, không phải tuyên bố pixel/full-frame hoặc Figma Variables equivalence.

## Deterministic visual acceptance — Plan06 Task6

Visual suite cố định Date/UUID, vô hiệu animation/transition/caret và chờ font/image trước mỗi capture. Mỗi ảnh còn chạy document overflow assertion. Có54 baseline:27 trạng thái ở `w360` và `w1440`; non-update rerun đạt22/22. Toàn bộ contact sheet và các ảnh mobile đại diện Home, Sleeper, VNPay, cancellation dialog, Organization dialog và transaction cards đã được inspect trực tiếp; không có blank/error capture hoặc document overflow.

| Canonical node/family | Baseline state |
|---|---|
| `128:870`, `28:30` | `customer-home`, `customer-trip-results` |
| `29:103`, `234:4`, `29:223`, `29:267` | `customer-seats-sleeper`, `customer-seats-cabin`, `customer-seat-conflict`, `customer-hold-expired` |
| `30:344`, `30:416`, `561:306` | `customer-passengers`, `customer-booking-review`, `customer-vnpay-checkout` |
| `30:469`, `74:462` và cùng return family | `customer-payment-success`, `customer-payment-failed`, `customer-payment-cancelled`, `customer-payment-pending` |
| `30:489`, `64:427` | `customer-ticket-issued`, `customer-auth-login` |
| `1109:311`, `1112:*`, `1046:140` | `customer-cancellation-select`, `customer-cancellation-confirm`, `customer-cancellation-processing` |
| `1185:61`, `1185:760`, `1185:834` | `admin-organizations-list`, `admin-organization-detail`, `admin-organization-dialog` |
| `1187:878`, `1248:*` shared transaction family | `admin-transactions-list` |
| `1269:*`, `1277:*` | `admin-state-loading`, `admin-state-empty`, `admin-state-error`, `admin-state-forbidden`, `admin-state-not-found` |

Intentional deviations giữ nguyên các ruling đã duyệt cạnh từng node phía trên: shell/fonts/semantic tokens/Phosphor icons và trusted mock domain thay prototype sample; không thêm fee, promotion, bank processing hoặc production behavior chưa có contract. Mobile360 là responsive web adaptation bằng stack, labeled cards và drawer vì Figma scope canonical là desktop, không phải app mobile. Auth register/forgot dùng cùng `AuthShell` với login nên một baseline đại diện tránh pixel duplication. Staff list/detail/dialog và booking/payment/refund resources dùng các shared accepted Admin primitives; Organization và booking list cùng state-family baselines đại diện hình học, còn route behavior đã được Plan05/Plan06 responsive/accessibility E2E phủ. Baseline này là regression contract cho implementation đã duyệt, không tuyên bố pixel-perfect hoặc Figma Variables equivalence.
