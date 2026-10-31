# Chiến lược kiểm thử frontend

**Trạng thái:** Đã duyệt

## Tầng kiểm thử

- Unit: mapper, formatter, Zod schema, refund/price/countdown logic.
- Integration: form + hook + MSW, seat selection, query/filter state, error states.
- E2E Playwright: luồng người dùng xuyên route ở viewport mục tiêu.

## E2E bắt buộc

1. Tìm chuyến → chọn ghế → hành khách → review → VNPay success → vé.
2. VNPay failed → retry.
3. Hold hết hạn và khôi phục draft sau refresh.
4. Seat conflict và rollback toàn bộ selection.
5. Tra cứu vé guest.
6. Hủy một ticket → refund processing.
7. Admin login → booking → payment → refund.
8. Loading/empty/error/forbidden cho Admin.
9. Responsive tại 360, 768, 1024, 1440 và 1920px.

## Playwright viewport matrix — Plan06 Task1

Playwright có đúng năm Chromium project: `w360` (360×800), `w768` (768×1024), `w1024` (1024×768), `w1440` (1440×900) và `w1920` (1920×1080). Project chỉ cấu hình `browserName: "chromium"` và viewport, không kế thừa mobile device descriptor, user-agent hoặc touch emulation. E2E không được tự đổi viewport dựa trên tên project; override riêng chỉ dùng khi test thật sự kiểm tra một kích thước ngoài matrix và phải ghi rõ lý do.

Task1 discovery bằng `pnpm exec playwright test --list` liệt kê145 tests từ12 spec files:29 tests cho mỗi project và mọi spec xuất hiện ở cả năm. Đây là bằng chứng parse/discovery cấu hình; chạy browser/full responsive behavior thuộc các Task2–7 tiếp theo.

## Horizontal overflow matrix — Plan06 Task2

`tests/e2e/helpers/assertNoPageOverflow.ts` giữ document contract `documentElement.scrollWidth <= documentElement.clientWidth + 1`. Khi fail, helper liệt kê tối đa10 phần tử nhìn thấy vượt viewport để chẩn đoán; chỉ descendants của `.seat-map__scroller` và `.admin-table__scroller` được bỏ khỏi diagnostic vì đây là hai vùng cuộn nội bộ đã duyệt. Việc bỏ khỏi diagnostic không thay đổi document assertion.

`responsive.spec.ts` dùng POM/flow thật để kiểm tra9 customer route states từ Home đến ticket detail và5 canonical admin list routes sau đăng nhập. Helper chỉ chạy sau khi UI/network sẵn sàng. Matrix năm project đạt20/20 với một worker, tương đương70 document assertions trên14 route states; không phát hiện production overflow. TDD evidence gồm RED import helper chưa tồn tại, GREEN diagnostic cho controlled overflow và GREEN cho hai internal scroller.

## Accessibility automation — Plan06 Task3

`@axe-core/playwright` quét toàn document trên Home, Trips success, Seat page, Passenger form, Ticket detail và Organizations list/detail qua route/session thật. Không disable hoặc exclude axe rule; test fail khi có impact `serious`/`critical` và chỉ attach violation JSON khi fail. Keyboard coverage kiểm tra skip link, responsive customer/admin drawer, Organization dialog focus return, Space toggle ghế và passenger error announcement. Chi tiết RED→GREEN, breakpoint và giới hạn automation nằm trong [`ACCESSIBILITY_AUDIT.md`](./ACCESSIBILITY_AUDIT.md).

## Global style contract — Plan06 Task4

`src/styles/accessibility.test.ts` đọc source CSS để giữ exact global focus-visible/reduced-motion declarations và recursively ngăn `outline: none/0`. Browser smoke dùng keyboard Tab thật để kiểm tra visible outline và customer booking flow với reduced-motion tại `w360/w1440`; computed0.01ms có thể được Chromium serialize thành `1e-05s`.

## Metadata contract — Plan06 Task5

`src/shared/config/seo.test.ts` khóa hậu tố tiêu đề `| BLUE`, description, `noindex, nofollow`, nội dung `robots.txt` và prerender chỉ `/`. `src/routes.test.tsx` import mọi leaf route để xác minh cả25 route dùng helper chung, public leaf không có robots noindex và mọi private/transaction/admin leaf đều có. Production build test đọc `build/client/index.html` để xác nhận home title/description thật sự được prerender.

## Deterministic visual review — Plan06 Task6

`tests/e2e/visual.spec.ts` tạo54 baseline PNG:27 trạng thái Customer/Admin tại `w360` và `w1440`. Harness cố định Date/UUID, vô hiệu animation/transition/caret, chờ font và image, rồi chạy document overflow assertion trước `toHaveScreenshot`. Baseline chỉ được tạo sau deliberate RED do ảnh chưa tồn tại, kiểm tra contact sheet/toàn bộ nội dung và non-update rerun22/22.

Customer coverage gồm booking journey tám ảnh, cabin/conflict/expired, ba payment return bổ sung, auth và ba cancellation states. Admin coverage dùng Organization list/detail/dialog, transaction list và năm shared state families. Auth register/forgot dùng cùng shell login; Staff và các transaction resources dùng chung accepted list/detail/dialog primitives, nên không tạo pixel baseline trùng lặp. Mapping node, ảnh tương ứng và intentional deviations nằm trong [`FIGMA_SCREEN_MAP.md`](./FIGMA_SCREEN_MAP.md).

## Figma fidelity gate — Plan07

Regression snapshot chỉ chứng minh implementation không đổi ngoài ý muốn; nó không chứng minh khớp Figma. Mỗi canonical case Plan07 phải có exact node, Figma screenshot, same-viewport implementation screenshot, mismatch ledger và Supervisor verdict riêng. Task1 Home bổ sung `figma-fidelity.spec.ts` để khóa geometry exact1440 và responsive360, trong khi `home.spec.ts` giữ search behavior/no-overflow ở cả năm viewport. Chỉ baseline của case đang audit được cập nhật sau khi xem ảnh; baseline khác không được rebaseline để che shared-shell mismatch.

## Full E2E acceptance — Plan06 Task7

Đúng sáu flow hiện có mang tag `@critical`: guest booking success, payment retry, hold expiry, conflict rollback, partial cancellation và admin booking/payment/refund transaction navigation. Browser context/sessionStorage độc lập cung cấp mock snapshot mới cho từng test; Playwright config không bật retry. Critical gate chạy `w360/w1440` đạt12/12 trong38.3s.

Full discovery có240 tests trong15 files. Visual baselines chỉ áp dụng ở `w360/w1440`, nên33 executions visual tại ba width còn lại skip có chủ đích; functional, responsive và accessibility vẫn chạy đủ năm project. Final bounded one-worker matrix đạt207 pass,33 expected skips,0 fail trong10.4 phút. RED full matrix phát hiện stale E2E copy sau metadata/admin implementation và Home1440 baseline từng chụp loading; POM/assertion được đồng bộ, Home visual chờ form/search data ready và baseline đã review trước khi cập nhật. Không tăng timeout hoặc thêm retry.

## Static build và deep link — Plan06 Task8

`pnpm verify:build` chạy production build trước, kiểm tra `build/client/index.html` và React Router `build/client/__spa-fallback.html`, sau đó dựng static server cục bộ áp dụng chính fallback đó. Chromium điều hướng trực tiếp tới `/trips`, booking session sai và `/admin/bookings`; gate yêu cầu HTTP200 rồi xác nhận lần lượt invalid-search state, expired redirect và guest-login redirect của ứng dụng thay vì server404. Node contract tests còn chứng minh verifier fail với thông báo rõ khi thiếu từng artifact.

## Quy tắc

- Vitest + Testing Library; MSW ở network boundary.
- Không snapshot page lớn, không test implementation detail.
- Test độc lập, fixture/factory rõ nghĩa, không dùng dữ liệu thật.
- Ưu tiên role/label; `data-testid` chỉ dùng khi semantic selector không ổn định.
- Logic nghiệp vụ mới đạt tối thiểu 80% coverage; coverage không thay thế các luồng E2E.
- Trước khi hoàn thành: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`; chạy E2E liên quan thay đổi.

## Payment regression — Plan04 Task8

Payment schemas/repository and handlers are tested through MSW; fake DB/storage/clock seams prove exact issuance, idempotency, original expiry and fail-closed snapshot cross-links. Hook/page tests cover stale ownership, abort, production controls and exact draft-clear timing. PaymentPage POM adds success refresh, failed retry, cancellation, pending recheck and invalid IDs to desktop/mobile E2E (30 total). Playwright workers are bounded to2 after reproducible14-worker cold-start contention; timeouts/retry remain unchanged. Fresh-cache browser evidence covers five widths and11 states. Scoped coverage reports explicitly state includes and do not claim every source file100%. See local task-8-report.md for RED/GREEN and final gate evidence.

## Ticket guest access — Plan04 Task9

Schema tests kiểm tra normalization/strict access/private projection; MSW chứng minh generic404, token header scope,15min expiry/cap100 và bounded snapshot cross-links. SSR/access tests kiểm tra không initial-render storage, timer/focus/cleanup và PII cache revoke. Form/page tests qua real repository/MSW, không mock hook nội bộ; proof không mutation variables. TicketPage POM nối payment→access-required→lookup→detail/refresh/other ticket và expiry; full E2E36 desktop/mobile cases. Local fresh-cache browser matrix kiểm tra nămwidths, lỗi network/schema/access,44px/keyboard/focus/nooverflow/reducedmotion và response/console/URL privacy. Báo cáo coverage ghi đúng scope, không claim mọi file100%.

## Auth/account history — Plan04 Task10

Schema/repository/handler/snapshot/hook/page/route tests kiểm tra credential validation, one-admin/customer, exact session TTL/cap/persistence, neutral register/forgot, OAuth environment gating, canonical intended redirects, ownership và guest/account detail isolation. Privacy assertions kiểm tra password/email không ở session storage, mutation variables, response, query key, URL hoặc console.

Task10 E2E chạy desktop/mobile cho customer guarded history/detail, admin intended route/customer403, OAuth error recovery và neutral register/forgot. Fresh-cache Chromium kiểm tra40 cases =5 widths×8 states, target>=44px, keyboard focus, reduced motion, no overflow/noindex, runtime/unexpected console/PII response-log-URL bằng0. Coverage chỉ scope auth/account additions:94.30% statements,89.35% branches,97.75% functions,96.49% lines; không claim toàn source100%.

## Partial cancellation/refund — Plan04 Task11

Schema/repository/handler/snapshot/page tests bao phủ single, both, none, duplicate/unknown/already-cancelled, owner/guest scope, cross-booking privacy, session không được guest fallback, replay/conflict và refresh restore. Account page test kiểm tra all/issued/cancelled sau partial cancellation; detail test kiểm tra selected cancelled và unselected issued.

Focused cancellation coverage đạt statements93.80%, branches82.75%, functions96.42%, lines96.21%. E2E nối payment→lookup→cancel→processing→detail refresh ở exact viewports1440×900 và360×800; kiểm tra required headers, một POST, exact code, focus ring, target>=68px, noindex và no horizontal overflow. Full unit cuối đạt99files/959tests; không claim toàn source100%.

## Admin final verification — Plan05 Task9

`tests/e2e/admin.spec.ts` dùng POM và chạy8 cases tại Chromium desktop1440×900/mobile360×800. Luồng phủ login/guard, Organization và Staff list/detail/dialog mutation, booking/payment/refund list/detail, forbidden terminal và service-error retry. Route assertions kiểm tra table/card responsive, drawer, dialog focus, target44px, reduced motion, overflow và runtime/console classification. Scenario header chỉ được test init script gắn cho `/api/v1/admin/`; production bỏ qua.

Final unit gate chạy bounded một worker đạt113 files/1069 tests. Ba lượt parallel trước đó lần lượt tái hiện timing flaky đã có ở passenger/seat/auth; từng test xanh khi cô lập và lượt bounded sạch, không sửa production ngoài Task9. Format/lint/typecheck, production build và prerender2/2 đạt.
## Final acceptance — Plan06 Task9

Pinned Node24 final gate ngày2026-10-24 đạt: lint, typecheck, coverage115 files/1076 tests với96.23% statements/91.54% branches/96.87% functions/97.08% lines, full Playwright một worker/retry0 với207 pass/33 visual skips có chủ đích/0 fail trong9.9 phút, và verify:build với prerender2/2/deep links3/3. Full accessibility executions ở năm project không có axe finding impact serious/critical. Hai transient trước final clean run (cold-start customer axe `w360`, unknown callback `w768`) đều pass isolated retry0; không tăng timeout hoặc thêm retry.

## Plan07 Task8 — Organization/Staff exact31case

`task8Cases.ts` giữ31node/URL riêng. `task8-evidence.spec.ts` mặc địnhfinal để không ghi đèBEFORE; chỉ360/1440 tạo ảnh và snapshot. Override desktop height theo exact frame native1154/1098/1069/818/645 là kiểm tra kích thước ngoài matrix có chủ đích, không đổi functional viewport matrix. Mobile dialog chụp800px viewport thật, list/detail full-page; mỗi case có metadata geometry cho logo/icons/background chevron.

`task8-responsive.spec.ts` chạy31case ởđủ5width với axe (không exclude/rule disable), document overflow và focus containment/Escape. `task8-account.spec.ts` giữ keyboard open/trap/Escape/return/logout ở5width. `task8-fidelity.spec.ts` chỉ1440 vì assertions exact geometry/colors; các width khác skip có giải thích. Legacy Organization visual test được tách riêng; transaction/state-family baselines giữ nguyên và carry-forward Task9 theo ruling Supervisor.

Task8 responsive assertions include internal dialog scrollWidth/clientWidth, form-control horizontal containment, and Organization member-card cell containment at360px; global page overflow alone cannot prove complete dialog content. Extended close-icon touch targets remain viewport-safe and have separate keyboard/focus checks.

Task8 evidence export is explicit (`TASK8_CAPTURE_ONLY=1`, with `TASK8_PHASE=before` for BEFORE). Normal final visual regression checks read existing baselines without rewriting evidence PNG/JSON: watched JSON writes were proven to reload other Vite pages and invalidate concurrent axe/navigation checks. Capture exports use one writer; functional/visual regression runs remain independent of artifact creation.
