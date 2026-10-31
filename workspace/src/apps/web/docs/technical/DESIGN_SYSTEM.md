# Design system BLUE

**Nguồn:** Figma Travel v3, Brand Kit `0:1`, Components `7:3`  
**Trạng thái:** Đã duyệt làm nguồn hình ảnh

## Nguyên tắc

- Light-first; component chỉ dùng semantic token.
- Bricolage Grotesque cho display/heading; Be Vietnam Pro cho nội dung và dữ liệu.
- Phosphor Icons, Regular/Duotone, 20/24px; không trộn bộ icon.
- Chuyển động có mục đích; hỗ trợ `prefers-reduced-motion`.
- Không dùng logo nhà xe thật, testimonial giả hoặc metric không có nguồn.

## Token semantic tối thiểu

Nguồn triển khai là [`src/styles/tokens.css`](../../src/styles/tokens.css), được import trong `src/styles/app.css` trước các base rules. Tất cả component dùng CSS variables tương ứng; primitive token không xuất hiện trực tiếp trong feature component.

| Semantic role | CSS variable | Giá trị |
|---|---|---|
| Nền trang | `--color-bg-page` | `#f7faff` |
| Nền thương hiệu / CTA | `--color-bg-brand` | `#1f66e5` |
| Nền bề mặt | `--color-bg-surface` | `#fcfdff` |
| Nền nhẹ | `--color-bg-subtle` | `#eff6ff` |
| Chữ chính | `--color-text-primary` | `#10243e` |
| Chữ phụ | `--color-text-secondary` | `#3f536b` |
| Chữ metadata | `--color-text-muted` | `#5f738a` |
| Đường viền | `--color-border` | `#d6e3f3` |
| Thành công | `--color-status-success` | `#167b4a` |
| Cảnh báo | `--color-status-warning` | `#a05d00` |
| Lỗi | `--color-status-error` | `#c83b4d` |
| Vòng focus | `--color-focus-ring` | `#2f7df4` |
| Font display / heading | `--font-display` | `"Bricolage Grotesque", sans-serif` |
| Font nội dung / UI / dữ liệu | `--font-body` | `"Be Vietnam Pro", sans-serif` |
| Bo góc control | `--radius-control` | `12px` |
| Bo góc card | `--radius-card` | `16px` |
| Bóng card | `--shadow-card` | `0 8px 24px rgb(16 36 62 / 8%)` |
| Khoảng cách inline / navigation | `--space-inline-gap` | `8px` |
| Đệm ngang control | `--space-control-inset` | `16px` |
| Lề ngang trang | `--space-page-gutter` | `16px` |
| Khoảng cách nội dung | `--space-content-gap` | `16px` |
| Đệm section / drawer | `--space-section-inset` | `24px` |
| Touch target tối thiểu | `--size-control-min` | `44px` |

Các shell và primitive dùng token trên trực tiếp hoặc qua biến semantic cục bộ như `--customer-layout-gutter`. Kích thước riêng của component (padding dọc control, độ rộng sidebar, border, focus offset) có biến mang tên component trong CSS; đây là thông số triển khai responsive, không được khẳng định là Figma Variables đã trích xuất.

### Semantic roles bổ sung cho Plan 07 Home

Task1 Home fidelity mở rộng canonical layer bằng role semantic, không đặt token theo mã màu hoặc node Figma:

- Canvas/surface/control: `--color-bg-customer-canvas`, `--color-bg-editorial-surface`, `--color-bg-editorial-control`, `--color-bg-hero-*`, `--color-bg-support-*`, `--color-bg-shell-action`.
- Editorial text/brand: `--color-text-editorial-*`, `--color-text-hero-supporting`, `--color-text-trust-supporting`, `--color-text-support-copy`, `--color-text-on-image*`, `--color-brand-editorial`, `--color-brand-shell-strong`.
- Border/overlay: `--color-border-shell`, `--color-border-editorial*`, `--color-border-route-card`, `--color-border-support-*`, `--color-border-hero-frame`, `--color-border-trust-frame`, `--color-overlay-route-*`.
- Elevation: `--shadow-customer-header`, `--shadow-hero-frame`, `--shadow-search-elevated`, `--shadow-route-card`, `--shadow-trust-visual`, `--shadow-support-card`.

`src/styles/tokens.test.ts` quét toàn bộ CSS thuộc Home, BrandLogo, CustomerLayout, HomeHero và SearchForm để cấm hex/rgb/hsl hoặc shadow primitive quay lại. Các component chỉ tham chiếu `var(...)`; giá trị nguồn duy nhất nằm trong `tokens.css`.

### Semantic roles bổ sung cho Plan 07 Results

Task2 Results dùng nhóm role theo ngữ cảnh `--color-results-*` cho canvas, surface, control, chip, text, accent, active, border và status success; elevation dùng `--shadow-results-panel` và `--shadow-results-card`. Các giá trị primitive chỉ tồn tại trong canonical `src/styles/tokens.css`. Source-contract test quét `TripResultsPage`, `TripFilters` và `TripCard` để cấm hex/rgb/hsl hoặc shadow primitive trong feature CSS. Contrast, keyboard/focus và target 44px được kiểm tra ở 360 và 1440; responsive/overflow được kiểm tra đủ 360/768/1024/1440/1920.

## Breakpoint và hành vi responsive

[`src/shared/config/breakpoints.ts`](../../src/shared/config/breakpoints.ts) xuất `BREAKPOINTS.customerNavigation = 768` và `BREAKPOINTS.adminNavigation = 1024` (px). Layout dùng config này cho `matchMedia` trong effect để đóng drawer khi chuyển sang desktop. CSS dùng media query tương ứng vì CSS custom property không thay thế được giá trị điều kiện media query gốc. Test `breakpoints.test.ts` giữ CSS và config đồng bộ.

Customer navigation dùng drawer dưới 768px; admin dùng drawer dưới 1024px. Các viewport kiểm tra là 360/768/1024/1440/1920px. Gutter 16px, section 24px và khoảng cách nav 8px là giá trị của shell đã kiểm tra, không phải tuyên bố về số đo Figma chưa truy xuất được.

### Bằng chứng đối chiếu ngày 2026-10-18

- File Figma: `OCkWSOZQ8Pq8AejXccajpO`; [Brand Kit `0:1`](https://www.figma.com/design/OCkWSOZQ8Pq8AejXccajpO?node-id=0-1) và [Components `7:3`](https://www.figma.com/design/OCkWSOZQ8Pq8AejXccajpO?node-id=7-3).
- Official Figma MCP `get_design_context` cho cả hai node trả lỗi `You currently have nothing selected. You need to select a layer first before using this tool.` Vì vậy không có Variables/styles hoặc code context để xác minh giá trị số trực tiếp.
- `get_screenshot` vẫn trả được render gốc Brand Kit 3080×2587 và Components 3776×3220. Đã quan sát swatch semantic, nhãn hai font trong Brand Kit, nền sáng/xanh, control và card bo góc trong Components; render phù hợp với hướng màu, typography và radius đã quy định. Screenshot không đủ để khẳng định giá trị hex, radius hoặc shadow chính xác.
- Theo fallback được duyệt trong [Plan 02, Task 1](../superpowers/plans/2026-10-18-travel-v3-02-design-system-shell.md), dùng `D:/HK7/Figma/Travel/00A-PROMPT-BRAND-KIT.md` mục 3–4 và `D:/HK7/Figma/Travel/00-PROMPT-CHUNG-FIGMA.md` mục 5, 7 để đối chiếu giá trị màu, tên font và thang radius. Màu và font khớp nguồn; radius 12/16px nằm trong thang 8/12/16/24px. Shadow cụ thể và ánh xạ radius control/card lấy đúng hợp đồng Task 1, chưa xác minh được từ Variables/styles.
- Task 6 tải Be Vietnam Pro 400/500/600 và Bricolage Grotesque 700/800 bằng Google Fonts CSS trong `src/root.tsx`, giữ `display=swap` và preconnect. `src/styles/app.css` áp dụng font body cho nội dung và font display cho heading; font stacks vẫn có fallback `sans-serif`. CustomerLayout dùng cùng token cho wordmark, nội dung và drawer portal.

## Nền component đã triển khai

| Component | Contract trong Plan 02 |
|---|---|
| Button | primary/secondary/ghost/danger, loading khóa thao tác lặp, native props |
| Input | label, error alert, aria-invalid, ID/link mô tả, giữ native props |
| StatusBadge | neutral/success/warning/error kèm nội dung đọc được |
| Seat | available/selected/held/sold/disabled, tên và mô tả trạng thái, không chọn ghế unavailable |
| PageState | section có tên/mô tả, h1 và recovery action tùy chọn |
| Customer/Admin navigation | NavLink, skip link, drawer Radix Dialog, focus trap/return và Escape |

TripCard thuộc [Plan 03 / TASK-005](../superpowers/plans/2026-10-18-travel-v3-03-customer-search.md); BookingSummary thuộc [Plan 04 / TASK-006](../superpowers/plans/2026-10-18-travel-v3-04-booking-payment-tickets.md). Hai component này chưa được triển khai trong Plan 02. Mobile web là biến thể responsive của desktop, không sao chép `Platform=App`.

## Kiểm kê asset Plan 02

Đã đối chiếu Brand Kit/Components bằng screenshot connector và prompt fallback nêu trên. Nền token, control và shell không cần xuất asset ảnh: BLUE là wordmark dạng chữ, icon lấy từ package Phosphor và font tải qua Google Fonts với fallback `sans-serif`. Không có asset Figma nào được yêu cầu, xuất hoặc tạo trong Plan 02; không có kích thước/định dạng ảnh giả để nghiệm thu. Việc xuất và tối ưu ảnh cho các màn hình downstream thuộc task tương ứng. Screenshot kiểm thử cục bộ là bằng chứng verification, không phải asset sản phẩm.

Control tương tác có target tối thiểu 44px và focus-visible. Button tắt transition khi `prefers-reduced-motion: reduce`; drawer và các primitive còn lại không thêm animation. Kiểm tra Chromium tại năm viewport xác nhận font đã tải/áp dụng, icon SVG hiển thị, focus, target và reduced motion; giới hạn Figma Variables vẫn giữ nguyên.

## SearchForm — Plan 03 Task 5

Mục tiêu: chọn điểm đi/đến, ngày Việt Nam và số hành khách rồi tìm chuyến. Chọn route → ngày/số khách → Tìm chuyến; lỗi giữ người dùng trong form, liên kết alert với field và focus field lỗi đầu; hợp lệ phát canonical TripSearch cho caller. Form chỉ nhận readonly locations, không tự tải dữ liệu hoặc điều hướng. Default passenger1, sort departure; trạng thái submitting dùng Button loading để khóa thao tác lặp.

Đã đọc official Figma context + screenshot [booking box128:892](https://www.figma.com/design/OCkWSOZQ8Pq8AejXccajpO?node-id=128-892) trong Home128:870 ngày2026-10-19: card nền sáng, bốn nhãn, controls48px và blue CTA. Task5 được Supervisor duyệt dùng native select/date, existing Input/Button và semantic tokens hiện hành thay prototype absolute positions. Mobile <768 một cột; 768..1023 hai cột với CTA toàn hàng; >=1024 grid năm cột. Form padding dùng section inset24px, gap content16px, field gap8px; controls48px và CTA ít nhất44px; không thêm animation, Button giữ reduced-motion fallback.

Native selects giữ bàn phím/browser semantics; mỗi label có ID riêng. Lỗi cùng route nằm tại destination; past date tại date; required fields, passenger1..6 và default sort do cùng schema xử lý. InputProps hiện khai báo ComponentProps<input> để React19 native ref được giữ typed khi RHF compose với date min ref; không đổi generated IDs, mô tả, class hoặc hành vi Button/Input.

Decorative blue-dot SVG visible ở leading-icon nodes128:897/902/907/912 đã được HomeHero Task6 tích hợp đúng asset local. SearchForm chỉ bật dot khi withLeadingIcon=true; default form không đổi. Dot giữ16×16px qua CSS background, padding-start chừa44px, không thêm accessible name. Biến thể desktop có dot chừa ít nhất198px cho native date để không cắt giá trị ở1024px.

## HomeHero — Plan 03 Task 6

Hero giữ nguyên eyebrow/slogan/supporting copy từ official context128:874 trong Home128:870, local bus image object-fit:cover và editorial gradient bằng semantic page token. Section có aria-labelledby tới một h1. Search loading/error/empty giữ bố cục trong card; error có retry. Responsive giữ chiều cao desktop tối thiểu650px, mobile tăng theo form; form một/hai/năm cột tại các breakpoint đã có. Không thêm animation, CTA kế thừa reduced-motion.

| Asset local | Figma source | Kích thước/bytes | SHA256 |
|---|---|---|---|
| `src/assets/home/hero-bus.png` | Node128:875, Hero image · Generated original |1536×1024 PNG,2135204 bytes|F3072762CA06307125CFD9E4437C4560F4D2346CC7EBA2CE5DC228949C2323C4|
| `src/assets/home/search-dot.svg` | Nodes128:897/902/907/912 |16×16 SVG,236 bytes|E81D20189D8726B42BA6980B2EB1D98BCA37C41F8F3D0629FD4D307479C6C9F6|

Tải nguyên bản từ URL asset official Figma context trả về, không chỉnh/re-draw dot hoặc dùng screenshot làm ảnh sản phẩm. Bus có width/height native và fetchPriority high, decorative alt rỗng; SVG background được Vite inline từ file local khi build. Không gán license stock hoặc tác giả chưa có evidence cho asset Figma được giao.

Supervisor giới hạn Task6 ở hero và yêu cầu giữ accepted layout/nav/font tokens. Vì vậy font display vẫn Bricolage Grotesque thay Newsreader quan sát trong Home; logo/navigation và lower popular-route/editorial/support không được thay hoặc tạo trong task. Không khẳng định pixel-match toàn frame hoặc đặt cam kết mới cho backlog. Browser thực đã kiểm tra five widths, dot geometry, ảnh tải thành công, focus và SPA navigation; production prerender giữ copy/ảnh/loading, MSW hiện chỉ khởi động development.

## TripCard — Plan 03 Task 7

TripCard là article có tên từ operator và tuyến tỉnh/thành, heading h2 và hai time giữ datetime UTC gốc. Nội dung hiển thị giờ/ngày theo Asia/Ho_Chi_Minh, thời lượng thực giữa hai instant (kể cả qua đêm), terminal, loại xe domain, ghế còn và VND/khách. Duration hợp lệ dưới một phút hiển thị `Dưới 1 phút`; interval không hợp lệ trả em dash. Format tiền dùng Intl vi-VN, không phần thập phân; format giờ dùng adapter calendar Intl rồi date-fns locale vi, không phụ thuộc timezone/DST của máy. Timestamp sai hoặc calendar overflow trả em dash; HTTP boundary vẫn chịu trách nhiệm validate Trip trước UI.

Official Figma context/screenshot Search Results28:30 và Trip result215:156 đã đối chiếu ngày2026-10-20: card trắng, operator mark, vehicle chip, divider, lịch trình với route markers, ghế/giá và CTA. Supervisor duyệt dùng operator initial dạng text, Phosphor Bus/Ticket và CSS dashed line/dot thay mark/Lucide assets của prototype; giữ semantic tokens/radius/font hiện hành và vehicle labels Giường nằm34/Cabin22. Không có asset ảnh mới cần tải trong Task7; không claim pixel-match hoặc Variables verification.

Card dùng BEM, spacing8/16px qua tokens, lịch trình ba cột co giãn và text wrap để không overflow. Date ở cả hai đầu làm rõ arrival ngày sau; fare/seat không chỉ biểu đạt bằng màu. Button native có accessible description từ số ghế, min44px/focus-visible/reduced-motion kế thừa primitive. Hết chỗ khóa native disabled và không gọi callback; available chỉ onSelect(trip), không route hoặc tạo booking. TripCard đã được ghép trong Results với grid1/2/3cột tại360/768/1024 trở lên; available callback hiện chỉ thông báo giới hạn bản mô phỏng, không booking.

## TripFilters — Plan 03 Task 8

Người dùng chọn sort/loại xe để tinh chỉnh query đang có; thay đổi phát ngay URLSearchParams clone. Hai native select có nhãn Sắp xếp/Loại xe, ba sort canonical và Tất cả/Giường nằm34/Cabin22. Đặt lại chỉ xóa sort/vehicleType; hành trình/ngày/số khách và mọi query entry khác được giữ. State controlled bởi params caller, không có draft filter riêng hoặc nút áp dụng dễ gây hiểu nhầm.

Từ768px panel inline dùng grid hai select + reset; dưới768px Button mở Radix Dialog bottom sheet. JavaScript dùng shared BREAKPOINTS.customerNavigation768, CSS media query768 tương ứng, không thêm hằng số. Drawer có Title/Description/Đóng bộ lọc, focus trap, Escape/close trả focus trigger, tự đóng khi resize sang desktop và cleanup media listener. Window chỉ đọc trong effect; closed state SSR-safe. Native controls44px, buttons>=44px, focus2px semantic; không thêm animation, Button giữ reduced-motion fallback. BEM/token spacing16/24 và width/overflow phù hợp360..1920.

Figma Results28:30/Filters panel215:105 có vehicle/reset cùng nhiều departure/price/amenity controls. Scope Task8 chỉ sort/optional vehicle theo plan; inline desktop và mobile drawer là responsive adaptation đã duyệt. Không triển khai các filter chưa có contract, không tải asset mới cho native controls. TripFilters đã mount trong Results, giữ hiển thị ở loading/error/empty/success để người dùng sửa overrides; vehicleType giữ UI-only theo ruling Supervisor.

## TripCard booking pending contract — Plan 04 Task 3

TripCard keeps callback-only presentation and accepts optional isPending/disabled props (defaultfalse). isPending uses existing Button loading text Đang xử lý/aria-busy/native disabled; disabled blocks other selection actions during a create-session request while sold-out stays disabled. Results owns mutation/navigation and static Vietnamese role=status/role=alert retry feedback using BEM trip-results__booking and semantic spacing/text tokens. No new icon/asset/animation; existing44px controls/focus/reduced-motion rules apply.
## Plan 04 Task 5 — seat selection

- Official Figma29:103 (sleeper34),234:4 (cabin22),29:223 (conflict) inspected with context and inline screenshots. Two decks preserve canonical geometry: sleeper3×4 plus5 rear seats per deck; cabin2×5 plus1 rear/technical cell. Legend distinguishes available/selected/held/sold/disabled, using the existing Seat primitive and semantic tokens. Horizontal scrolling stays inside the labeled map region on small screens; page remains contained.
- Heading/trip strip, bordered map and summary follow the prototype hierarchy; desktop map+320/360px summary, stacked below1024. Existing accepted customer shell/fonts remain. Conflict uses Radix modal with safe codes, choose-again/list recovery, Escape/focus trap and return to the originating seat or map region when that seat became disabled.
- All seats/CTA/close/links use44px minimum native targets, focus-visible and global reduced-motion. Countdown uses aria-live=off; changing total is polite; pending/feedback/expired states are semantic. Prototype service-fee row intentionally omitted under approved contract (fare×count only).
- Asset audit: context returned only the existing header logo outside this task's retained shell; no new content asset required/created/downloaded. No Figma Variables verification or full-frame equivalence claimed.

## Passenger form — Plan 04 Task 6

Exact node30:344 guides the form/summary hierarchy: bordered seat identity cards, name/optional phone, shared pickup, email/note delivery and confirm CTA. BEM passenger-form/passenger-details use semantic surface/border/text/brand/error/spacing tokens, accepted fonts, shared Input/Button and exact local Figma user/mobile/mail/note/pin/chevron/bus/pickup assets. Native input height52px, CTA/breadcrumb targets>=44px, visible focus and inherited reduced-motion remain. Layout stacks below1024 with min-width0 and wrapping labels to contain360px.

Each selected seat has an accessible legend and stable hidden seatId; errors use existing role=alert/aria-describedby, a form summary and RHF focus on the first invalid field. Read-only pickup is trusted trip origin. Native form-associated Summary submit preserves Enter semantics; pending disables form controls and CTA. Original countdown is aria-live=off. The exact passenger/review routes own their frames and suppress only the generic footer. No fee is invented when the booking contract reports zero.

## Booking review — Plan 04 Task 7

booking-review/booking-review-page BEM use semantic surface/subtle/border/text/brand/error/spacing tokens and existing shared Summary/Button. Structured cards show journey, exact timeline mark, stable seat badges/masked passenger identities, trusted common pickup, policy and confirmation. Exact local Figma bus/passenger/phone/pickup/policy/quote/verified marks replace prior icon-library approximations. Links/actions retain44px targets and semantic focus rings. Layout stacks below1024; wrapping/min-width0 contain360px.

Confirmation locks synchronously, exposes shared Button busy/disabled feedback and safe role=alert retry. Created booking shows role=status locked notice and removes edit links, including direct prior-step recovery. Countdown remains original expiry and aria-live=off; inherited reduced-motion applies. Figma30:416 context/screenshot was independently captured; canonical fare/session data remains authoritative, with no unsupported fee/promotion/payment method.

## PaymentCheckout / PaymentResultCard — Plan 04 Task 8

PaymentCheckout uses semantic transaction definition lists, typographic VNPay provider block, existing BookingSummary and original hold countdown. PaymentResultCard uses status text, trusted journey timeline, details and ticket links/recovery sidebar. BEM payment-page/payment-checkout/payment-result use semantic colors/spacing/radii/fonts, min-width0/wrapping, shared Button/focus/reduced-motion behavior. Checkout stacks below1024; result body stacks below768. Only project Phosphor leaf icons are imported; no root icon barrel or new static asset.

Official Figma561:306/30:469/74:462 context/screenshots were inspected; retained shell and approved omitted fee/promo/method/history claims are recorded in FIGMA_SCREEN_MAP. No Variables/full-frame fidelity claim. Responsive/44px/focus/reduced-motion evidence is recorded in Task8 report.

## TicketLookupForm / TicketCard — Plan04 Task9

Lookup là narrow semantic section với labelled native fields, field errors, synchronous pending lock và Button; không có canonical Figma lookup frame. Detail card có top brand/status/route/date, two-end schedule, facts grid, green issued notice và mock-code/sidebar navigation. BEM ticket-page/ticket-lookup/ticket-card dùng semantic tokens, min-width0, overflow-wrap và shared44px/focus/reduced-motion. Native links có explicit focus ring; card stacks dưới768, details grid2 và sidebar280px từ768/308px từ1024. Icon imports explicit leaf (QrCode included optimizeDeps), không root barrel.

Official30:489 context/screenshot được đối chiếu; Supervisor approved marker-only QR/no payload, retained shell/leaf/CSS semantics và omitted unsupported prototype actions. Không asset mới hoặc Variables/full-frame fidelity claim. Browser viewport/focus/overflow/privacy evidence tại Task9 report.

## AuthShell / account history — Plan04 Task10

AuthShell dùng hai cột từ1024px, một cột ở mobile/tablet; scenic image object-cover chỉ là minh họa và form luôn đứng trước trong DOM. Login provider buttons wrap an toàn, register grid tách từ768px, native select/input/button/link/summary tối thiểu44px. BEM `auth-page` và `account-tickets` chỉ dùng semantic surface/text/border/error/focus/spacing/radius/shadow tokens; focus-visible3px, inherited reduced-motion và overflow-wrap được giữ ở360..1920.

Robot/provider/scenic/backdrop là local assets từ official Figma nodes64:427/431/435; alt rỗng cho decorative robot/provider marks, scenic có alt mô tả và aside label. Account history không có canonical frame, dùng card list1/2 cột, issued StatusBadge, canonical journey/time/fare và shared controls; đây là adaptation đã ghi trong FIGMA_SCREEN_MAP.

### Task 6 auth fidelity tokens

Exact auth frames use canonical semantic roles `--color-auth-canvas`, `--color-auth-surface`, `--color-auth-ink`, `--color-auth-muted`, `--color-auth-brand`, `--color-auth-active`, `--color-auth-border`, `--color-auth-assistant`, `--color-auth-divider`, `--color-auth-story-stack`, `--color-auth-on-image`, `--shadow-auth-shell`, `--shadow-auth-action`, and `--shadow-auth-story`. Feature CSS may not contain primitive color/shadow values. These roles reproduce the three route-owned Figma frames without changing accepted customer/admin tokens.

## CancellationSelector / CancellationConfirmDialog — Plan04 Task11

`cancellation-page`, `cancellation-selector` và `cancellation-confirm` dùng BEM cùng semantic surface/border/text/brand/error/focus/spacing/radius/shadow tokens. Selector label là toàn bộ target tối thiểu68px, checkbox22px và focus-within ring3px. Dialog dùng Radix focus trap/Escape/return focus, liệt kê exact code và estimate; submit none disabled. Grid map + sticky summary stack dưới800px, definition list processing stack một cột; min-width0/wrapping giữ viewport360px không overflow.

## Cancellation fidelity roles — Plan 07 Task 7

Chín frame cancellation/refund dùng một lớp token theo vai trò thay vì primitive trong feature CSS. `--color-cancellation-surface/panel/control` ánh xạ nền vé, panel và control; `accent-soft/success-soft/warning-soft` ánh xạ well thông tin; `text/copy/muted` ánh xạ hierarchy chữ; `accent/success` ánh xạ brand và refund progress; `border/border-strong` cùng `--shadow-cancellation-ticket` ánh xạ outline/elevation của exact nodes. `--color-cancellation-compact-accent` và `--color-cancellation-compact-copy` chỉ dành cho chữ 9–12px trên các soft surface, giữ vai trò Figma nhưng đạt WCAG AA; không thay màu brand CTA hoặc heading.

Canonical cancellation route là route-owned frame: giữ shared official header/logo và suppress generic footer chỉ tại exact `/bookings/:bookingCode/cancel`. Selector giữ checkbox native ẩn trực quan nhưng toàn row là label/focus target; confirmation dùng Radix modal focus trap, Escape và trả focus về đúng CTA mở dialog. Processing state dùng 1120×520 ticket ở desktop và content-sized stack ở mobile. Official icon assets nằm trong `src/assets/cancellation`, còn status/safety/progress dùng lại exact local payment assets đã được chấp nhận.

Cancelled dùng error StatusBadge và copy rõ mã vé không còn hiệu lực; issued giữ success badge và link hủy. Refund card chỉ hiển thị `processing`/VNPay đang xử lý mô phỏng, không animation hoặc ETA giả. Official nodes1109:311/1112:*/1046:140 đã được đối chiếu; retained shell/tokens/primitives và policy100% là adaptation đã duyệt, không asset mới hoặc claim pixel fidelity.

## AdminDataTable / AdminListState — Plan05 Task4

`AdminDataTable<T>` là presentation component dùng chung cho các list frame admin đã map. Desktop giữ một bảng semantic với caption, `th scope="col"` và stable row keys. Dưới768px, cùng DOM table được CSS trình bày thành card; mỗi ô có nhãn cột nhìn thấy, text wrap và không cần horizontal viewport. Optional route link chỉ bọc nội dung ô đầu; action là Button riêng, có accessible name và chặn pointer/click/keyboard propagation để không kích hoạt điều hướng hàng.

`AdminListState` chỉ nhận discriminated presentation props: loading có `role=status`/`aria-busy`, empty và error dùng shared `PageState`, error có native retry Button. BEM CSS chỉ dùng semantic token, target link/button tối thiểu44px, focus ring hiện hữu và tắt transition khi reduced motion. URL filters, data hooks và resource modules thuộc Task5+; Task4 không thêm route hoặc asset và không claim full-frame Figma fidelity.

## AdminFilters — Plan05 Task5

Family Figma `1273:*` được biểu diễn bằng search input, native organization/status selects, clear Button và navigation phân trang. Controls dùng label thật, shared Input/Button, semantic tokens và target tối thiểu44px. Desktop là grid search rộng + hai select + clear; dưới1024px thành hai cột và dưới768px một cột, pagination wrap/center; dưới400px chỉ báo trang đứng riêng và action chia hai cột để không overflow.

Search debounce300ms có cleanup; filter thay đổi reset page1. Clear hủy cả draft chưa commit và chỉ xóa list filters/page, giữ pageSize/unrelated URL state. Pagination có nav accessible name, disabled boundary buttons và polite page status. Component chưa mount vào route ở Task5 nên không claim full-frame/browser fidelity; Task6+ cung cấp route integration.

## Staff pages/dialog — Plan05 Task7

`staff-page` và `staff-dialog` dùng BEM, semantic surface/text/border/focus/spacing/radius/shadow tokens và shared Button/Input/AdminDataTable/AdminFilters. Desktop list là semantic table; dưới768px dùng labeled cards. Detail dùng ba card thông tin; dialog hai cột chuyển một cột trên mobile. Native select/button/input/link có target tối thiểu44px, focus-visible; overlay/content transition bị tắt khi reduced motion. Một Radix dialog dùng chung cho create/edit để giữ focus trap, Escape và return focus; pending khóa close/submit. Không thêm asset hoặc style ngoài token.

## Transaction pages — Plan05 Task8

Booking/payment/refund dùng cùng admin shell, surface token, semantic table và mobile labeled-card đã duyệt. `TransactionStatusBadge` tái sử dụng `StatusBadge`: warning cho trạng thái đang chờ/xử lý, success cho thành công/đã thanh toán/đã hoàn, error cho thất bại/hủy booking, neutral cho payment cancelled. Detail dùng hai card trên desktop và một cột dưới768px; link quay lại/quan hệ có min-height44px, text dài wrap, không tạo horizontal overflow; reduced-motion tắt transition. Không thêm asset mới.

## Admin fidelity — Plan07 Task8 (chờ Supervisor)

Admin dùng official BrandLogo wrapper126×48/image110×40, topnav88px và content1152px. Semantic roles `--color-admin-*`, `--gradient-admin-banner` và `--shadow-admin-panel` sở hữu surface/control/border/stripe/badge/label/banner/overlay; không thay accepted Customer/Auth/Cancellation tokens. Organization form720×426 và membership form720×469 dùng fields48px, label12px/18px, heading20px/30px; layout một cột ở360px, giữ scroll/focus trap/Escape/return. Pointer focus ở container không vẽ persistent ring; keyboard control giữ semantic outline.

23 asset local đã hash-match exact Figma responses; provenance/hash/intrinsic geometry tại [asset verification](../quality/evidence/task-8/asset-verification.json), callsite/rendered geometry và từng case tại [Task8 ledger](../quality/TASK8_ADMIN_FIDELITY_LEDGER.md). Native select giữ semantics và keyboard nhưng dùng exact local chevron khi modal Figma có icon.

Admin account trigger giữ124×44 ởdesktop và44×44 icon-only ởmobile; Radix account dialog dùng primitives/tokens/focus trap/Escape/return hiện có. Đây là state consistency không có standalone Figma frame.
