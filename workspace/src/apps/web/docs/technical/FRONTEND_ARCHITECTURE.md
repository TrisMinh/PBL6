# Kiến trúc frontend

**Trạng thái:** Đã duyệt cho mock · **Cập nhật:** 2026-10-18

## Cấu trúc nguồn

```text
src/
├── app/                 # route config, providers, global error boundary
├── routes/              # React Router route modules
├── features/
│   ├── auth/
│   ├── trips/
│   ├── booking/
│   ├── payment/
│   ├── cancellation/
│   └── admin/
├── shared/
│   ├── api/
│   ├── config/
│   ├── layouts/
│   ├── lib/
│   ├── types/
│   └── ui/
├── mocks/               # handlers, fixtures, in-memory mock database
└── styles/              # tokens, global styles, custom BEM CSS
```

Mỗi feature chỉ tạo các thư mục cần dùng trong `api/`, `components/`, `hooks/`, `mappers/`, `repositories/`, `schemas/`, `types/` và `pages/`. Không tạo cấu trúc rỗng hàng loạt.

## Ranh giới

- `shared/ui` không nhập từ `features`.
- Feature không truy cập mock database trực tiếp.
- Page đọc route/search params, gọi feature hook và ghép layout.
- Hook gọi repository; repository chọn MSW/HTTP implementation.
- Mapper chuyển DTO sang domain model khi hình dạng khác nhau.
- TanStack Query giữ server state; Zustand giữ booking draft; form state ở React Hook Form.

## Rendering và SEO

React Router Framework Mode dùng Vite, `ssr: false`, prerender `/` và các trang nội dung/tuyến phổ biến có dữ liệu build-time. Route động dùng SPA fallback. Mọi code chạy trong initial render phải SSR-safe; truy cập `window`/`sessionStorage` chỉ sau hydration.

## Bảo vệ route

- `AdminRoute`: yêu cầu admin session hợp lệ.
- `BookingSessionRoute`: yêu cầu booking session tồn tại và chưa hết hạn.
- Ticket guest dùng lookup session ngắn hạn; không đưa số điện thoại/email vào URL.

### Contract guard mô phỏng — Plan 02, Task 8

- Auth session dùng key `blue-mock-session`, xuất từ `src/features/auth/config/session.ts`. Payload là `MockSession` gồm opaque UUID `token`, `userId`, role `customer | admin` và `expiresAt`; không email/password. `useMockSession` chỉ đọc storage trong effect, từ chối JSON/shape/date/token sai hoặc session hết hạn và trả `{ session, isHydrated }`.
- Guard hiển thị trạng thái kiểm tra trước hydration. Admin chưa đăng nhập/hết hạn chuyển `/login`; customer nhận 403 có link về trang chủ; admin hợp lệ được render Outlet. Đây là quyền mô phỏng frontend, không phải xác thực production.
- Clock snapshot gắn với `expiresAt` đã kiểm tra; khi thay session/draft có expiry khác, guard chờ effect xác minh clock mới, không dùng timestamp cũ để cho phép render tạm thời.
- Booking guard chỉ đọc selector `selectBookingSession` từ `features/booking/store/bookingDraftStore.ts`; route sessionId phải khớp draft, hoặc route `/payment/:bookingId/vnpay` phải khớp bookingId đã lưu trong draft. Cả hai cần expiresAt còn hiệu lực, nếu thiếu/sai/hết hạn chuyển `/trips?reason=expired`. Expiry được kiểm tra lại bằng timer và khi tab được kích hoạt.
- Plan 04 Task 1 đã mở rộng duy nhất `useBookingDraftStore` thành BookingDraft đầy đủ; `BookingSessionDraft` vẫn là projection sessionId/bookingId?/expiresAt cho selector guard. Tên `selectBookingSession`, `setDraft`, `clearDraft` được giữ; `setDraft` nhận draft đầy đủ thay boundary tối thiểu cũ. Optional bookingId được giữ cho Task 7 lưu kết quả tạo booking trước khi điều hướng thanh toán. Chưa có flow tạo session hoặc fixture mở guard trong sản phẩm.

### Booking draft persistence — Plan 04 Task 1

`features/booking/types/booking.ts` định nghĩa ContactDraft, PassengerDraft, BookingDraft và BookingSession (status active/expired/completed). Store chỉ giữ draft cần cho navigation: sessionId, bookingId?, tripId, selectedSeatIds, contact?, passengers, expiresAt và totalVnd. Không giữ server seat/trip entities, query cache hoặc countdown cục bộ. Actions setDraft/replaceSeats/setContact/setPassengers/clearDraft giữ expiresAt gốc; các patch không làm gì khi chưa có draft.

Zustand persist chỉ serialize `{ draft }`, name lấy từ một constant exported `BOOKING_DRAFT_STORAGE_KEY = blue-booking-draft`. Lazy StateStorage chỉ resolve sessionStorage khi action/hydration chạy, không đọc khi import/factory construction/initial render; skipHydration=true. `useBookingDraftHydration` gọi explicit rehydrate trong effect, cleanup bỏ completion khi unmount; BookingSessionRoute giữ GuardLoading đến khi hydration và clock sẵn sàng để refresh không redirect trước khi đọc draft. Factory createBookingDraftStore chỉ là test seam với fake storage; ứng dụng có một runtime store.

Hydration safe-parse payload bằng Zod trước merge, không cho persisted data thay action; chỉ nhận full shape, ISO UTC expiry còn hiệu lực và totalVnd integer không âm, bỏ unknown fields. JSON/shape/expiry sai hoặc expired bị từ chối và remove key, không log raw payload. Partial contact/passenger strings có thể rỗng khi còn là draft; validation form/business thuộc các task sau. Legacy minimal boundary không phải persisted format hợp lệ. clearDraft xóa memory và key; storage bị browser chặn không làm action throw, draft trong memory vẫn dùng được nhưng không bảo đảm chịu refresh. Expiry live vẫn do guard kiểm tra từ canonical expiresAt; workflow clear khi hoàn tất/expired và countdown thuộc các task sau.

## Ranh giới dữ liệu mock

Giữ repository interface, query key, domain model và component tách khỏi fixture/handler. Mọi màn hình phải chạy bằng MSW trong phạm vi dự án này; không tạo đầu việc backend hoặc database.

### Trip discovery data layer — Plan 03 Task 4

`useLocations`/`useTrips` gọi default `httpTripRepository` qua interface TripRepository; repository là fetch boundary riêng của slice, không thêm shared API client/envelope. Response schemas parse wire JSON trước khi trả readonly domain arrays; failure chỉ thoát ra dưới dạng TripRepositoryError với code/status/messageKey/canRetry an toàn. Không có toast/redirect trong repository, không show raw server body trong UI.

`tripKeys` tạo frozen readonly tuples, search snapshot copy đúng năm primitive fields tách khỏi caller. Hook search lấy input từ snapshot trong queryKey và forward TanStack Query signal, nên request khớp cache identity và bị hủy khi observer unmount. Query cache là server state; không đưa locations/trips vào Zustand hoặc import fixtures từ feature code. HomeHero dùng useLocations; TripResultsPage chỉ mount useTrips khi URL core hợp lệ. Query params giữ filter/sort có thể chia sẻ; presentation helper tạo array mới để sort/filter vehicleType UI-only, không sửa cache. Plan04 Task3 đã thay deferred callback bằng useCreateBookingSession; create-session response qua repository/schema rồi chiếu draft vào store và navigate canonical. Results không fetch/import mock trực tiếp.

### Mock seat/session continuity — Plan 04 Task 2

One authoritative in-memory mockDb contains deep-cloned trips/seats plus session, ownership and idempotency indexes. reset restores immutable seeds and removes the dedicated snapshot. Seat layouts follow Figma geometry, while per-trip availability is derived from canonical discovery seeds. Handlers alone access this state; no feature component imports it. No competing Zustand store or backend/database was added.

Supervisor-approved refresh ruling: default dev/test browser runtime has an optional lazy sessionStorage adapter under exported MOCK_BOOKING_STORAGE_KEY (`blue-mock-booking-db`), distinct from the client draft key. It reads once at the first booking request, never at module import/initial render. Successful requests and expiry responses save only active unexpired sessions and matching idempotency indexes; original expiresAt is preserved. Seats/ownership and availability are reconstructed from trusted fixture geometry/fare plus validated selected IDs, never persisted trip prices/layout. This is mock-only reload continuity, not production persistence. Browser bootstrap remains DEV-only and storage adapter rejects production mode; node factories default to no storage or injected fake storage.

Snapshot version1 is bounded to 100 sessions/100 keys and 262144 characters. Strict Zod shape plus known trip/available seed IDs, unique IDs/ownership, max6, canonical totals, passenger subset and original future ISO expiry (at most10min from hydration) are required. Any malformed/expired/inconsistent snapshot is discarded in full before mutation. No raw payload/PII is logged or echoed. Contact/passenger mock data may live only in that tab's sessionStorage; reset removes it, expiry clears it on the next request/hydration, and save omits completed sessions. Task8 completion must invoke the lifecycle cleanup when it is implemented. Storage denial retains working RAM but cannot guarantee reload continuity; sessionStorage is not cross-tab or cross-device coordination.

### Booking session mutation — Plan 04 Task 3

Results composes useCreateBookingSession above the keyed list. Repository/schema is the sole feature-local POST boundary; mutation success projects into existing draft store before bookingSeatsPath navigation. Synchronous hook-local lock blocks immediate duplicate/cross-card calls before React renders pending. Same mounted failed attempt reuses key for explicit retry; full route unmount aborts, increments run and suppresses stale store/navigation. Full remount is a new explicit UI attempt under Supervisor ruling; no shared WeakMap/competing store. Components import no fixtures/handlers or fetch; TripCard only receives typed pending/disabled props. UI target remains the guarded placeholder seat route; query/map/countdown and passenger/payment workflows are later tasks.

### Hold countdown utility — Plan 04 Task 4

getRemainingSeconds(expiresAt, nowMs=Date.now()) computes max(0,ceil((Date.parse(expiresAt)-nowMs)/1000)); invalid/non-finite expiry or clock returns0. The helper is pure with injected clock and has no browser-global dependency. useHoldCountdown(expiresAt) stores an expiry-keyed clock result, never decrements a local counter or renews expiresAt. Each timeout recomputes from Date.now and schedules min(1000ms,remaining milliseconds), so fractional final seconds stop at the actual expiry. Focus/visibilitychange refresh immediately after suspended/inactive tabs and replace the existing timer. Zero does not schedule another timer. Expiry change/unmount removes the exact timer/listeners; StrictMode replay retains one timer.

Intentional Supervisor-approved initial contract: SSR/first render and the first render of a replacement expiry return `{remainingSeconds:0,isExpired:false}` until that expiry's effect evaluates. Consumers must use isExpired, not infer expiry from remainingSeconds===0 before evaluation. The first effect sets actual positive remaining seconds or `{0,true}` for invalid/equal/past expiry. This prevents old-session values and premature clearing during hydration/replacement. No eager window/document reads; all browser subscriptions occur in the effect. Shared useSessionClock and guard contracts remain unchanged. Task4 adds no page integration; Task5 will consume this hook in SeatMap UI.
### Seat page and recovery — Plan 04 Task 5

The single BookingDraft now also requires validated passengerCount1..6. Persist and mock continuity share this required field; incompatible old local data is discarded safely. Results passes count to the create-session hook/repository, whose attempt identity includes trip and count. Refresh restores the original expiry, count, selection and total without reading navigation state.

SeatSelectionPage orchestrates useSeats/useReplaceSeats/useHoldCountdown and presentational SeatMap/BookingSummary/SeatConflictDialog. The feature HTTP boundary validates canonical trip+geometry; server Query cache and Zustand draft remain separate. Atomic optimism snapshots and restores both full resources for any error, checks session identity to suppress stale writes and aborts on unmount. Max6 and exact passenger-count continue gates are independent. Own held selection is interactive after refresh; unavailable seats remain disabled. The countdown has one subscription per page and no persisted decrement.

BookingSessionRoute remains unchanged. A dedicated Results expired PageState runs before normal search validation and never calls useTrips for incomplete core params. Expiry clears the local draft and initiates repository GET cleanup of expired server holds; offline server cleanup occurs on subsequent access. Trusted loaded trip metadata can preserve core search parameters using Vietnam service date; a guard-only redirect offers Home. No UI imports mockDb/fixtures or deletes mock storage keys. Completion clear remains Task8; structural contact/passenger endpoints remain unconnected until Task6.

### Passenger orchestration — Plan 04 Task 6

PassengerDetailsPage composes useSeats, one useHoldCountdown, useReplacePassengers, PassengerForm and the existing BookingSummary. It verifies exact count/unique held selected IDs and canonical fare total before rendering rows. Defaults copy persisted contact/passengers by seatId. RHF owns unsaved values; no competing store or per-keystroke persistence. The form's native external submit button lives in Summary through formId, preserving keyboard submit and one CTA. Initial query errors show recovery; a background failure keeps the form mounted, disables submission and offers retry.

The feature repository owns HTTP/runtime validation; useReplacePassengers owns synchronous duplicate lock, abort/run and exact-source guards. Success writes a detached verified full draft before review navigation. Failure leaves draft/storage/inputs unchanged. Neither page nor form imports mocks, calls fetch, creates a booking or renews expiry. Required explicit Contact and read-only trusted pickup are approved adaptations; notes/fees remain absent from the contract.

Expiry lifecycle correction: useBookingExpiry only initiates recovery navigation for the current session. Existing ExpiredBookingState owns authoritative GET release and clear after destination commit. Clearing while the guard is still mounted races its bare redirect and loses trusted core search params; a regression uses the real guard to protect this ordering. BookingSessionRoute and useSessionClock are unchanged.

Mock console privacy: enableMocking retains the dev/browser-only guard and starts MSW with quiet:true, disabling its automatic request/response-body logger. Tests cover dev quiet startup plus production/SSR skips; browser verification inspects console arguments as well as error text.

### Review and create-booking — Plan 04 Task 7

BookingReviewPage composes useSeats/useHoldCountdown/useBookingExpiry, presentational BookingReview, reused BookingSummary and useCreateBooking. canReviewBooking combines canonical held-seat/count/total correspondence with the existing passenger schema; incomplete drafts never get a mutation action. Policy details use native keyboard-operable disclosure. Client PII stays in trusted review/body/tab draft only; existing quiet MSW startup remains.

The hook persists bookingAttemptKey in the single canonical draft before HTTP, snapshots exact ownership and owns ref lock/run/abort. Explicit failure retry and full remount reuse that persisted key; success lock lasts to unmount to prevent a second fast click adding duplicate payment history. Exact-source checks suppress stale success/error, including newer same-session edits; response after original expiry cannot commit. Repository remains the sole HTTP/Zod boundary. Success adds bookingId before canonical guarded payment navigation, preserving source fields and expiry.

Canonical mockDb gains readonly booking summaries and key→booking indexes. The POST handler validates current owned hold and passenger/contact completeness, commits synchronously and replays one booking/session. Session bookingId locks seat/passenger PUT; edit pages recover to review and review resumes payment. Version1 tab snapshot adds bounded optional booking arrays/indexes and original attempt metadata; old unbooked snapshots remain readable. Restore reconstructs seats/fare from fixtures and validates all cross-references, no raw logging. Task8 owns payment/status evolution and completion cleanup; no payment/tickets were implemented.

Task7 lost-response recovery: server booking creation may succeed before the client receives its summary. If a subsequent seat/passenger PUT returns `BOOKING_LOCKED`, the page rolls back/preserves the draft, disables further edits and exposes a safe link to review. Review replays the persisted attempt key and adopts the existing booking; it does not create a second booking or renew expiry. Blocking feedback is distinct from network loading, so the disabled action is not announced as indefinitely busy.

## Payment lifecycle — Plan 04 Task 8

features/payment owns runtime schemas, typed feature-local repository, mutation/query hooks and checkout/result composition. It reuses booking HTTP/error transport, one canonical Zustand draft, useSeats and original-expiry countdown; components do not fetch/import mock state. Payment mutation persists its attempt before network, uses ref lock/abort/run/source ownership, and navigates only after storing opaque response IDs. Public callback explicitly hydrates the draft outside BookingSessionRoute and clears only its exact validated issued-ticket set. A failed/cancelled outcome preserves business state; pending is explicit recheck. Ambiguous response resumes the persisted transaction without a second create.

The authoritative mockDb gains payments/paymentKeys/tickets/paidBookings. Booking creation summary is immutable; paidBookings is subsequent paid lifecycle truth. Success atomically issues one immutable ticket per selected seat, sells seats, releases holds and clears completed-session contact/passengers. No await occurs inside commit; replay returns the original result. Existing snapshot reconstructs seats/fares from canonical fixtures, validates cross-links and preserves completed receipts after draft clear/hold expiry. Caps100 payments/keys,600 tickets,262144 characters and24h persisted receipt TTL; active holds still expire at original10min. Invalid data discards safely, denied storage is RAM-only, reset clears snapshot. This tab-local mock is neither cross-tab synchronization nor production storage/auth.

Ticket private data includes one passenger and normalized guestVerification email/phone only (no contact fullName). It stays inside bounded dev/test storage; payment records/results/URLs/logs are PII-free. Supervisor approved the minimal proof for guest lookup because contact need not equal optional passenger phone. Task9 implements safe normalized comparison/short-lived lookup access and UI as detailed below. Production requires a real authenticated server boundary. No payment method switch, fee, promotion, bank reconciliation or history functionality was added.

## Guest ticket access — Plan04 Task9

features/tickets sở hữu schema/repository/hooks/form/card/page. Lookup RHF giữ proof local; useLookupTickets chỉ đưa run/AbortController vào mutation variables, lấy input từ ref tạm và xóa trước await. Server phản hồi access token-only; client validate/write trước canonical navigation. Ref lock/abort/mounted-run guard ngăn double submit/late storage. Không thêm Zustand store; client access chỉ token/codes/expiry, public detail là Query state transient.

useTicketAccess hydrate từ lazy storage trong effect, đăng ký original-deadline timeout/focus/visibility/storage và cleanup. Hết hạn/mất quyền xóa token lẫn ticket-detail Query cache. Query không chứa token trong key, chỉ header; gcTime0 khi unmount. Chưa xác thực hoặc code ngoài scope không request detail. Server401/410 thu hồi local grant; missing/notfound/expired/malformed có CTA lookup. Payment success không tự cấp quyền.

Authoritative mockDb thêm bounded ticketAccess max100 trong snapshot hiện có, TTL15min không renew. Restore kiểm tra unique token, strict resource-only fields, exact TTL và canonical same-booking issued-ticket links; expired access prune độc lập khỏi completed receipts. Submitted proof không lưu; private contact proof Task8 chỉ dùng so khớp normalized. Client storage bị chặn không âm thầm giả định refresh works. Đây là dev/test tab continuity, không production authentication/cross-tab synchronization. Task10 account access giữ flow này độc lập.

## Auth/session/account history — Plan04 Task10

Feature auth giữ schema/repository/hook/page/component riêng; page chỉ compose. `useAuthAction` dùng void mutation variables, synchronous lock, AbortController và mounted guard; submitted action bị xóa khỏi ref trước network await. Một `blue-mock-session` hiện hữu được mở rộng bằng token, không thêm Zustand/auth store. `useAccountSession` thu hồi storage và account Query cache khi token đổi/mất; guard chờ hydration trước Outlet.

MockDb thêm `authSessions` max100 với strict exact1h grants và fixture one-admin/customer identity trong snapshot hiện có. Handler là boundary duy nhất đọc accounts/private ticket ownership; UI/repository không import mock state. Account queries dùng token header, userId+expiry key, gcTime0 và no focus refetch; detail reuse public TicketDetail projection. Register/forgot không tạo state. Intended redirects là pure canonical allowlist, không nhận external URL/fragment/encoded/PII query. Production cần server auth, secure cookie/token rotation, authorization, rate limit và cross-device persistence.

## Admin list URL state — Plan05 Task5

`useAdminListParams` là owner duy nhất của query string cho list filters/pagination. Hook parse qua `parseAdminListParams`, canonical hóa list keys bằng replace khi URL invalid/default/trimmed và so sánh serialized value trước khi navigate để tránh loop. Update clone `URLSearchParams`, chỉ xóa/ghi `query`, `status`, `organizationId`, `page`, `pageSize`; các key ngoài ownership như `dialog` cùng duplicate values được giữ nguyên. Filter patch luôn reset page1, pagination không làm mất filter/pageSize.

Draft search chỉ sống trong `DebouncedSearch` và commit sau300ms; unmount/reset hủy timer. AdminFilters không fetch, không giữ server state và nhận organization/status options từ resource page tương lai. Page count được bound tối thiểu1; page vượt total được đưa về trang cuối qua URL. Task5 chưa nối repository/query hook hoặc resource route.
