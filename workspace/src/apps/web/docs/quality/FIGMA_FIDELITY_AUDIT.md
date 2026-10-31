# Figma Fidelity Audit

## Task 1 — Home User Desktop

- Figma file: `OCkWSOZQ8Pq8AejXccajpO`
- Canonical node: `128:870` (`1440 × 2640`)
- Route: `/`
- Figma session: `ab17283e-3aca-41ab-8439-c972913edcae`
- Figma reference: `docs/quality/evidence/home/figma-home-128-870-1440.png`
- Before implementation: `docs/quality/evidence/home/implementation-before-1440.png` (`1440 × 900`)
- Supervisor-approved scope exception: `src/root.tsx` and `src/root.test.tsx` may add only the Newsreader 600 font request needed by Home headings.

### Before-remediation mismatch ledger

| Region / node | Figma | Implementation before | Severity |
| --- | --- | --- | --- |
| Page `128:870` | Full editorial Home, 2640px high | Stops after Hero and generic footer at 900px | Critical |
| Navigation `23:11` | Floating 1280×72 card at x80/y18, official image logo, four primary links, journey link and CTA | Full-width 80px border header, text `BLUE`, three unrelated links | Critical |
| Hero `128:874` | 1280×650 at x80/y96; 24px radius, 3px white image frame and left veil | 1168×650 inside a 1200px shell; different inset, crop, typography and veil | Important |
| Booking `128:892` | 1168×128 at x135/y584 with fixed field geometry and 180×56 CTA | Different form columns, live empty values and control geometry | Important |
| Product truths `128:915` | Three numbered promises in 1280×96 strip | Missing | Critical |
| Popular routes `128:936` | Heading, annotation and four 308×240 image cards | Missing | Critical |
| Trust `128:961` | 1280×430 split image/content panel | Missing | Critical |
| Support `128:1047` | 1280×300 blue panel with CTA and 24/7 card | Missing | Critical |
| Footer `128:997` | 1280×390 editorial multi-column card with official logo | Generic one-line footer outside Home | Critical |
| Responsive | Full content must reflow without document overflow | Only Hero/shell currently covered | Important |

### Asset ledger

| Figma node | Local file | Intended callsite | Intrinsic size | Figma rendered geometry |
| --- | --- | --- | --- | --- |
| `163:11` | `src/assets/brand/blue-official-logo.png` | `BrandLogo` header + footer | 1021×406 PNG | 110×40 within 126×48 lockup |
| `128:875`, `128:964` | `src/assets/home/hero-bus.png` | `HomeHero` and reused by `TrustJourney` | 1536×1024 PNG | Hero 1280×650; trust crop 560×430 |
| `128:937` | `src/assets/home/route-ho-chi-minh-da-lat.png` | Popular route card 1 | 1672×941 PNG | 308×240, cover |
| `128:943` | `src/assets/home/route-ha-noi-sa-pa.png` | Popular route card 2 | 1672×941 PNG | 308×240, cover |
| `128:949` | `src/assets/home/route-da-nang-hue.png` | Popular route card 3 | 1672×941 PNG | 308×240, cover |
| `128:955` | `src/assets/home/route-nha-trang-da-lat.png` | Popular route card 4 | 1672×941 PNG | 308×240, cover |
| `128:897`, `128:902`, `128:907`, `128:912` | `src/assets/home/search-dot.svg` | Four `SearchForm` controls | 16×16 SVG | 16×16 |

### After-remediation evidence

| Case | Implementation evidence | Result | Verdict |
| --- | --- | --- | --- |
| Home desktop `128:870` | `docs/quality/evidence/home/implementation-final-1440.png` (`1440 × 2640`) | Official logo, all seven required regions, exact desktop section anchors and full editorial footer present | **Supervisor ACCEPT** |
| Home responsive | `docs/quality/evidence/home/implementation-final-360.png` | Full content reflows; route cards use an internal scroller; no document overflow | **Supervisor ACCEPT** |

The live SearchForm deliberately retains canonical mock data, validation and SPA navigation. Its empty/default values therefore differ from the static sample values shown in the Figma booking box; this is a dynamic contract, not a visual waiver, and remains subject to the Supervisor verdict.

### Verification evidence

- RED: focused Vitest failed because `BrandLogo` did not exist, Home lacked `Cam kết dịch vụ`, and root did not request Newsreader 600.
- GREEN focused unit/integration: 6 files, 33 tests passed.
- Breakpoint regression: `breakpoints.test.ts` plus isolated `PassengerDetailsPage.test.tsx` passed 13/13 with one worker.
- Home behavior/responsive: 10/10 passed at 360/768/1024/1440/1920; canonical search validation/navigation and document overflow contract retained.
- Exact fidelity: 2/2 passed at 360/1440. Desktop assertions cover header `80,18,1280,72`, hero `80,96,1280,650`, booking `135,584,1168,128`, truths y782, first route card `80,1026,308,240`, trust `80,1338,1280,430`, support y1814 and footer y2180.
- Home visual snapshots: 2/2 passed without update at 360/1440 after direct image inspection.
- Accessibility: customer axe flow 5/5 and keyboard/focus 5/5 across the viewport matrix, with zero serious/critical findings after making the internal route scroller keyboard-focusable.
- Coverage: 116/116 files and 1081/1081 tests passed; 96.26% statements, 91.58% branches, 96.90% functions and 97.10% lines.
- Formatting, ESLint zero-warning and TypeScript passed on Node 24.22.0.
- Production build, prerender tests 2/2 and static deep-link verification 3/3 passed. The React Router build must run outside the filesystem/network sandbox because its temporary loopback preview server is part of prerendering.
- A full non-Home visual invocation reports expected stale baselines where the shared Customer header/footer now renders the official image logo. Task 1 updates only the two approved Home baselines; those other canonical screens remain explicit later Plan 07 tasks and were not silently rebaselined.
- Runtime source scan found no temporary Figma asset URL and no text-only logo callsite in the implemented Home/header/footer path.

### Supervisor verdict — 2026-10-25

Supervisor independently reopened Figma node `128:870` in session `f842504f-7605-4c57-a75d-d66e244c60df`, inspected the 1440×2640 reference beside the final 1440 and 360 captures, reviewed the full Task 1 diff and returned two Important findings. Fix commit `77dce45` moved all new color/effect primitives into the canonical semantic token layer and removed byte-identical duplicate hero/icon assets.

Independent verification passed: formatting, ESLint zero-warning, TypeScript, focused unit 40/40, Home behavior/fidelity 12 pass with 3 matrix skips, Home visual non-update 2 pass with 3 matrix skips, customer axe/keyboard 10/10, production build, prerender 2/2 and deep links 3/3. One unrelated booking hook network-timing failure occurred in an independent whole-coverage invocation and passed immediately in isolation 11/11; Worker retained a clean whole-coverage run of 1081/1081 before the token fix, while focused token/Home tests after the fix passed 39/39.

**Verdict:** Task 1 is accepted with zero open Critical/Important findings. Task 2 may begin. The expired static date/sample values in Figma are not copied into live form defaults because doing so would violate the canonical validation contract; this limitation is explicit and is not presented as copy-equivalence.

### Supervisor review remediation

- I1 semantic tokens: toàn bộ color/shadow primitive trong CSS Task1 đã chuyển về canonical semantic roles ở `src/styles/tokens.css`; `src/styles/tokens.test.ts` khóa source contract.
- I2 asset reuse: SHA-256 xác nhận `home-hero-bus.png` trùng `hero-bus.png` (`F3072762...C2323C4`) và `booking-leading-icon.svg` trùng `search-dot.svg` (`E81D2018...C6C9F6`). Callsite/ledger dùng lại hai canonical local assets; hai duplicate đã xóa.
- Static SearchForm sample khác live canonical values được Supervisor chấp nhận có điều kiện vì ngày mẫu Figma đã quá hạn; không claim copy-equivalence và không phá validation.

## Task 2 — Customer Search Results Desktop

- Figma file: `OCkWSOZQ8Pq8AejXccajpO`
- Canonical node: `28:30` (`1440 × 1280`)
- Route: `/trips?originId=loc-hcm&destinationId=loc-dalat&departureDate=2099-01-01&passengerCount=2`
- Figma session: `e2d0e5de-0767-4e27-af73-463aaa70c1fa`
- Figma reference: `docs/quality/evidence/plan07-task2/figma-results-28-30-w1440.png`
- Before implementation: `docs/quality/evidence/plan07-task2/results-before-w1440.png` (`1440 × 1293`, four cards)

### Before-remediation mismatch ledger

| Region / node | Figma | Implementation before | Severity |
| --- | --- | --- | --- |
| Search panel `215:79` | 1280×190 card at x80/y112, trip-type pills, four 72px facts and 276×56 CTA | Missing entirely | Critical |
| Results composition | Sidebar x80/w260 and content x370/w990 beginning y336 | Full-width filters above heading/cards; no two-column Results shell | Critical |
| Filters `215:105` | 260×850 sidebar with vehicle catalog, time-of-day, departure hour, price range, amenities and apply action | One horizontal card containing only sort and vehicle selects | Critical |
| Heading/sort | Route heading at x370/y336, 24-result count, three sort pills | Different wording/province labels; summary/edit link; no pill sort family | Important |
| Cards `215:156`–`215:266` | Six distinct 318×300 cards in a 3×2 grid | Four cards; fourth wraps alone; card geometry/content is taller and includes extra dates/route line | Critical |
| Card assets | Exact operator marks, bus/route/ticket marks rendered at 42/20/48/8/19px slots | Text initials plus Phosphor/CSS substitutes | Important |
| Pagination `215:288`–`215:296` | “1–6 trong 24” plus previous/1/2/next controls | Missing | Critical |
| Frame height | Canonical content ends around y1186 inside 1280px frame | Generic footer extends document to 1293px; main content spacing differs | Important |
| Responsive | Full search/filter/card/pagination content must reflow and preserve all interaction at 360px | Existing mobile drawer covers only two filter controls; no full content contract | Important |

The static Figma date `28/08/2026` is expired relative to the execution date. The live deterministic fixture keeps the canonical valid date `01/01/2099`; geometry and display formatting must still match the Figma field without weakening search validation.

### Task 2 remediation and evidence

- Final implementation captures: `docs/quality/evidence/plan07-task2/results-after-w1440.png` (`1440 × 1280`) and `results-after-w360.png` (`360 × 2899`). Both were inspected directly after the final 44px target and desktop frame-height fixes; the visual baselines were then verified in non-update mode.
- The Figma hierarchy is complete: header/logo, search panel `215:79`, filter panel `215:105`, six individually rendered cards `215:156/178/200/222/244/266`, count/sort controls and pagination `215:288–296`. The generic customer footer is intentionally absent because node `28:30` owns the complete 1280px frame.
- The only content exception is the expired Figma sample date: the implementation keeps valid `2099-01-01`. The six visible records match the exact Figma operator, vehicle, terminal, time, duration, seat and fare copy: `BLUE Expres.`, `An Lạc`, `Thiên Việt`, `Minh Châu`, `Cao Nguyên`, and `Đồi Xanh`. Stable booking IDs and source order remain; fare, timestamps, availability and typed vehicle layout are canonical operational values shared with booking. Only human-readable operator/vehicle/terminal labels and amenities remain presentation metadata.
- Route headings and search facts resolve labels from the current origin/destination IDs; the Đà Nẵng → Hà Nội test prevents HCM/Đà Lạt hardcoding. `Phù hợp nhất`, `Giá thấp nhất` and `Khởi hành sớm` map respectively to stable fixture order, ascending displayed fare and ascending displayed departure time.
- The route has 24 unique deterministic records. Page 1 contains the six exact Figma records; accessible numeric windows expose pages 2–4 and unique real records without an extra request. The complete filter draft is applied atomically to URL state; vehicle, period, departure threshold, min/max fare and every amenity deterministically filter typed presentation metadata. Reset removes only filter/sort/page state and preserves the canonical route.

### Task 2 asset ledger

All files below came from the official context for node `28:30` or its visible child families in Figma session `e2d0e5de-0767-4e27-af73-463aaa70c1fa`. They are local SVGs with no temporary Figma URL. SHA-256 comparison found no byte-identical asset already present in the repository.

| Figma source | Local file / callsite | Intrinsic → rendered geometry | SHA-256 prefix |
| --- | --- | --- | --- |
| Search `215:79` origin mark | `origin.svg` / `TripResultsPage.tsx` | 18×18 → 18×18 | `3B87779B` |
| Search `215:79` destination mark | `destination.svg` / `TripResultsPage.tsx` | 18×18 → 18×18 | `0E429EA8` |
| Search `215:79` calendar mark | `calendar.svg` / `TripResultsPage.tsx` | 18×18 → 18×18 | `6126E7A3` |
| Search `215:79` passenger mark | `passengers.svg` / `TripResultsPage.tsx` | 18×18 → 18×18 | `B235A471` |
| Filters `215:105` select chevron | `chevron.svg` / `TripFilters.tsx` | 12×8 → 12×8 | `D0E0B4D8` |
| Filters `215:105` clock | `clock.svg` / `TripFilters.tsx` | 18×18 → 18×18 | `294B909B` |
| Filters `215:105` range handles | `range-thumb.svg` / `TripFilters.tsx` | 16×16 → 16×16 | `7806E3BE` |
| Cards `215:156–266` operator marks | `operator-blue.svg`, `operator-green.svg`, `operator-gold.svg` / `TripCard.tsx` | 42×42 → 42×42 | `A19C5E14`, `DFC67D65`, `215F2B37` |
| Cards `215:156–266` vehicle mark | `bus.svg` / `TripCard.tsx` | 20×20 → 20×20 | `9FF74695` |
| Cards `215:156–266` route line/destination | `route-line.svg`, `route-destination.svg` / `TripCard.tsx` | 48×1.5 → 48×3; 8×8 → 8×8 | `50D546EC`, `3F5E4BAB` |
| Cards `215:156–266` seat/ticket mark | `ticket.svg` / `TripCard.tsx` | 19×19 → 19×19 | `8D6263A8` |

### Task 2 RED → GREEN and verification

- RED structural/presentation tests first recorded the old four-card layout, missing top search/sidebar/pagination, wrong mark sources and incomplete mobile filter contract. Fixture tests also failed before the canonical route contained 24 unique records.
- GREEN focused unit/integration: 10 files, 161/161 tests. Results fidelity plus critical booking: 7 tests executed, the final rerun left Results/Home fidelity 2/2 and critical booking 3/3 green; the URL filter race was fixed by waiting for the pressed sort state before changing vehicle type.
- Five-width behavior: Trips + responsive suites passed 30/30 at 360/768/1024/1440/1920 with no document overflow. Accessibility/keyboard passed 8/8 at 360 and 1440. Results-only visual passed 2/2 in non-update mode at 360 and 1440.
- Approved fixture-contract migration changes only stale `expectCount(4)` assertions to `expectCount(24)` in downstream E2E/page objects. Critical booking behavior, selectors, navigation and state expectations were not changed.
- Full coverage passed 117 files / 1112 tests (96.27% statements, 91.94% branches, 96.84% functions, 97.13% lines). One unrelated passenger double-submit timing test failed during the first high-concurrency run, passed 11/11 in isolation, then passed in the clean full rerun. Format, ESLint, TypeScript, production build, prerender 2/2 and three static deep-link checks all passed.

### Task 2 Supervisor finding remediation

- I1: exact six-card content is locked by fixture, component and browser assertions. A later consistency review removed duplicate operational `display*` fields: the card and selected booking now consume the same canonical fare, timestamps, availability and typed layout. Human-readable vehicle labels remain separate only where Figma marketing copy cannot name the current seat enum exactly.
- I2: route/search labels are query-derived and the non-HCM/Dalat integration case passes.
- I3: sort labels, typed values, handler order and URL state are consistent; `relevance` is the default from Home and omits the redundant URL parameter.
- I4: page 1 retains the Figma `1/2` appearance; subsequent windows include the current page through page 4, with 24 unique article IDs and no page-change request.
- I5: every enabled filter has deterministic selection coverage; desktop/mobile share a staged Apply contract, Reset contract, browser-verified native keyboard range input, Radix focus return and zero serious/critical axe findings.
- Final Results fidelity and non-update visual passed at 360/1440; Trips plus responsive passed 35/35 across 360/768/1024/1440/1920. Accepted Home visual/fidelity remained green. Only the two Results snapshots were regenerated and inspected directly.

### Open non-Task 2 visual finding

The non-update downstream visual run exposed shared-shell baseline drift already present at BASE `c19c7ab`; no unrelated baseline was updated. The latest downstream journey rerun again stopped at `customer-seats-sleeper`: w360 expected `360×1816` and rendered `360×1849`; w1440 expected `1440×1163` and rendered `1440×1196` (both exactly +33px). Earlier evidence also records cabin/auth/payment/cancellation family drift. These remain open for their corresponding Plan 07 screen tasks and are not used as Task 2 acceptance evidence; the functional critical journey is green.

**Worker verdict:** ready for review; Task 2 remains pending independent Supervisor acceptance.

## Task 3 — Seat Selection and Seat States

- Figma file: `OCkWSOZQ8Pq8AejXccajpO`
- Worker Figma session: `799a23c7-831c-4bdb-b655-84ebeafba9e4`
- Route family: `/booking/:sessionId/seats`
- Canonical nodes: sleeper `29:103`, cabin `234:4`, conflict `29:223`, expired `29:267`, six-seat limit `238:65` (`1440 × 1080` each)
- Figma references: `docs/quality/evidence/plan07-task3/figma-*-w1440.png`
- Implementation-before references: `docs/quality/evidence/plan07-task3/before-*-w1440.png`

### Before-remediation mismatch ledger

| Case / node | Deterministic setup | Figma | Implementation before | Severity |
| --- | --- | --- | --- | --- |
| Sleeper `29:103` | second canonical result; select A01+A02 | 1440×1080; content x80..1290, trip strip y220, map 800×650 at y340, summary 360×442; 34 sleeper cells | 1440×1196; heading/help/trip/map all shifted and scaled, generic footer adds 116px, map 864px wide, summary differs, seat icon/copy/state geometry differs | Critical |
| Cabin `234:4` | first canonical result; select A03 | Same frame anchors; exact 22-cabin two-deck layout, vehicle/count chips and room terminology | 1440×1263; generic footer; cabin deck/map height and rear technical cells differ; missing vehicle chip and room terminology | Critical |
| Conflict `29:223` | second result; hold A02 in competing session after own A01 | 580×400 dialog at x430/y320, exact red status header, B2 status card and 250×52 actions over intact 1080 frame | 540px dialog with different copy/spacing/status row, generic Phosphor icon, page/footer makes 1196px document | Critical |
| Expired `29:267` | advance original hold beyond 10 minutes | 580×400 expired dialog over the intact seat page; official `243:4` background + `243:5` clock assets, timer status row and two recovery actions | Replaces the seat page with a sparse Results PageState; no modal, no official expired assets, no seat context | Critical |
| Limit `238:65` | passengerCount6; select A01–A06; attempt A07 | 580×368 modal, exact limit status/6-of-6 row and two actions over seat page | Inline warning banner expands layout; no dialog/focus trap/state-specific actions | Critical |

Across all cases, the accepted official navigation logo is present. The implementation also uses live canonical trip/date/operator/fare data rather than the expired Figma sample data; Task 3 preserves that operational contract while matching hierarchy and geometry. The Figma summary includes a service fee not present in the approved fare contract, so Task 3 must not invent a charge. Each final case remains **pending Supervisor acceptance** until its own desktop/mobile evidence and verification are recorded.

### Task 3 remediation and evidence

- Final captures are `docs/quality/evidence/plan07-task3/final-{sleeper,cabin,conflict,expired,limit}-w1440.png` and the matching `-w360.png` files. All ten were captured independently and inspected after the 1440 geometry and modal alignment pass. Desktop remains the fidelity authority; 360 is the responsive adaptation.
- The seat route now owns its complete Figma frame and suppresses only the generic customer footer on exact `/booking/:sessionId/seats`. Home, Trips and generic customer routes retain their accepted ownership rules.
- Sleeper/cabin use the 800×650 map + 360×442 summary composition, 50px desktop gap, exact four-state legend terminology, two-deck hierarchy, room terminology and 22-room chip. The production fare contract has no service fee, so the implementation truthfully shows fare and total without inventing the static Figma fee.
- Conflict rollback remains atomic. Expiry no longer destroys the seat context: only a matching finite expired draft on the exact seat route remains mounted; missing/mismatched/invalid drafts and passenger/review/payment routes still redirect fail-closed. Recovery releases the hold and clears the draft before navigation. Six-seat overflow preserves all six selected IDs and opens a focus-managed dialog.
- RED evidence: the first focused run failed 7/39 tests for route/footer ownership, map/cabin terminology, conflict hierarchy, expired modal and limit modal. GREEN focused verification passes 49/49 across guard, layout, map, summary, conflict and page tests.

### Task 3 asset ledger

All assets below were exported from the exact expired-dialog descendants in Figma session `799a23c7-831c-4bdb-b655-84ebeafba9e4`, stored locally and rendered only by `SeatStateDialog.tsx`. The accepted official BLUE logo is reused through `BrandLogo`; the other seat cells are interactive UI controls rather than supplied static assets.

| Figma node | Local file / callsite | Intrinsic → rendered geometry | SHA-256 prefix |
| --- | --- | --- | --- |
| `243:4` expired background | `expired-icon-background.svg` / `SeatStateDialog.tsx` | 48×48 → 52×52 container | `B06F9FE3` |
| `243:5` clock outline | `expired-clock-outline.svg` / `SeatStateDialog.tsx` | 20×20 → 20×20 | `5DEA4644` |
| `243:6` vertical hand | `expired-clock-hand-vertical.svg` / `SeatStateDialog.tsx` | 2×7 → 2×7 | `30E966FA` |
| `243:7` horizontal hand | `expired-clock-hand-horizontal.svg` / `SeatStateDialog.tsx` | 6×2 → 6×2 | `CCBAE3D8` |

### Task 3 case verdicts

| Case / node | Final 1440 and 360 evidence | Worker verdict |
| --- | --- | --- |
| Sleeper `29:103` | `final-sleeper-w1440.png`, `final-sleeper-w360.png` | Pending Supervisor acceptance |
| Cabin `234:4` | `final-cabin-w1440.png`, `final-cabin-w360.png` | Pending Supervisor acceptance |
| Conflict `29:223` | `final-conflict-w1440.png`, `final-conflict-w360.png` | Pending Supervisor acceptance |
| Expired `29:267` | `final-expired-w1440.png`, `final-expired-w360.png` | Pending Supervisor acceptance |
| Six-seat limit `238:65` | `final-limit-w1440.png`, `final-limit-w360.png` | Pending Supervisor acceptance |

The static Figma date/operator/stops and example selected codes are prototype data. The implementation preserves the accepted canonical deterministic trip/session data and exact behavior while matching presentation geometry; it does not claim text/data equivalence for those live values. Task 3 remains **pending independent Supervisor acceptance**.

### Task 3 verification

- Focused unit/integration: 49/49 passed across the route guard, shared layout, seat map, booking summary, conflict dialog and seat page.
- Independent state evidence: 5/5 passed; each sleeper, cabin, conflict, expired and six-seat-limit case produced its own final 1440 and 360 capture and overflow/geometry assertions.
- Seat-state visual snapshots: 10/10 passed in non-update mode after the final evidence images were inspected.
- Accessibility and interaction: axe 2/2 and keyboard journey 2/2 at 360/1440; responsive customer journey 5/5 at 360/768/1024/1440/1920; critical booking behavior 3/3.
- Full coverage: 117/117 files and 1119/1119 tests passed, with 96.15% statements, 91.97% branches, 96.63% functions and 96.99% lines. The completed Vitest report left an idle process handle, so the process was interrupted only after the full passing report and coverage artifacts were written.
- Formatting, ESLint zero-warning and TypeScript passed on local Node 24.22.1. Production build/prerender passed outside the localhost-restricted sandbox, followed by prerender tests 2/2 and static/deep-link verification.
- Worker verdict remains **ready for review**; every Task 3 case remains pending the Supervisor's independent Figma comparison and acceptance.

### Task 3 Supervisor acceptance

Supervisor independently reopened all five exact nodes in Figma session `920b2853-4ccd-4a77-a16c-5bca459a3890` and inspected each canonical 1440 frame beside its final 1440 and 360 implementation evidence. Review round 1 rejected the library-substituted seat icons, expired-dialog copy/action hierarchy and incomplete conflict/limit status hierarchy. Fix commit `da240d5` proved the seat mark is the native Figma `Gối` rounded-rectangle primitive (sleeper 26×5 radius 3; cabin 28×5 radius 3), removed the icon-library substitutions and corrected all three modal variants.

Independent verification passed: Prettier, ESLint zero-warning, pinned Node 24 TypeScript, all Vitest files/tests 117/117 and 1120/1120, exact five-case evidence 10/10 at 360/1440, non-update seat-state visual 10/10, customer axe/keyboard 4/4 and production build with prerender 2/2 plus deep links 3/3. Vitest retained an idle handle only after printing its complete all-pass report; the parent process was interrupted after the result was fully emitted.

**Verdict:** Supervisor **ACCEPTS Task 3** at commits `f066438` and `da240d5`; sleeper `29:103`, cabin `234:4`, conflict `29:223`, expired `29:267` and six-seat limit `238:65` each have an individual accepted verdict with zero open Task 3 Critical/Important findings. Task 4 may begin.

### Task 3 Supervisor round 1 remediation

- Worker Figma session `1c52847f-dc21-45c4-af3e-684ae32ad3f7` inspected exact sleeper/cabin seat descendants. Nodes `232:69`, `232:128`, `232:93`, `234:175`, `234:181` and `234:238` prove the visible mark is a native rounded-rectangle `Gối`, not a static asset: sleeper intrinsic/rendered geometry is 26×5 with 3px radius; cabin is 28×5 with 3px radius. `Seat.tsx` now renders this exact semantic primitive at `.seat__pillow`; all Phosphor Armchair/Check/Clock/Lock/Prohibit substitutions were removed. State continues through background/border/text/pillow tokens without changing button, disabled, pressed or keyboard semantics.
- Expired `29:267` now uses exact `PHIÊN GIỮ GHẾ`, two Results-owned recovery links, and a solid-blue `Kiểm tra lại chuyến` primary. Both actions still release the hold and clear the draft.
- Conflict `29:223` restores the code → strong unavailable label → helper hierarchy. Limit `238:65` now gives its icon/header the Figma error red and its right status detail the Figma brand blue; expired status copy remains independent.
- Regenerated evidence was inspected for all five cases at 1440/360. Evidence passed 5/5; Task 3 visual passed 10/10 in non-update mode; related axe and keyboard journeys passed 4/4 at 360/1440. Focused tests passed 59/59. Clean full coverage passed 117/117 files and 1120/1120 tests at 96.15% statements, 91.97% branches, 96.63% functions and 96.99% lines; the first high-concurrency run had one unrelated passenger timing timeout which passed immediately in isolation before the clean rerun. Format, lint, typecheck and build/prerender/deep-link verification passed. Verdict remains pending independent Supervisor acceptance.

### Task 2 canonical card-to-booking remediation

- Supervisor round 2 found that duplicate `display*` operational fields could make a selected trip change fare, time, availability or layout after CTA. Those fields were removed from the TypeScript type, Zod response boundary, fixtures, filter/sort logic and TripCard.
- `trip-hcm-dalat-early` now canonically carries 07:00→13:30, 320.000 VND, 6 available seats and `cabin-22`; `trip-hcm-dalat-cabin` canonically carries 08:00→14:15, 280.000 VND, 12 available seats and `sleeper-34`. Their stable IDs/order remain unchanged. Integration coverage reads each visible card, selects it, then verifies the created session and physical seat layout use the same canonical values.
- The fixture-contract migration updated only assertions directly invalidated by the canonical truth. The first-card cabin flow exposed a 4.48:1 technical-label contrast issue; with Supervisor approval `.seat-map__technical` now reuses `--color-text-secondary`, with no geometry or global-token change.
- Verification for this round: focused downstream 117/117 plus SeatMap 5/5; full coverage 117 files / 1115 tests at 96.27% statements, 91.93% branches, 96.84% functions and 97.13% lines. Trips plus critical booking passed at all five widths (the initial cold w360 run had four navigation timeouts; immediate unchanged w360 rerun passed 6/6). Results fidelity and non-update visual passed at 360/1440; customer axe plus critical booking passed 8/8 at 360/1440 after the contrast fix. No non-Results snapshot was updated.
- Rendering geometry/assets did not change in the canonical consolidation, so existing final screenshots remain `results-after-w1440.png` and `results-after-w360.png`.

### Task 2 Supervisor acceptance

Supervisor independently reopened Figma node `28:30` in session `b4e2f2bf-8a36-43e7-9f8d-e05670d8742d`, requested design context plus a fresh 1440×1280 screenshot, and inspected it beside the final 1440 and 360 implementation captures. Two review rounds rejected contradictory content, hardcoded route labels, incorrect sort semantics, incomplete pagination, inert filters and duplicate operational `display*` data before acceptance.

Independent verification passed: Prettier, ESLint zero-warning, pinned Node 24 TypeScript, full coverage 117 files / 1115 tests, Trips 15/15 over 360/768/1024/1440/1920, Results fidelity/visual plus customer axe/keyboard/critical booking 10/10 at 360/1440, and production build with prerender 2/2 and deep links 3/3. Only the two Results baselines differ from accepted Task 1 BASE.

**Verdict:** Supervisor **ACCEPTS Task 2** at commits `797e082`, `0a8837f` and `3a1467a`; zero open Task 2 Critical/Important findings. The expired static Figma date remains the sole documented content exception. The pre-existing downstream shared-shell offset is carried into the exact owning screen tasks and is not a Results waiver. Task 3 may begin.

## Task 4 — Passenger Details and Booking Review

- Figma file: `OCkWSOZQ8Pq8AejXccajpO`
- Worker Figma sessions: `2f90b50e-7291-4baf-b929-2b57825b481b` (initial asset/context pass) and `73528f2c-a6dc-40da-879f-fd7a18d1491c` (resumed exact-frame inspection)
- Passenger: node `30:344`, route `/booking/:sessionId/passengers`, frame `1440 × 1040`
- Review: node `30:416`, route `/booking/:sessionId/review`, frame `1440 × 1040`

### Before-remediation mismatch ledger

| Case / region | Figma | Implementation at BASE `60f9c46` | Severity |
| --- | --- | --- | --- |
| Passenger frame `30:344` | Route-owned 1040px frame; content x80..1360, heading y154, 820/430 columns at y230 | Generic footer extended the page; nested main/page padding narrowed and shifted both columns | Critical |
| Passenger form `30:359` | Two 158px seat cards, shared 134px pickup and 178px delivery/note card inside an 820×730 shell | Generic cards/contact grouping, library icons and different hierarchy/spacing; note and official marks absent | Critical |
| Passenger summary `244:112` | 430×700 operator-aware summary, route/pickup, seat/passenger/fare rows and 52px CTA | Generic 442px summary lacking operator/pickup and detailed rows | Critical |
| Review frame `30:416` | Separate route-owned 1040px frame with 820/430 columns at y230 | Generic footer and nested padding produced taller, shifted content | Critical |
| Review content `30:431` | 720px shell with 188px journey, 210px passenger/pickup, 154px policy and 72px consent cards | Stacked generic sections, extra contact region, library marks, missing timeline/status hierarchy | Critical |
| Review summary `248:114` | 430×720 payment summary with operator, compact route, fare rows, payment notice and two actions | Generic journey summary lacked payment-specific hierarchy and back action | Critical |
| Responsive | All content retained and stacked without document overflow at 360/768/1024/1440/1920 | Shared shell/footer drift and wide card assumptions produced height/geometry drift | Important |

The implementation keeps the accepted canonical trip/session values from Task 2. Therefore its operator, stop, date, fare and check-in time are derived from the selected live mock trip instead of copying the unrelated RedLine sample values embedded in these Figma frames. Check-in is derived as 20 minutes before departure. No invented service fee or promotion changes the canonical booking total.

### Task 4 asset ledger

All assets were exported from the exact visible descendants of nodes `30:344` and `30:416`, stored under `src/assets/booking/passenger-review`, and referenced locally with no temporary Figma URL.

| Figma node | Local file / callsite | Intrinsic → rendered geometry | SHA-256 prefix |
| --- | --- | --- | --- |
| `244:49`, `244:76` | `user.svg` / `PassengerForm.tsx` | 20×20 → 20×20 | `C3CC4D19` |
| `259:346`, `259:350` | `mobile.svg` / `PassengerForm.tsx` | 20×20 → 20×20 | `DDEF9F0D` |
| `244:101` | `mail.svg` / `PassengerForm.tsx` | 20×20 → 20×20 | `66F9CF4F` |
| `244:108` | `note.svg` / `PassengerForm.tsx` | 20×20 → 20×20 | `AD30B847` |
| `244:62`, `244:66` | `pin.svg`, `chevron.svg` / `PassengerForm.tsx` | 20×20, 18×18 → same | `AF866105`, `C22BE6C3` |
| `244:118`, `244:129` | `bus.svg`, `pickup.svg` / `BookingSummary.tsx` | 24×24, 18×18 → same | `2CED3CEE`, `EC03C659` |
| `248:45`, `248:60` | `review-bus.svg`, `timeline-bus.svg` / `BookingReview.tsx` | 24×24, 18×18 → same | `C9A04CA4`, `63D7C22B` |
| `283:316`, `283:320` | `passenger.svg`, `phone.svg` / `BookingReview.tsx` | 22×22, 14×14 → same | `8FA3CD38`, `EE60BFB7` |
| `283:336` | `review-pickup.svg` / `BookingReview.tsx` | 22×22 → 22×22 | `5323A8B2` |
| `248:98`, `248:104`, `259:354` | `policy.svg`, `quote.svg`, `verified.svg` / `BookingReview.tsx` | 22×22, 22×22, 26×26 → same | `42BD4CC8`, `977B6D74`, `33596AA1` |
| `248:120` | `summary-bus.svg` / `BookingSummary.tsx` | 24×24 → 24×24 | `64804327` |

### Task 4 final evidence and verification

| Case | Final evidence | Supervisor verdict |
| --- | --- | --- |
| Passenger `30:344` | `docs/quality/evidence/plan07-task4/final-passenger-w1440.png`, `final-passenger-w360.png` | Accepted |
| Review `30:416` | `docs/quality/evidence/plan07-task4/final-review-w1440.png`, `final-review-w360.png` | Accepted |

Both final desktop/mobile pairs were captured independently after implementation and inspected directly. The canonical live booking values intentionally replace the unrelated RedLine/static-date prototype content; hierarchy, geometry and official marks remain the fidelity target. The four Task4 visual baselines pass in non-update mode. No downstream baseline was updated.

- RED presentation/ownership tests failed before implementation; focused GREEN is 47/47 across PassengerForm, BookingReview, BookingSummary, both pages and CustomerLayout.
- Figma fidelity 4/4, evidence capture 2/2, Task4 visual 4/4, customer axe/keyboard 4/4, five-width responsive 5/5 and critical booking 6/6 passed.
- Format, ESLint zero-warning, React Router typegen and TypeScript passed. Full coverage reported 117/117 files and 1124/1124 tests at 96.13% statements, 92.04% branches, 96.59% functions and 96.99% lines; the Vitest parent retained an idle handle only after the complete report was emitted and artifacts were written.
- Production build, prerender 2/2 and static/deep-link verification passed.
- Carry-forward only: the unchanged Task5 VNPay baselines retain pre-existing shared-shell height drift (`w360` expected 360×2505 vs actual 360×2521; `w1440` expected 1440×1251 vs actual 1440×1284). This is recorded for Task5 and is not waived or rebaselined by Task4.

### Task 4 Supervisor acceptance

Supervisor independently reopened both exact nodes in fresh Figma session `fe6f9123-9ddd-4867-bdca-57b12dad1e32`, fetched their design contexts/screenshots and compared the canonical 1440 frames directly with all four final 1440/360 implementation captures. The full diff from BASE `60f9c46` was reviewed; all 17 official marks are local non-empty SVG files with documented node, callsite, rendered geometry and SHA-256 prefix, and no temporary Figma asset URL is present in runtime source.

Independent verification passed: Prettier, ESLint zero-warning, pinned Node 24 React Router typegen/TypeScript, coverage 117/117 files and 1124/1124 tests at 96.13% statements / 92.04% branches / 96.59% functions / 96.99% lines, exact Task4 fidelity/evidence/visual 12/12 at 360/1440, customer axe/keyboard plus critical booking 10/10, responsive journey 5/5 at 360/768/1024/1440/1920, and production build with prerender 2/2 plus deep links 3/3.

**Verdict:** Supervisor **ACCEPTS Task 4** at commit `fb96eb4`; Passenger `30:344` and Review `30:416` each have an individual accepted verdict with zero open Task4 Critical/Important findings. The unchanged VNPay drift remains owned by Task 5. Task 5 may begin.

## Task 5 — payment and electronic ticket (before remediation)

Fresh Figma session: `d7b10beb-e945-4749-93f3-3eb7a7885f88`. Exact context and screenshots were fetched for checkout `561:306`, processing `30:469`, failed `74:462`, and issued ticket `30:489`. Existing implementation captures were copied before production edits to `docs/quality/evidence/task-5/before/` at 1440 and 360.

| Case | Before mismatch ledger |
| --- | --- |
| Checkout `561:306` | Current generic stacked cards do not reproduce the 820/430 two-column frame, the 300/456 provider/detail geometry, exact 122px safety panel, provider mark hierarchy, or the 720px order summary. Carried shell drift is +33px at 1440 and +16px at 360. |
| Processing `30:469` | Current generic result card lacks exact ticket header/status/reference hierarchy, 650/318 body columns, status rail asset, exact 520px frame, and processing copy. |
| Failed `74:462` | Current generic result presentation lacks the failure status hierarchy, three-column hold metrics, exact warning/safety treatment, and 318px recovery controls. |
| Issued ticket `30:489` | Current ticket uses library bus/QR/status icons and generic facts/navigation; it lacks exact 812/308 ticket split, Figma timeline/perforation/ready assets, notches, and the bounded presentation-only QR slot. |
| Success/cancelled | Shared result component does not provide an individually testable state hierarchy; each still needs its own final evidence and verdict. |

All Task 5 verdicts remain **pending Supervisor acceptance**.

### Task 5 remediation and evidence

- The checkout route now owns the complete `1440 × 1040` frame: the 820px checkout panel and isolated 430px `BookingSummary` payment variant start at y230, while the generic customer footer is suppressed only for the exact checkout route. The accepted `default`, `passenger`, and `review` summary variants retain their prior copy and behavior.
- The payment-return family now uses the exact 1120×520 desktop ticket geometry from nodes `30:469` and `74:462`. Processing, pending/recheck, success, cancelled and failed/retry remain separate deterministic cases with their own 1440/360 captures and recovery behavior.
- The issued ticket route now uses the exact 1120×620 desktop composition and local ticket timeline, perforation, ready mark and presentation-only QR. The QR contains no ticket proof, access token or passenger data and explicitly does not claim scannability.
- Exact routes `/payment/:bookingId/vnpay`, `/payment/vnpay/return`, and `/tickets/:ticketCode` own their Figma frames. `/tickets/lookup`, malformed/nested paths and generic customer pages preserve the shared-footer contract.
- Final evidence is stored in `docs/quality/evidence/task-5/final/`; the matching Figma references are in `docs/quality/evidence/task-5/figma/`. Every final image was inspected directly before the visual baselines were verified in non-update mode.

The Figma prototype shows an expired 2026 sample journey and a 20.000đ service fee. The implementation preserves the already accepted deterministic 2099 journey and canonical 640.000đ booking total with a truthful zero service fee; it does not invent a charge or claim text/data equivalence. Presentation hierarchy and geometry, not unrelated prototype business data, are the fidelity contract.

### Task 5 asset ledger

All assets below were exported from exact visible descendants in Figma session `d7b10beb-e945-4749-93f3-3eb7a7885f88`. They are local runtime assets; no temporary Figma URL, emoji, CSS drawing or library substitute is used for a proprietary mark. The official BLUE logo is reused through the accepted `BrandLogo` component.

| Figma node / role | Local file / callsite | Intrinsic → rendered geometry | SHA-256 |
| --- | --- | --- | --- |
| `566:325` checkout safety mark | `src/assets/payment/payment-safety.svg` / `PaymentCheckout.tsx` | 24×24 → 24×24 | `4EF8D3A36270AD3A30E2AD000BD5602C76C222CCB8285808DE0FC982F687B926` |
| `561:398` payment summary bus | `src/assets/payment/summary-bus.svg` / `BookingSummary.tsx` | 24×24 → 24×24 | `07CDEAF163D86D99FC49E0B6AD386A97B57D5EE5A8A6BC5D0136C1E1624E4FFE` |
| `272:350` processing status dot | `src/assets/payment/status-dot.svg` / `PaymentResultCard.tsx` | 8×8 → 8×8 | `E3F6BC5691B631F073328BE2265FB373325E990B077A8576AF76240C7DD83405` |
| `272:366` processing safety mark | `src/assets/payment/processing-safety.svg` / `PaymentResultCard.tsx` | 20×20 → 20×20 | `BCC19464E9C3FF417A1BD435B8C77DBBA28B57B6B2151044C5AEBA21633BCA9A` |
| `272:374` payment progress rail | `src/assets/payment/progress-rail.svg` / `PaymentResultCard.tsx` | 28×174 → 28×174 | `50737020CB17FDA849F9062404B4E5FE6C56A1FEA73971A31494EA9A711A61A9` |
| `431:42` failed/cancelled shield | `src/assets/payment/failure-shield.svg` / `PaymentResultCard.tsx` | 20×20 → 18–20px | `52AD10008A2DDFFD9A6C583AF8E91276E47F9CC3153C7A6051D706E7D4D2E09F` |
| `281:383` ticket perforation | `src/assets/tickets/ticket-perforation.svg` / `TicketCard.tsx` | 2×455 → 2×455 | `BAC5CEE645F19DCE5013BE7F80116E15580515959AED36A7422B3CEEF233F069` |
| `281:393` ticket timeline | `src/assets/tickets/ticket-timeline.svg` / `TicketCard.tsx` | 290×34 → 290×34 | `8A8648B752D8B7F41BFB1D86D3B9085AD74A3893CEB22F2F804D6F1541AD07B1` |
| `281:412` ticket ready mark | `src/assets/tickets/ticket-ready.svg` / `TicketCard.tsx` | 22×22 → 22×22 | `7837901E2B85D4A419EE11CF7C0BB4485D3DAD66B6964F729A50B1C8669534C1` |
| `281:311` presentation-only QR | `src/assets/tickets/ticket-qr.png` / `TicketCard.tsx` | 230×230 → 230×230 | `41172C4DA03C6112F67A6E261559C64F2D6DD5FD7687974B35B44B562800371F` |

### Task 5 case verdicts

| Case | Node / deterministic setup | Final evidence | Supervisor verdict |
| --- | --- | --- | --- |
| VNPay checkout | `561:306`; matching live booking at `/payment/:bookingId/vnpay` | `checkout-w1440.png`, `checkout-w360.png` | Accepted |
| Processing | `30:469`; return scenario `pending` | `processing-w1440.png`, `processing-w360.png` | Accepted |
| Pending recheck | `30:469`; check transaction while still pending | `pending-recheck-w1440.png`, `pending-recheck-w360.png` | Accepted |
| Failed/retry | `74:462`; failed callback followed by retry/recheck actions | `failed-w1440.png`, `failed-w360.png` | Accepted |
| Cancelled recovery | return scenario `cancelled`; recover to journey/payment path | `cancelled-w1440.png`, `cancelled-w360.png` | Accepted |
| Success | successful callback and issued-ticket handoff | `success-w1440.png`, `success-w360.png` | Accepted |
| Issued ticket | `30:489`; bounded guest proof/session at `/tickets/:ticketCode` | `ticket-w1440.png`, `ticket-w360.png` | Accepted |

### Task 5 RED → GREEN and verification

- RED tests first locked the missing route-owned frames, payment summary variant, exact checkout/result/ticket geometry, state-specific labels/actions, official local assets and presentation-only QR contract. GREEN focused unit/integration passed 45/45.
- Payment/ticket browser behavior passed 16/16 at 360/1440. Exact fidelity passed 6/6; Task 5 visual passed 8/8 in non-update mode, and the final ticket baseline passed 2/2 again after wiring the official perforation asset. Accessibility interaction passed 2/2 with zero serious/critical axe findings.
- Responsive checks passed at 360/768/1024/1440/1920 with no document overflow. The initial 1024px layout mismatch was corrected through component breakpoints rather than relaxed assertions.
- Full coverage passed 117/117 files and 1133/1133 tests at 96.13% statements, 92.16% branches, 96.59% functions and 96.99% lines. One timer-sensitive passenger expiry assertion failed in the first run and passed in isolation before the clean full rerun; the completed Vitest report retained the previously documented idle handle and was terminated only after all results and coverage artifacts were written.
- Formatting, ESLint zero-warning and pinned Node 24.22.0 TypeScript passed. `verify:build` passed outside the localhost-restricted sandbox: production build, prerender 2/2 and deep links 3/3.
- Source scanning found no direct hex/rgb/hsl or non-token shadow primitive in the modified feature CSS. No unrelated Auth/Admin/Cancellation baseline was changed.

**Worker verdict:** ready for independent review with zero open self-review Critical/Important findings. Every Task 5 case remains **pending Supervisor acceptance**; Task 6 has not started.

### Task 5 Supervisor fix round 1 — responsive containment

Supervisor inspection rejected the initial Task 5 result because checkout and all five payment-return states had overlapping or clipped content at 360px, while desktop return cards had subtitle/card collision and success-row overflow. RED Playwright geometry coverage reproduced the problem with 11 failures out of 12 checks and measures every state independently rather than using a representative screen.

After replacing fixed mobile content heights with content-sized stacks, separating checkout safety/provider regions, and fitting success ticket rows inside the desktop card, the same geometry suite passed 12/12. The affected visual suite passed 8/8 in non-update mode. All checkout/processing/pending-recheck/failed/cancelled/success final 1440 and 360 captures were regenerated and inspected directly; meaningful content is contained and readable.

Regression gates passed: full Task 5 fidelity 16/16 at 360/1440; focused unit/integration 45/45; payment/ticket flows 24/24 at 360/1024/1440; customer axe 2/2 at 360/1440; responsive journey 5/5 across 360/768/1024/1440/1920; formatting, zero-warning lint, pinned Node 24 typecheck and production build/prerender/deep links. No unrelated baseline was updated. All Task 5 cases remain **pending Supervisor acceptance**.

### Task 5 Supervisor acceptance

Supervisor independently reopened exact nodes `561:306`, `30:469`, `74:462` and `30:489` in fresh Figma session `48d34517-96d7-4a89-8622-c9ba0a3dd8b1`, fetched all design contexts/screenshots and directly compared them with every 1440/360 final case. Initial review rejected three real overlap/containment findings; fix commit `90e106c` added per-state geometry tests and regenerated evidence with readable, content-sized responsive stacks.

Independent verification passed: Prettier, ESLint zero-warning, pinned Node 24 typecheck, coverage 117/117 files and 1133/1133 tests at 96.13% statements / 92.16% branches / 96.59% functions / 96.99% lines, Task 5 fidelity/geometry 16/16, non-update visual 8/8, payment/ticket behavior 24/24, customer axe 2/2, responsive 5/5 at 360/768/1024/1440/1920, and production build with prerender 2/2 plus deep links 3/3. The 10 local assets were checked for non-empty files, documented nodes/callsites/geometry/hashes; the presentation-only QR exposes no proof/token/PII and runtime source contains no temporary Figma URL.

**Verdict:** Supervisor **ACCEPTS Task 5** at commits `a276115` and `90e106c`; all seven cases have individual accepted verdicts and zero open Task 5 Critical/Important findings. Task 6 may begin.

## Task 6 — authentication screens (Supervisor accepted)

Fresh Figma session `07bbdc23-9ef1-4684-b32d-f9f6f1c921f2` fetched independent context and screenshots for Login `64:427`, Register `64:431`, and Forgot password `64:435`. BEFORE captures proved the old implementation included the generic customer header/footer, lacked the official in-frame logo/story treatment and displaced exact form content.

| Case | Route / deterministic setup | BEFORE mismatch | Evidence | Worker verdict |
| --- | --- | --- | --- | --- |
| Login `64:427` | `/login`; empty neutral form | Generic shell, missing in-frame logo/story card/input marks, wrong provider/copy/geometry | `docs/quality/evidence/task-6/figma/login-node-64-427-w1440.png`; `before/login-w1440.png`, `before/login-w360.png`; `final/login-w1440.png`, `final/login-w360.png` | Accepted |
| Register `64:431` | `/register`; empty neutral form | Generic shell, one-column desktop form, wrong exact copy/terms/geometry | corresponding `register-*` files in the same Figma/before/final folders | Accepted |
| Forgot `64:435` | `/forgot-password`; empty neutral form | Generic shell, missing exact recovery copy/three-step panel and story treatment | corresponding `forgot-*` files in the same Figma/before/final folders | Accepted |

### Task 6 asset ledger

All runtime assets are stable local files. The accepted official logo is reused through `BrandLogo`; no temporary Figma URL, text logo, emoji, CSS drawing, or library substitute is present.

| Exact node / visible role | Local file / callsite | Intrinsic → rendered geometry |
| --- | --- | --- |
| `64:427`, `64:431`, `64:435` official logo | `src/assets/brand/blue-official-logo.png` / `AuthShell.tsx` → `BrandLogo` | 1021×406 → 126×48 wrapper with 110×40 image at 8×4 inset desktop; 110×42 wrapper mobile |
| three exact frames / canvas backdrop | `src/assets/auth/backdrop.png` / `AuthShell.css` | 1672×941 → cover 1440×1024 |
| three exact frames / scenic bus | `src/assets/auth/scenic-bus.png` / `AuthShell.tsx` | 1226×1668 → 616×840 |
| `64:427`,`64:431` happy robot; `64:435` worried robot | `robot-happy.svg`, `robot-worried.svg` / `AuthShell.tsx` | 120×106 → 120×106 desktop; 100×88 mobile |
| Login/Register provider marks | `facebook.svg`, `google.svg` / `LoginForm.tsx` | 26/28px → 28×28 |
| exact input marks | `field-identity/name/phone/email/password/visibility.svg` / form CSS | source 18–20px → 18×18 |
| exact story layers/navigation for each node | `story-stack.svg`, `story-front-{login,register,forgot}.svg`, `story-arrow-{login,register,forgot}.svg`, `story-prev.svg`, `story-next.svg` / `AuthShell.tsx` | 260×132, 292×165, 44×44, 38×38 rendered |

RED presentation/route-boundary tests failed for missing exact content and the generic customer shell. GREEN focused unit/component is 48/48; fidelity evidence is 6/6, auth behavior 15/15 across five widths, responsive overflow 5/5, accessibility/keyboard 2/2, and auth visual 6/6 in non-update mode. All three cases remain **pending Supervisor acceptance**.

Supervisor fix round 1 identified that the desktop form zone in all three final cases was shifted 56px left even though shell/scenic bounds were correct. Geometry-first RED tests failed 3/3 on the existing commit, then the implementation moved the form zone to x=136 so its logo, tabs, headings and controls start at global x=210 and end at x=670. The back-home action retains its independent Figma coordinate near x=508. The shell remains `80,92,1280×840` and scenic panel remains `744,92,616×840`; direct image inspection confirms the official local scenic asset supplies the exact contour/cutout without a CSS substitute.

The regenerated final evidence paths above now contain the corrected 1440 layouts and unchanged clean 360 adaptations. Fix-round verification is fidelity 6/6, auth behavior/fidelity 12/12, responsive 5/5, axe/keyboard 2/2, visual non-update 6/6, coverage 117/117 files and 1143/1143 tests, plus format/lint/typecheck/build/deep links green. All cases still remain **pending Supervisor acceptance**.

Supervisor fix round 2 added nested official-logo geometry and independent vertical ledgers for all three exact frames. RED failed 3/3 when the logo image filled its 126×48 wrapper instead of the Figma 110×40 inset, then exposed each route's distinct vertical offsets. GREEN now renders the wrapper at x=210,y=148 with the official image at x=218,y=152; Login landmarks resolve to y=310/414/438/514/608/672/766, Register to y=304/408/432/532/614/696/820, and Forgot to y=322/430/454/578/648/796/896. The assertions cover assets, text landmarks, every representative control, recovery steps and back action; shared-component evidence is not used as a substitute.

All final 1440/360 images were regenerated and inspected without overlap. Round 2 verification is auth behavior/fidelity 12/12, responsive 5/5 across 360/768/1024/1440/1920, axe/keyboard 2/2, visual non-update 6/6, coverage 117/117 files and 1143/1143 tests, plus format/lint/typecheck/build/prerender/deep links green. These results were subsequently accepted by the Supervisor below.

### Task 6 Supervisor acceptance

Supervisor independently reopened exact nodes `64:427`, `64:431`, and `64:435` in fresh Figma session `324a260c-c124-4f47-976b-8ee11ef17b8c`, read their design contexts and directly compared each Figma screenshot with its own final 1440/360 implementation evidence. The first comparison rejected the 56px horizontal drift; the second rejected the oversized nested logo and route-specific vertical drift. Commits `fa218a2` and `e43a4c0` added geometry-first RED tests and fixed both rounds without treating a shared component as evidence for all cases.

Independent final verification passed: format, lint and Node 24 typecheck; Auth behavior/fidelity 12/12 at 360/1440; combined responsive, accessibility and visual run 16 passed with 9 intentional non-fidelity viewport skips; coverage 117/117 files and 1143/1143 tests at 96.09% statements / 92.15% branches / 96.45% functions / 96.97% lines; production build, prerender 2/2 and deep links 3/3. Official logo, scenic imagery, robot/provider/input/story assets are stable local files and runtime source uses no temporary Figma URL or text-logo substitution.

**Verdict:** Supervisor **ACCEPTS Task 6** at commits `d3833db`, `fa218a2`, and `e43a4c0`; Login, Register, and Forgot password each have an individual accepted verdict and zero open Task 6 Critical/Important findings. Task 7 may begin.

## Task 7 — cancellation and refund processing (Supervisor accepted)

Worker session `a476c890-c7ed-4fa1-ab89-d36b89b115bb` fetched separate context/screenshots for selection nodes `1109:311`, `1112:324`, `1112:463`, `1112:602`; confirmation nodes `1112:741`, `1112:925`; and processing nodes `1046:140`, `1112:876`, `1112:1060`. Each node has its own deterministic fixture/action sequence, before captures, mismatch ledger and final 1440/360 evidence in `docs/quality/evidence/task-7/case-matrix.md`; shared component evidence is not used as a substitute.

The implementation now renders the official logo, structured journey/operator/timeline, truthful A01/A02 selection amounts, 10% fee/90% refund, full confirmation composition and ticket-style processing progress. The typed mock contract preserves guest/account authority, exact-code access, partial cancellation, idempotent one-POST behavior and refresh restoration. Exact cancellation route ownership removes only the generic footer; malformed/nested and other customer routes retain the shared shell.

Nine official cancellation assets are stable local files, with accepted payment status/safety/progress assets reused by hash/callsite role. Feature CSS contains no direct color/shadow primitives; semantic cancellation tokens and their source-contract test cover all exact roles. Compact text roles were darkened after axe RED exposed 4.30–4.45 contrast, then both 360/1440 scans passed with modal focus trap/Escape/return behavior intact.

Verification is focused 64/64, exact nine-case visual/fidelity 18/18, five-width critical/responsive 10/10, accessibility 2/2, coverage 117 files and 1151/1151 tests at 95.99% statements / 92.11% branches / 96.28% functions / 96.88% lines, plus format/lint/typecheck/build/prerender/deep links green. All nine Worker verdicts remain **pending Supervisor acceptance** and Task 8 has not started.

### Task 7 Supervisor fix round 1 — focus modality

Supervisor rejected the initial selection evidence because pointer selection left a 3px `:focus-within` ring around the clicked row, unlike exact nodes `1109:311`, `1112:324`, and `1112:463`. RED browser coverage reproduced the visible ring. The selector now applies its row outline only through `:has(input:focus-visible)`: pointer selection has no outer ring, while an actual keyboard Tab transition retains the solid 3px focus indicator. Both/A01/A02 finals and snapshots were regenerated and inspected at 1440/360. Fix verification passed modality 2/2, full Task 7 fidelity/visual 22/22 non-update, five-width critical/responsive 10/10, axe/modal focus 2/2, focused 64/64, full coverage 1151/1151, and all static gates. The result was subsequently accepted below.

### Task 7 Supervisor acceptance

Supervisor independently reopened and compared all nine exact Figma cases in session `79a1b6de-847f-45f9-b9fe-2a0152257f39`. The initial output was rejected because selected rows retained a pointer-driven outer focus ring; fix commit `56e6145` added a real pointer-versus-keyboard RED test, removed the visual mismatch and retained a 3px keyboard-only focus indicator. Each selection, confirmation and processing case was inspected separately at 1440 and 360; shared component reuse was not accepted as substitute evidence.

Independent verification passed format, zero-warning lint and Node 24 typecheck; fidelity/visual/accessibility/critical checks 28/28 at 360/1440; additional critical/responsive checks 6/6 at 768/1024/1920, completing 10/10 across all five widths; stable single-worker coverage 117 files and 1151/1151 tests at 95.99% statements / 92.11% branches / 96.28% functions / 96.88% lines; production build, prerender 2/2 and deep links 3/3. Two default-parallel coverage attempts exposed different pre-existing timer/network flakes, while isolated and bounded single-worker runs passed without production or test changes.

**Verdict:** Supervisor **ACCEPTS Task 7** at commits `94d4a6e` and `56e6145`; all nine cases have individual accepted verdicts and zero open Task 7 Critical/Important findings. Task 8 may begin.
