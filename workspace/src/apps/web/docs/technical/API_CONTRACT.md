# API contract đề xuất

**Trạng thái chung:** `frontend-mock-approved`  
**Phạm vi:** contract nội bộ cho service, query hook, MSW và component frontend

**Implementation hiện tại:** Plan03 trip discovery và Plan04 Tasks1–10 có seat/session, passenger/review/booking, VNPay/issued-ticket data, guest lookup/detail, auth mock và account ticket history. Cancellation còn thuộc Task11; nghiệp vụ admin thuộc Plan05. Các section theo Task ghi lịch sử; auth/access hiện hành chỉ là mock development/test, không phải bảo mật production.

## Quy ước

TASK-014 Explore public mock: `GET /api/v1/explore/provinces` trả strict `{items:ProvinceSummary[]}`; `GET /api/v1/explore/provinces/:slug` trả strict `ProvinceDetail` hoặc404. Summary gồm slug/name/region/description/operatorCount/pickupCount/dropoffCount/isMock:true; detail thêm operators và points. Point có id/name/address/services/operatorIds cùng latitude/longitude/coordinateSource nullable; cả ba coordinate fields hiện null, không có tọa độ xác minh. Counts/reference/unique point được schema kiểm tra; repository reject wrong slug response, malformed JSON/data và không echo raw body. AbortSignal được forward,404 không retry, network/503 có retry. Header `x-mock-scenario=loading|empty|error` chỉ dev/test; production bỏ qua. UI search `q` chỉ lọc response local và không đổi HTTP contract. Xem [EXPLORE.md](./EXPLORE.md).

- Base path `/api/v1`; resource dùng danh từ số nhiều.
- JSON mock dùng `camelCase`.
- Thời gian dùng ISO 8601 UTC; tiền VND dùng số nguyên.
- ID truyền dưới dạng chuỗi.
- Lỗi HTTP dùng RFC Problem Details, bổ sung `code`, `traceId` và `errors` khi validation.
- Mutation quan trọng nhận header `Idempotency-Key`.

## Booking draft nội bộ — Plan 04 Task 1

ContactDraft gồm fullName/email/phone; PassengerDraft gồm seatId/fullName/phone?; BookingDraft gồm sessionId/bookingId?/tripId/selectedSeatIds/contact?/passengers/expiresAt/totalVnd. BookingSession mở rộng draft với status active/expired/completed. Đây là contract state frontend, chưa phải endpoint hoặc mutation đã triển khai. Optional bookingId giữ tương thích payment guard và được Task 7 điền từ booking creation response.

Store actions thay selection/total, contact hoặc passengers nhưng không reset expiresAt; persist sessionStorage key blue-booking-draft bằng Zustand envelope `{ state: { draft }, version: 0 }`, không serialize action/server entities/status. Hydration sau mount kiểm tra full shape, ISO UTC, expiry > Date.now và total integer không âm; reject/remove malformed/expired, không expose raw data. Contact/passenger draft có thể chưa hoàn chỉnh; validation nghiệp vụ/RHF và network schemas thuộc các task downstream tương ứng. Không có handler mới trong Task 1.

## Boundary dữ liệu tìm chuyến

`features/trips/types/trip.ts` định nghĩa Location, OperatorSummary, VehicleType, Trip và TripSearch. `tripSearchSchema` nhận input chưa tin cậy qua `safeParse`; output chỉ gồm `originId`, `destinationId`, `departureDate`, `passengerCount`, `sort` theo TripSearch.

- IDs được trim, phải khác nhau và không rỗng; lỗi trùng route gắn với `destinationId`.
- Ngày đi được trim, phải là ngày lịch thật dạng `YYYY-MM-DD`, không trước hôm nay theo **Asia/Ho_Chi_Minh**. Đây là ngày sản phẩm, tách biệt timestamp ISO UTC của chuyến. Boundary được tính lại ở mỗi parse, không cố định tại lúc import module.
- Passenger nhận số nguyên 1..6 hoặc chuỗi URL canonical `1`..`6` (cho phép whitespace ngoài); output luôn là number. Không ép boolean/null/chuỗi rỗng, số thập phân, exponent, hex hoặc leading zero thành số hợp lệ.
- Sort thiếu dùng `relevance`; chỉ chấp nhận `relevance | departure | price-asc | price-desc`, giá trị sai bị từ chối. `relevance` giữ thứ tự fixture ổn định; key ngoài contract bị loại khỏi output.
- Factory `createTripSearchSchema(getTodayDate?)` cho phép truyền provider trả ngày canonical để test có tính quyết định. Provider mặc định dùng lịch Việt Nam; không đọc browser storage hoặc tạo network side effect.
- Plan 03 Task 5 tách provider mặc định thành `shared/lib/getVietnamTodayDate.ts` dùng chung cho schema và SearchForm. Date input không ghi min lúc SSR/initial hydration; effect đồng bộ constraint native qua ref, refresh trên focus/submit. Schema vẫn tính lại ngày ở mọi parse nên không có khoảng trống cho phép ngày quá khứ trước effect hoặc sau nửa đêm. Không dùng UTC prefix hay timezone máy người dùng làm ngày sản phẩm.

`SearchForm({ locations: readonly Location[], onSubmit(search: TripSearch), withLeadingIcon? })` dùng RHF + zodResolver trực tiếp với tripSearchSchema, không nhân bản rule validation. Controls native có nhãn Điểm đi/Điểm đến/Ngày đi/Hành khách, chọn 1..6 khách, default sort `relevance`. Callback nhận đúng canonical object đã parse (passengerCount number), chỉ một argument; form không fetch/import repository/fixture, không tự navigation. Lỗi schema gắn field qua aria-describedby/aria-invalid và alert; invalid không gọi callback, RHF focus field lỗi đầu. withLeadingIcon chỉ bật decorative Figma asset, không đổi dữ liệu/validation.

Homepage dùng HomeHero → useLocations → httpTripRepository → MSW. Loading/empty/error có nội dung tiếng Việt; lỗi có Thử lại qua refetch, không show raw server strings. Hợp lệ điều hướng SPA bằng createSearchParams/useNavigate đến `/trips` với đúng bốn params originId/destinationId/departureDate/passengerCount; sort `relevance` được schema bên nhận mặc định, không thêm scenario/PII. TripResultsPage parse query qua shared schema, chặn key core/sort lặp trước request, dùng useTrips/repository thật và render loading/error+retry/empty/success. UI copy không dùng raw response strings. Vehicle/period/hour/fare/amenity/page là staged Results UI state trên readonly result array; Apply mới commit URL, Reset xóa chúng, và chúng không mở rộng repository query key hay HTTP endpoint. Plan04 Task3 thay deferred callback: CTA gọi create-session mutation, lưu draft đã parse rồi SPA navigate tới bookingSeatsPath(sessionId); pending khóa mọi selection action, lỗi an toàn giữ Results/draft cũ và cho retry/phục hồi.

Schema này parse query/form core search và được MSW search handler dùng qua `safeParse`. Response schemas và repository boundary đã được triển khai ở Task 4; TypeScript types không thay thế runtime parsing. Seed và HTTP contract đã triển khai được mô tả bên dưới.

### Repository và response boundary (Plan 03 Task 4)

`TripRepository` trả domain arrays readonly qua `getLocations(signal?)` và `search(input: TripSearch, signal?)`; default implementation là `httpTripRepository`. Đây là fetch boundary của slice tìm chuyến theo kiến trúc đã duyệt, không tạo thêm shared client/envelope hoặc branded IDs ngoài contract. Component/page dùng `useLocations`/`useTrips`, không import repository hoặc fixture trực tiếp. Repository gửi đúng năm search fields bằng URLSearchParams, forward AbortSignal vào fetch và không gửi scenario/unknown fields.

`schemas/tripResponse.schema.ts` parse JSON chưa tin cậy thành objects mới, loại unknown fields ở mọi nested object:

- Location: id/name/province là string trim không rỗng. OperatorSummary: id/name tương tự.
- Trip: đủ nested origin/destination/operator, id không rỗng; vehicleType chỉ sleeper-34/cabin-22; `vehicleLabel`, `originStopName`, `destinationStopName`, `displayOperatorName` là presentation metadata; `amenities` chỉ nhận enum mock đã duyệt. **fareVnd là integer dương** (zero fare là contract drift đã được Supervisor xác nhận); availableSeatCount là integer không âm.
- departureTime/arrivalTime phải là ISO datetime UTC với suffix Z, không offset/local datetime; arrival phải sau departure.
- Locations envelope `{items: Location[]}`. Search envelope `{items: Trip[], total: integer >= 0}` và total bằng items.length vì chưa pagination. Repository unwrap items; UI không nhận raw response/envelope hoặc total riêng.

Các failure đều thành `TripRepositoryError` với code/status/messageKey/canRetry an toàn. HTTP non-2xx được chặn trước đọc body; không expose Problem Details detail/title/code hoặc HTML lỗi của server. JSON lỗi/schema drift là INVALID_RESPONSE; abort không bị báo thành offline. Không truyền raw response/cause/Zod issues vào error.

| Code | status | messageKey | canRetry |
|---|---|---|---|
| HTTP_ERROR | HTTP status | trips.errors.request | true cho 429 hoặc >=500; false cho các 4xx khác |
| NETWORK_ERROR | 0 | trips.errors.network | true |
| ABORTED | 0 | trips.errors.cancelled | false |
| INVALID_RESPONSE | success HTTP status | trips.errors.response | true |

Results UI map stable error code sang nội dung tiếng Việt và hành động retry; không hiển thị error.message hoặc server strings. messageKey/canRetry là boundary metadata an toàn cho consumer; provider TanStack Query vẫn giữ chính sách retry/staleTime đã có, task này không thay global policy.

Query keys là readonly tuples được freeze: `["trips", "locations"]` và `["trips", "search", {originId,destinationId,departureDate,passengerCount,sort}]`. Search snapshot chỉ copy năm primitive fields theo thứ tự cố định và freeze tách khỏi caller input; thay đổi input sau không sửa cache identity. Caller cung cấp TripSearch canonical từ search schema, key không tự coercion/normalize input sai kiểu. Hook search dùng chính snapshot queryKey cho request và forward Query signal; đổi sort tạo cache entry riêng, unmount hủy request đang chờ. Tests gọi hook/repository thật qua MSW, không mock implementation nội bộ.

### Seed tìm chuyến ổn định

`src/mocks/fixtures/{locations,operators,trips}.ts` cung cấp 4 điểm dừng mô phỏng, operator mock và 24 chuyến duy nhất cho tuyến canonical, cùng các seed giữ coverage tuyến/ngày khác. Tên bến và operator là dữ liệu prototype/hư cấu; tên tỉnh/thành chỉ là ngữ cảnh địa lý. Không có testimonial hoặc claim doanh nghiệp thật.

Fixtures có ID ổn định, readonly types và Object.freeze ở arrays/từng record; Trip tham chiếu đúng object location/operator canonical đã freeze. Handler phải dùng bản sao để sort hoặc tạo state mutable, không sửa seed chia sẻ.

| Tuyến | Ngày khởi hành theo Asia/Ho_Chi_Minh | Seed |
|---|---|---|
| `loc-hcm` → `loc-dalat` | `2099-01-01` | 24 chuyến duy nhất, cả hai vehicle types, nhiều giá/giờ; page 1 có 6 case exact Results |
| `loc-hcm` → `loc-dalat` | `2099-01-02` | 1 chuyến cho kiểm tra tách ngày |
| `loc-danang` → `loc-hanoi` | `2099-01-01` | 1 chuyến cho kiểm tra tách tuyến |

Timestamp của Trip vẫn là ISO UTC. `trip-hcm-dalat-early` khởi hành `2099-01-01T00:00:00Z`, tương ứng 07:00 ngày `2099-01-01` tại Việt Nam. Handler lọc departureDate bằng lịch **Asia/Ho_Chi_Minh**, không lấy prefix UTC. Ngày cố định đã được duyệt để test handler/UI không phụ thuộc wall clock; handler/UI test dùng ngày search nêu trong bảng. Integrity tests kiểm tra reference, integer VND, availableSeatCount không vượt layout vật lý, ISO UTC/arrival sau departure, 24 ID duy nhất và freeze. Fare/time/availability/vehicleType là canonical cho cả Results và booking; không tồn tại bản `display*` đối nghịch. Seed đã nối qua MSW/repository/hooks vào Home và Results; component không import fixture.

### HTTP tìm chuyến đã triển khai (Plan 03 Task 3)

- `GET /api/v1/locations` trả HTTP 200 JSON `{ items: Location[] }`, đúng thứ tự fixture canonical.
- `GET /api/v1/trips?originId=loc-hcm&destinationId=loc-dalat&departureDate=2099-01-01&passengerCount=2` trả HTTP 200 JSON `{ items: Trip[], total: number }`. `total` là độ dài items, chưa có pagination. Không có route/date phù hợp trả `{ items: [], total: 0 }`.
- Bốn trường core bắt buộc là originId/destinationId/departureDate/passengerCount; sort mặc định `relevance`. Lặp bất kỳ key core hoặc sort bị từ chối 400, không chọn tùy ý giá trị cuối. Unknown keys bị schema loại bỏ; `scenario` là control riêng theo quy tắc development/test bên dưới.
- Lọc theo ID tuyến và ngày Việt Nam; passengerCount được validate nhưng chưa lọc sức chứa. Sold-out vẫn nằm trong kết quả để UI hiển thị trạng thái. Không thêm nghiệp vụ giữ/chọn ghế ở bước tìm kiếm.
- Sort `departure` tăng theo timestamp; `price-asc` tăng theo fareVnd; `price-desc` giảm theo fareVnd. Filter tạo array mới trước sort, giữ thứ tự nguồn khi key bằng nhau. Request/payload sau không bị ảnh hưởng bởi sort hay sửa payload trước.
- Hai handler modules được đăng ký tại `src/mocks/handlers.ts`. `createTripHandlers(sourceTrips = trips)` nhận readonly collection để test stable ties qua MSW network boundary; không phải mutable mock database hoặc API production.

### Problem Details tìm chuyến

Query sai trả HTTP **400**, header `Content-Type: application/problem+json`:

```json
{
  "type": "about:blank",
  "title": "Thông tin tìm kiếm chưa hợp lệ",
  "status": 400,
  "detail": "Kiểm tra điểm đi, điểm đến, ngày đi và số hành khách.",
  "instance": "/api/v1/trips",
  "code": "VALIDATION_ERROR",
  "traceId": "00000000-0000-4000-8000-000000000000",
  "errors": { "passengerCount": ["Chọn từ 1 đến 6 hành khách."] }
}
```

traceId ví dụ chỉ mô tả UUID; mỗi response tạo UUID mới. `instance` chỉ là pathname cố định, không chứa query/PII. `errors` chỉ chứa các field vi phạm thuộc TripSearch và thông báo tiếng Việt tĩnh; không trả Zod issues, raw input, stack hoặc message nội bộ.

`scenario=error` trong development/test trả HTTP **503**, cùng media type/type/instance và UUID traceId, `title: "Không thể tải chuyến"`, `code: "SERVICE_UNAVAILABLE"`, `detail: "Dịch vụ tìm chuyến tạm thời không khả dụng. Vui lòng thử lại."`; không có errors. Đây là lỗi HTTP mô phỏng có CTA retry, không phải transport failure hoặc timeout. `scenario=empty` trả 200 empty. Luôn validate query trước khi áp scenario. Control chỉ hoạt động khi `!PROD && (DEV || MODE === "test")`; production hoặc scenario không nhận diện được bị bỏ qua. MSW browser bootstrap hiện chỉ chạy development và production client bundle không import handlers. Xem `MOCK_SCENARIOS.md` để dùng control đúng phạm vi.

## Endpoint mock canonical

| Method | Endpoint | Mục đích |
|---|---|---|
| GET | `/locations` | Điểm đi/đến |
| GET | `/trips` | Tìm, lọc, sắp xếp chuyến |
| GET | `/trips/:tripId/seats` | Sơ đồ và trạng thái ghế |
| POST | `/booking-sessions` | Tạo phiên và giữ ghế 10 phút |
| PUT | `/booking-sessions/:sessionId/seats` | Thay đổi ghế theo cơ chế atomic |
| PUT | `/booking-sessions/:sessionId/passengers` | Lưu hành khách |
| POST | `/bookings` | Chốt booking, idempotent |
| POST | `/payments/vnpay` | Tạo giao dịch VNPay mock |
| POST | `/payments/vnpay/return` | Xác nhận kết quả mock bằng opaque IDs trong body |
| POST | `/tickets/lookup` | Tạo lookup session bằng mã + thông tin xác thực |
| GET | `/tickets/:ticketCode` | Chi tiết vé |
| POST | `/bookings/:bookingId/cancellations` | Hủy một hoặc nhiều ticket |
| GET | `/admin/organizations` | Danh sách tổ chức |
| GET | `/admin/organizations/:organizationId` | Chi tiết tổ chức |
| GET | `/admin/staff` | Danh sách nhân viên |
| GET | `/admin/staff/:staffId` | Chi tiết nhân viên |
| GET | `/admin/bookings` | Danh sách booking |
| GET | `/admin/bookings/:bookingId` | Chi tiết booking |
| GET | `/admin/payments` | Danh sách payment |
| GET | `/admin/payments/:paymentId` | Chi tiết payment |
| GET | `/admin/refunds` | Danh sách refund |
| GET | `/admin/refunds/:refundId` | Chi tiết refund |

## Mã lỗi nghiệp vụ

`VALIDATION_ERROR`, `SERVICE_UNAVAILABLE` đã dùng trong search handlers. Booking session dùng `VALIDATION_ERROR`, `NOT_FOUND`, `SEAT_CONFLICT`, `HOLD_EXPIRED`, `SELECTION_LIMIT_EXCEEDED`. Các code downstream đã duyệt: `BOOKING_NOT_FOUND`, `PAYMENT_FAILED`, `PAYMENT_PENDING`, `CANCELLATION_NOT_ALLOWED`, `REFUND_FAILED`, `UNAUTHORIZED`, `FORBIDDEN`.

## Trạng thái contract

- `mock-approved`: FE và MSW đang dùng.
- `frontend-mock-approved`: đủ để triển khai và kiểm thử frontend.
- `deprecated`: không dùng cho code mới.

Khi contract nội bộ thay đổi, cập nhật đồng thời type/schema, service, MSW handler, fixture và test; không để component phụ thuộc trực tiếp vào response thô.

## Seat/session wire contract — Plan 04 Task 2

| Request | Success resource | Validation/business failure |
|---|---|---|
| GET `/api/v1/trips/:tripId/seats` | 200 `{ tripId, vehicleType, items: Seat[] }` | 404 NOT_FOUND |
| POST `/api/v1/booking-sessions` body `{ tripId }` | 201 BookingSession, empty selection/passengers, totalVnd 0, active, expiresAt = original server now + 600000ms | 400 VALIDATION_ERROR; 404 NOT_FOUND; expired key replay 410 HOLD_EXPIRED |
| PUT `/api/v1/booking-sessions/:sessionId/seats` body `{ seatIds: string[] }` | 200 full BookingSession with replaced selection and totalVnd = canonical trip fareVnd × count | 400 duplicate/invalid IDs; 409 SELECTION_LIMIT_EXCEEDED (>6); 409 SEAT_CONFLICT; 404 NOT_FOUND; 410 HOLD_EXPIRED |
| PUT `/api/v1/booking-sessions/:sessionId/passengers` body `{ contact, passengers }` | 200 full BookingSession | 400 structural/seat correspondence validation; 404 NOT_FOUND; 410 HOLD_EXPIRED |

Seat fields: id/code, deck lower/upper, zero-based row/column, status available/held/sold/disabled. Per-trip IDs are `${tripId}:${code}`; seed IDs remain vehicle-scoped. GET includes the caller's own held seats as held; ownership stays private in mockDb. Later SeatMap must use the current session selection to distinguish own selected seats from unavailable holds; the shared Seat primitive accepts selection only for available interactive seats.

Body objects are strict; trip/seat IDs trim and must contain 1..128 characters. No client fare, expiry or status is accepted. Entire requested selection is validated before synchronous mutation. Retained own holds are selectable, another live owner's holds and static held/sold/disabled seats conflict. Unknown IDs conflict without echoing those IDs; conflictingSeatIds includes known unavailable IDs only. Duplicate canonical IDs fail 400. Failed limit/conflict/validation leaves session, ownership, seats, totals and persisted snapshot unchanged. Success releases removed own holds, claims the new set and prunes passengers for removed seats; it never renews expiry. Empty selection is allowed. Expiry at equality is expired: active sessions release owned holds and become expired in memory; inactive historical selection/total is not an active hold. Expired other holds are only reclaimed after complete selection validation succeeds, preserving atomic conflict behavior.

POST supports optional Idempotency-Key (1..128 ASCII letters/digits/dot/underscore/colon/hyphen). Same key and trip replay the same current session and original expiry with 201; a different valid trip with that key is 400. Expired replay is 410 and never creates a fresh hold. Omitting the header permits separate sessions; Task 3 must use the documented repository boundary, not call fixtures/state from UI. PUT replaces full resources and is inherently idempotent. After an expired snapshot is discarded on reload, PUT to its old session ID returns sanitized 404. Only active sessions/key indexes are persisted: expired idempotency tombstones do not survive reload; a new explicit POST can create a new session ID, never extend the old session expiry.

Passenger boundary checks string shape only: contact {fullName,email,phone}, passengers [{seatId,fullName,phone?}]. IDs must be unique and correspond exactly to the selected set; empty maps to empty. Partial/empty strings and unformatted phone/email are intentionally accepted here; Task 6 owns business/form validation. No submitted PII is included in Problem Details, query or logs.

All errors have application/problem+json, type about:blank, static Vietnamese title/detail with recovery action, HTTP status, code and UUID traceId. instance uses a static endpoint pattern (for example `/api/v1/booking-sessions/:sessionId/seats`), without real IDs/query/PII. Validation errors use static errors[field]: string[]; conflict adds only sanitized conflictingSeatIds. No Zod issue/raw payload/stack is returned. createBookingHandlers({db,now,createSessionId}) is a deterministic test seam; runtime defaults to one canonical mockDb/Date.now/UUID. No booking scenario query override was introduced.

## Booking create-session boundary — Plan 04 Task 3

BookingRepository.createSession(tripId, options?) returns parsed BookingSession; optional typed options carry Idempotency-Key/AbortSignal internally, while hook/UI call stays createSession(tripId). HTTP implementation owns fetch and accepts only201; non-2xx → BookingRepositoryError HTTP_ERROR, other success status/malformed JSON/schema drift → INVALID_RESPONSE, transport → NETWORK_ERROR, aborted request/read → ABORTED. Error exposes stable code/status/messageKey/canRetry only and a static message; no raw Problem Details/Zod/body/cause escapes. Retry is offered for network/invalid response/429/5xx, not ABORTED or other4xx. No global client/envelope or fixture import was added.

Response schema checks nonempty trimmed IDs, requested tripId match, active status, future ISO UTC expiry, unique max6 selection, structural contact/passengers with unique selected-seat subset, integer nonnegative total (empty→0, nonempty→positive). Unknown fields are stripped, not stored. Replay may contain a prior selection; its original expiry remains unchanged. Server still calculates exact fare×count.

useCreateBookingSession owns a synchronous ref lock, trip/key/run/AbortController; TanStack mutation retry=false means only explicit user retry. Same mounted failed trip reuses its key; intentional different trip/success rotates/clears it. Hook lives above keyed ResultsList so filter/sort remounts cannot duplicate a pending request. Full route unmount aborts and invalidates the run; mounted/run guards ignore late success. Supervisor clarified full route remount is a new explicit attempt and may use a new key; no WeakMap/global hidden attempt store. On success setDraft(session) runs before canonical SPA navigation. On failure draft/storage are untouched; static Vietnamese alert/retry/search recovery is rendered. TripCard stays presentational via isPending?/disabled? (defaultsfalse); no repo/hook/navigation in the card.

Plan04Task4 adds getRemainingSeconds/useHoldCountdown as a derived presentation boundary for the original server expiresAt; no wire fields/endpoints change. Countdown recomputes Date.now every second and on focus/visibility, clamps invalid/equal/past to zero and stops scheduling there. Before the expiry-keyed effect is evaluated, hook returns neutral `{remainingSeconds:0,isExpired:false}` for SSR/hydration/replacement safety; consumers must honor isExpired rather than deriving it from that initial zero. No persist/local decrement or expiry renewal. Guard useSessionClock remains unchanged; seat-page integration is Task5.
## Seat page contract — Plan 04 Task 5 (current)

This section supersedes the Task2/3 historical signatures above. POST body is now strict `{tripId, passengerCount}`; passengerCount is a number, integer1..6 (no string coercion), echoed in BookingSession and persisted BookingDraft and mock snapshot. Missing/invalid counts fail400; old persisted drafts/snapshots without it fail closed. Same Idempotency-Key requires both the same trip and count; replay preserves the original expiry. Results forwards canonical TripSearch.passengerCount; no navigation-state-only count.

GET seats now returns200 `{tripId,vehicleType,trip:Trip,items:Seat[]}`. `trip` is canonical server metadata and fare; the boundary reuses tripSchema and verifies matching IDs/type, exact34/22 unique canonical IDs/codes/deck/row/column. No client fare, service fee or client-submitted trip metadata. BookingRepository adds getSeats(tripId,signal?) and replaceSeats(sessionId,seatIds,signal?); createSession(tripId,passengerCount,options?). All use the same feature-local HTTP/Zod boundary and forward AbortSignal. Errors expose stable code/status/messageKey/canRetry plus only deduplicated submitted conflict IDs matching the stable ID shape; UI further intersects with its validated layout and displays codes, never raw Problem Details/body.

useSeats owns server cache. useReplaceSeats synchronously locks an attempt, cancels the exact seat query, snapshots the entire draft/cache, optimistically replaces full IDs/total and prunes removed passengers. Every error including abort/drift restores the entire snapshot unless a newer session/cleared draft has replaced it. Conflict triggers rollback/refetch and a Radix recovery dialog; stale success never overwrites a newer draft. Success verifies session/trip/count/selection/original expiry and exact canonical fare×selected count before commit/invalidation. Max6 is checked before request; native fieldset locks all seats while mutation/refetch is pending. Session-owned held seats project to selectable selected seats for deselection; sold/disabled stay blocked.

BookingSummary shows trusted journey, selected codes/count, fare×count total and original countdown. Continue requires exactly persisted passengerCount, unique known selectable selection and canonical fare×count total, positive evaluated remaining time and no pending work; it uses bookingPassengersPath. There is no service-fee row. Countdown expiry or HOLD_EXPIRED clears the client draft and initiates authoritative GET cleanup; guard contract is unchanged. Results handles reason=expired before search validation/query: trusted page recovery may carry canonical core params, bare guard recovery links Home. GET/hydration is the mock server's expiry cleanup boundary; offline cleanup retries naturally on the next server access, never by importing mock state into UI. Completion clearing remains Plan04Task8.

## Passenger form boundary — Plan 04 Task 6 (current)

BookingRepository.replacePassengers(sessionId, contact, passengers, signal?) PUTs the existing endpoint and accepts only200 full BookingSession. RHF and repository share createPassengerSchema: trim names/email/phones, name2..100, email<=254 and valid, raw phone<=20 before trim and mobile ^(?:0|\+84)[35789]\d{8}$. Contact requires all three; passenger phone is optional and blank becomes absent. Selected-seat construction copies unique nonempty IDs1..6; submitted passengers must cover that exact set once. Hook binds the actual current draft selection before any request. Mock handler keeps its approved structural/exact-seat validation; no new endpoint or backend business implementation.

Runtime response validation and exact submission matching reject altered contact/passenger fields, session/trip/bookingId/count, selected set, original expiresAt or total. Order may differ; seatId is identity. AbortSignal reaches fetch; malformed/non-2xx/schema errors become safe BookingRepositoryError code/status/messageKey only. No raw body/Zod detail/PII enters UI error, URL or logs. PUT is an idempotent full replacement; explicit retry sends current canonical values and preserves the prior draft on failure.

The mounted mutation locks synchronously against double submit, snapshots values and records exact draft ownership. Only current mounted/run/source success writes the one draft before bookingReviewPath SPA navigation. Unmount aborts; late success/error cannot overwrite a new, cleared or newer same-session draft. Original expiry is never extended. The review target is still Task7 placeholder; no POST booking/payment is implemented.

Privacy note Task6: browser MSW starts quiet:true. Installed MSW otherwise logs cloned request/response bodies even when application code has no console.log. Startup regression and browser all-console-argument inspection protect the passenger body boundary; production mocking remains disabled.

## Review / booking creation — Plan 04 Task 7 (current)

POST /api/v1/bookings requires strict body {sessionId} and Idempotency-Key matching1..128 ASCII letters/digits/dot/underscore/colon/hyphen. No passenger/contact/price/key in query. Success201 is readonly/frozen {bookingId,bookingCode,sessionId,totalVnd,status:"pending-payment"}; bookingCode uses BLUE- prefix. Response contains no PII, payment transaction or ticket. Runtime Zod checks IDs/code/status/positive integer VND and strips unknown extras. Repository verifies requested session; hook additionally verifies exact original total and existing bookingId before committing.

The handler hydrates the existing canonical mockDb and validates active original expiry, exact selected count/unique owned held seats, complete business-valid contact/passengers and canonical fare×count total. Missing/invalid body/key/completeness400 VALIDATION_ERROR, missing session404 NOT_FOUND, expired410 HOLD_EXPIRED, reused key for another session409 IDEMPOTENCY_CONFLICT. Errors reuse sanitized application/problem+json, static /api/v1/bookings instance, UUID traceId, Vietnamese recovery copy and no raw values. Same key+same session replays exact201 summary; another key for that session still returns its single existing booking. Synchronous validated commit prevents duplicate bookings and never extends expiry.

After creation session.bookingId locks both seat and passenger PUT with409 BOOKING_LOCKED. Session/contact/selection/total and immutable booking summary stay unchanged. Review removes edit links and resumes the existing booking; direct/back access to seats/passengers shows a locked recovery link. Safe typed error mapping includes BOOKING_LOCKED and IDEMPOTENCY_CONFLICT only at409. Payment route guard still requires exact matching persisted bookingId and unexpired hold; no VNPay behavior is added here.

Client bookingAttemptKey is optional for pre-attempt drafts, generated once and persisted before the first POST. Full same-session draft projection preserves it when a passenger save lacks that metadata; another session never inherits it. Hydration validates its format. Hook owns synchronous pending/success lock, controller/run/source identity and explicit retry; failure/remount refresh reuse the persisted key. Success stores bookingId while preserving original key/expiry before paymentVnPayPath SPA navigation. Successful lock lasts until unmount so a fast double click cannot push duplicate history entries. Late success/error cannot change newer/cleared/same-session-edited drafts; expiry after request also fails closed.

Mock snapshot version1 now carries optional bookingAttemptKey on sessions and backward-compatible default-empty bookings/bookingKeys arrays, each capped100 with the existing262144-char cap. Only active unexpired sessions and linked summaries/indexes persist; restore verifies unique IDs/session/key ownership, exact total/contact/passengers and original expiry against trusted fixtures. Malformed/expired/cross-linked snapshots discard fully. reset clears booking maps and snapshot; Task8 must clean completed sessions/booking snapshot when implementing payment success. This is tab-local dev/test continuity, not production persistence.

## VNPay / ticket issuance — Plan 04 Task 8 (current)

| Endpoint | Request | Success |
|---|---|---|
| POST /api/v1/payments/vnpay | Strict {bookingId,scenario?}; required Idempotency-Key (same validated ASCII format as booking key) | 201 PaymentTransaction |
| POST /api/v1/payments/vnpay/return | Strict {transactionId,resultId}; no client status/amount/PII | 200 PaymentResult |

PaymentTransaction is readonly {transactionId,resultId,bookingId,sessionId,tripId,bookingCode,amountVnd,createdAt,expiresAt,returnPath}. IDs are opaque ASCII1..128, UTC timestamps valid, amount positive integer VND, expiry greater than creation and unchanged from the original hold. returnPath must exactly equal paymentReturnPath(ids). PaymentResult adds status pending/success/failed/cancelled and readonly tickets; only success permits1..6 unique issued summaries {ticketId,ticketCode,bookingId,tripId,seatId,seatCode,fareVnd,status:issued}, whose summed fares equal amount and booking/trip match. Unknown response fields are stripped. No passenger/contact in either response.

Same key+booking+scenario replays exactly one transaction201. Mismatched key409 IDEMPOTENCY_CONFLICT; another unresolved/pending attempt409 PAYMENT_IN_PROGRESS; already-paid/incomplete booking409 PAYMENT_NOT_ALLOWED. Missing resource404, invalid shape/header400, unresolved expired hold410 HOLD_EXPIRED. Errors remain static Vietnamese application/problem+json with code/traceId/static instance; no raw values/body/Zod/PII. Normal pay omits scenario and defaults success; cancel is normal. Failed/pending controls are dev/test only and rejected400 by production-configured handlers. Runtime production browser mocking remains disabled.

Create checks trusted booking/session/held selection/total and issues no tickets. Return uses IDs as idempotent identity; only the server-owned outcome decides status. Success constructs the full immutable ticket set before synchronously committing sold seats, released holds, paidBookings and completed session. Original booking creation summary remains immutable pending-payment as a creation receipt; paidBookings is lifecycle truth. Completed session contact/passengers are cleared. Repeated/concurrent callbacks and refresh replay the identical terminal result/ticket set, including after original hold expiry. Pending explicitly rechecks without automatic success or expiry renewal; failed/cancelled issue none and allow a new key while hold remains valid.

The existing draft adds optional validated paymentAttempt {key,scenario,transactionId?,resultId?}; IDs must appear together. Persist key before POST, reuse on network retry/remount, persist returned IDs before SPA navigation. Hook locks synchronously, aborts on unmount and ignores stale source/run completion; verifies requested booking, trip/session/amount/original expiry. Public return hydrates the one canonical draft and clears it only after a validated exact successful ticket set matches its booking/session/opaque attempt/trip/selected IDs/amount. Failed/cancelled remove only paymentAttempt; pending retains it. Malformed/unrelated results never erase another draft. An ambiguous successful callback response has explicit resume-current-transaction recovery rather than starting another payment.

Bounded mock-only continuity extends the existing snapshot: max100 payments/keys and600 tickets, existing262144-character cap, receipts retained up to24h from transaction creation. Active holds retain original10min expiry; expired unrelated holds are pruned without dropping valid completed receipts. Strict schema/canonical fixture fare+seat+trip/cross-reference/unique-key validation discards malformed snapshots safely. Denied storage remains RAM-only; reset clears all state. This is tab-local dev/test continuity, not production persistence or security.

Private issued Ticket additionally stores bookingCode/transactionId/issuedAt, one validated passenger {seatId,fullName,phone?}, and guestVerification {email,phone} from normalized contact fields, without contact fullName. These private fields never enter payment receipt/summary/query/log. Supervisor approved the minimal proof because contact can differ from optional passenger phone; cost is private schema migration/storage duplication (up to6 copies). Task9 compares safe normalized verification and issues a short-lived lookup session under the current contract below. Snapshot TTL/reset bounds retention; server authentication is required in production.

## Guest lookup / ticket detail — Plan04 Task9 (hiện hành)

| Request | Response | Lỗi an toàn |
|---|---|---|
| POST /api/v1/tickets/lookup, strict body {bookingCode,verificationValue} |200 readonly {token,ticketCodes,expiresAt}; unique1..6 issued codes |400 shape;404 NOT_FOUND cho cả sai mã hoặc proof;503 nếu đủ100 grants đang sống |
| GET /api/v1/tickets/:ticketCode, X-Ticket-Lookup-Token header |200 readonly TicketDetail |401 ACCESS_REQUIRED khi thiếu/sai token;410 LOOKUP_EXPIRED khi grant đã biết vừa hết hạn;404 NOT_FOUND khi vé không tồn tại/ngoài phạm vi |

verificationValue chỉ tồn tại trong form/request body: trim, email lowercase qua contactDraftSchema email; phone dùng đúng schema mobile hiện hành rồi quy về +84 (0-prefix tương đương +84). Form yêu cầu mã BLUE hợp lệ; handler structural strings1..133/1..254 (mã BLUE- + tối đa128 ký tự suffix), unknown body key400, proof sai định dạng nhưng có string shape vẫn404 generic. So sánh proof normalized bằng vòng lặp độ dài cố định; đây không phải cam kết chống timing/abuse hoặc auth production. Không echo input, raw Zod/body/server message. Problem Details có static Vietnamese title/detail/action, code, UUID traceId, static instance và application/problem+json. Success/error đều Cache-Control:no-store.

Lookup tạo UUID token độc lập với ticketCode/bookingCode, scope đúng issued codes cùng booking và TTL15 phút từ server now, không gia hạn khi GET/refresh. Canonical mockDb có ticketAccess map tối đa100 grants; khi đầy503, expired grants bị dọn trước cấp mới. Bounded existing dev/test snapshot giữ token/codes/createdAt/expiresAt, strict shape/unique token/TTL/canonical issued-ticket cross-links; legacy missing array=>empty, malformed fail closed. Hết hạn được prune mà vẫn giữ payment/tickets hợp lệ. Sau reload grant đã bị prune có thể trả401 thay410; cả hai yêu cầu lookup lại. reset xóa grant/snapshot. Không lưu submitted verificationValue; private guestVerification do Task8 đã có vẫn chỉ nằm trong private ticket storage.

TicketDetail là public projection của issued summary + bookingCode/transactionId/issuedAt/trip:Trip/passenger:{fullName}. Parse cùng tripSchema, ID và fare phải khớp canonical Trip; không có guestVerification/contact/email/passenger phone/token. Chỉ ticketCode hoặc link payment không cấp quyền. Task10 bổ sung account access bên dưới; cancel vẫn chưa có.

httpTicketRepository dùng lại typed booking transport với optional typed headers và stable ACCESS_REQUIRED/LOOKUP_EXPIRED/STORAGE_UNAVAILABLE error mapping; không thêm broad client/envelope. Repository validate input/strict access schema, tương lai trong15 phút, exact requested code, forward AbortSignal; malformed JSON/non-2xx/schema drift không lộ raw strings.

Client chỉ lưu strict token/codes/expiry dưới blue-ticket-access (<=4096 characters), đọc trong effect/event, SSR/initial render không đọc. Lookup synchronous lock/abort/run guard, proof không nằm trong mutation variables/cache hoặc persisted state; chỉ sau validated response + successful storage write mới SPA navigate. Storage bị chặn hiện lỗi phục hồi, không navigate tới quyền không bền qua refresh. New grant xóa detail Query cache; useTicketAccess kiểm tra thời hạn gốc bằng timeout/focus/visibility/storage, xóa token và mọi ticket-detail query khi mất/hết quyền. Detail query key chỉ code/expiry, không token; gcTime0 loại PII khi unmount, GET token header-only. Denied/malformed/missing scope không fetch PII; server401/410 revoke local access theo HTTP status kể cả body Problem Details sai, không tin raw body để quyết định quyền.

## Auth mock và lịch sử vé tài khoản — Plan04 Task10

| Endpoint | Success | Lỗi / giới hạn |
|---|---|---|
| `POST /api/v1/auth/login` body `{email,password}` |200 `{token,userId,role,expiresAt}` |400 validation;401 INVALID_CREDENTIALS;503 khi đủ100 session sống |
| `POST /api/v1/auth/oauth` body `{provider,scenario?}` |200 cùng session |provider google/facebook; scenario success/error chỉ dev/test, production bỏ qua control |
| `POST /api/v1/auth/register` |202 `{accepted:true}` |Strict body fullName/email/phone/password/confirmPassword; không tạo account thật |
| `POST /api/v1/auth/forgot-password` |202 `{accepted:true}` |Mọi email hợp lệ nhận cùng neutral response |
| `GET /api/v1/me/tickets?status=issued` + `X-Mock-Session-Token` |200 strict `{items,total}` |401 thiếu/hết session;403 không phải customer;400 query khác/lặp |
| `GET /api/v1/tickets/:ticketCode` + account header |200 existing TicketDetail khi sở hữu |401/403/404; guest header contract Task9 vẫn hoạt động độc lập |

Session UUID có TTL đúng một giờ, cap100, Cache-Control no-store và map tới fixture identity trong bounded mock snapshot. Client `blue-mock-session` chỉ giữ token/userId/role/expiresAt; submitted email/password bị xóa khỏi attempt trước await, không là TanStack mutation variables, query key, URL, response hay log. Register/forgot không persist submitted payload. Đây là mock tab-local, không phải cookie/token/auth production.

Account ownership chỉ dựa trên identity server của session và email fixture normalized khớp private guestVerification của vé; ticketCode không cấp quyền. History hiện chỉ cho status issued, không bịa cancelled/refund trước Task11. Server 401/410 thu hồi session và xóa account ticket/detail cache; list/detail dùng gcTime0 và token chỉ ở header. Intended redirect từ router state chỉ chấp nhận canonical local customer/admin paths và query `/trips` đã parse; scheme-relative, encoded, fragment, whitespace, unknown query/path đều về fallback role an toàn.

## Hủy vé một phần và hoàn tiền mô phỏng — Plan04 Task11

| Endpoint | Success | Lỗi / giới hạn |
|---|---|---|
| `GET /api/v1/bookings/:bookingCode/cancellation` |200 `{booking,tickets,refundRatePercent:100,policyLabel}` |401/403/404 nếu thiếu, sai scope hoặc không sở hữu; chỉ trả projection an toàn |
| `POST /api/v1/bookings/:bookingCode/cancellations` body `{ticketIds}` + `Idempotency-Key` |200 một `Refund` processing |400 validation;409 `CANCELLATION_NOT_ALLOWED` hoặc idempotency conflict;503 khi archive đủ100 |

`ticketIds` phải có1..6 payment ticket IDs duy nhất. Toàn bộ ID phải thuộc cùng booking, nằm trong quyền guest/customer hiện tại và đang `issued`; validate toàn bộ trước mutation. Một phần tử sai làm cả request thất bại, không đổi vé và không tạo refund. Thành công đổi đúng vé đã chọn sang `cancelled`, giữ vé còn lại `issued`, tạo đúng một refund `{refundId,bookingId,bookingCode,ticketIds,amountVnd,status:"processing",createdAt}`. `amountVnd` là100% tổng fare các vé chọn và UI luôn ghi đây là ước tính mô phỏng.

`Idempotency-Key` dùng cùng định dạng key hiện có và bắt buộc. Cùng key + cùng tập ID, không phụ thuộc thứ tự, replay cùng refund; cùng key + tập khác trả conflict. Replay được giải quyết trước kiểm tra trạng thái hiện tại để refresh/retry sau mutation vẫn an toàn. Refund và key map tối đa100, snapshot kiểm tra unique/cross-reference/amount/cancelled ticket; đầy archive fail closed, không mutation.

Quyền guest đến từ `X-Ticket-Lookup-Token` còn hạn và chỉ cho đúng ticket scope. Quyền customer đến từ `X-Mock-Session-Token` còn hạn, role customer và ownership server; session header sai không được fallback sang guest. bookingCode/ticketCode không tự cấp quyền. Responses `no-store`, Problem Details tĩnh không echo token, mã riêng, passenger hoặc verification proof.

## Admin domain và list params — Plan05 Task1

Admin dùng plain string IDs, integer VND amounts và ISO-8601 timestamp strings. Các trạng thái canonical hiện tại là organization/staff `active|inactive`, booking `pending-payment|paid|cancelled`, payment `pending|success|failed|cancelled`, refund `processing|completed|failed`. `PagedResult<T>` có đúng `items`, `page`, `pageSize`, `total`; runtime response parsing thuộc Task3.

List query canonical có `query?`, `status?`, `organizationId?`, `page`, `pageSize`. `page` mặc định 1; `pageSize` mặc định 20 và tối đa 100; query trim, không rỗng và tối đa 100 ký tự; organization ID chỉ nhận 1–128 ký tự chữ/số/`_`/`-`. Giá trị URL sai hoặc lặp bị bỏ an toàn, pagination trở về default và raw input không đi vào domain. Task1 chưa tạo endpoint, fixture, handler, repository hoặc UI admin.

## Admin fixture và handler contract — Plan05 Task2

Mọi `/api/v1/admin/*` yêu cầu `X-Mock-Session-Token` còn hạn với role `admin`; thiếu/hết hạn trả 401 `ACCESS_REQUIRED`, customer trả 403 `FORBIDDEN`, và kiểm tra này diễn ra trước scenario hoặc data lookup. Success dùng `Cache-Control: no-store`. Organization, staff, booking, payment và refund có GET list/detail; organization/staff thêm POST collection và PUT detail với body strict. Mutation tạo stable ID/ISO timestamp bằng mock provider; staff chỉ tham chiếu organization hiện có. Booking/payment/refund chưa có mutation admin.

List trả `{items,page,pageSize,total}` với filter query/status/organization trước khi slice; `total` là tổng sau filter. Fixtures dùng ID ổn định, record/array frozen, email `.invalid`, tên/điện thoại mô phỏng và cross-reference organization→staff/booking→payment→refund hợp lệ. Handler clone seed và response, không sửa fixture dùng chung.

Header `x-mock-scenario` chỉ hoạt động trong development/test: `loading` chờ 200 ms có thể inject trong test; `empty` trả list 200 rỗng; `error` trả 503; `forbidden` trả 403; `not-found` chỉ ép detail 404 và bị bỏ qua trên list. Production bỏ qua header. Đây là control của MSW, không phải API backend hoặc query UI.

## Admin client boundary — Plan05 Task3

`createHttpAdminRepository({sessionToken})` nhận mock admin access rõ ràng từ caller; repository không đọc `sessionStorage` và chỉ gửi token qua `X-Mock-Session-Token`. Mọi list/detail/create/update forward optional `AbortSignal`. Query list chỉ serialize theo thứ tự canonical `query,status,organizationId,page,pageSize`; field dư bị loại trước request, còn giá trị contract sai bị từ chối cục bộ.

Mọi success body đi vào client dưới dạng `unknown` rồi parse qua Zod object strict. ID là safe string1..128, tiền là integer VND không âm, timestamp là ISO-8601, passengerCount là integer1..6 và status phải thuộc union domain. Paged response bắt buộc có đúng `items,page,pageSize,total`. Organization/staff request body cũng strict và được trim/parse trước POST/PUT. Success status phải đúng 200 hoặc201 theo operation; malformed JSON, extra/missing/invalid field và status thành công bất ngờ đều là `INVALID_RESPONSE`.

`AdminRepositoryError` là error duy nhất của boundary với code `VALIDATION_ERROR|HTTP_ERROR|NETWORK_ERROR|ABORTED|INVALID_RESPONSE`, status số và message/messageKey tĩnh. Non-2xx không dùng raw response text; 401,403,404 cùng code HTTP nhưng vẫn phân biệt bằng status. Retry chỉ bật cho network, invalid response, 429 và 5xx. Query keys phân cấp theo `admin/resource/list|detail`, snapshot params tách rời/frozen và không chứa session token.

## Organization client — Plan05 Task6

Organization pages lấy mock admin session qua auth hook rồi truyền token rõ ràng khi tạo repository. List/detail dùng TanStack Query và AbortSignal từ query boundary; create/update dùng mutation repository đã parse strict. Thành công invalidate toàn bộ organization list và detail đúng ID, đóng dialog bằng cách xóa riêng query key `dialog`, rồi phát thông báo `aria-live`. Pending khóa submit/close; lỗi mutation dùng thông báo tĩnh, không hiển thị raw response.

## Staff client — Plan05 Task7

Staff pages lấy mock admin token từ session hook và truyền rõ vào `createHttpAdminRepository`; repository không đọc storage. List/detail dùng `adminKeys.staff.list/detail`, còn organization selector gọi organization list canonical page1/pageSize100. Create/update gửi strict `StaffInput` qua boundary Task3; thành công invalidate toàn bộ staff list và detail đúng ID rồi phát thông báo `aria-live`. Pending khóa mọi submit/close để chống gửi lặp; lỗi và 404 dùng copy tĩnh, không hiển thị raw response. Đây vẫn là mock dev/test, không mở rộng endpoint hoặc backend contract.

## Transaction clients — Plan05 Task8

Booking, payment và refund list/detail dùng repository read-only Task3, explicit mock admin session token, AbortSignal và các query key `adminKeys.{bookings|payments|refunds}.list/detail`. URL list chỉ serialize canonical query/status/organizationId/page/pageSize. Response vẫn được strict Zod parse ở repository; UI không thêm mutation hay contract backend mới. HTTP403 hiện forbidden không retry, detail404 hiện not-found không retry; chỉ network/invalid response/429/5xx theo `AdminRepositoryError.canRetry` mới có nút thử lại.

## Plan07 Task8 — membership mock và projection

`GET /api/v1/admin/memberships?organizationId=&staffId=` trả danh sách membership độc lập; `POST /api/v1/admin/memberships` nhận `{staffId,organizationId,role,status,reason}` và `Idempotency-Key`, trả 201 hoặc phát lại kết quả cùng key/body; key tái sử dụng với body khác bị từ chối. `PUT /api/v1/admin/memberships/:organizationId/:staffId` cập nhật đúng membership, không chuyển tài khoản nhân viên sang nhà xe khác. Cả ba yêu cầu mock admin grant và dữ liệu được parse strict ở repository; mutation invalidate membership và staff queries. Dữ liệu chỉ ở bộ nhớ mock, không phải API backend thật. Organization có thêm `legalName`, `taxId`, `address`; Staff projection có `displayEmail`, `displayPhone`, `role`, `memberSince` tùy chọn. Các giá trị hiển thị đã che trong Figma được giữ nguyên; email/phone input `.invalid` chỉ là placeholder mô phỏng, không suy diễn dữ liệu thật.

Task8 list projection chứa các record canonical Figma và record tạo mới; legacy organization/staff seeds vẫn tồn tại qua detail để giữ accepted transaction cross-reference, không trộn vào10canonical rows. `PLATFORM_SUPPORT` có scope marker `organizationId=platform-blue`, không phải Organization hoặc operator membership; strict mutation chỉ chấp nhận marker này cùng platform role. Khóa/mở khóa account không sửa membership status; chỉnh membership không chuyển account sang nhà xe khác. Platform role dialog chỉ xác nhận role hỗ trợ hiện có và lý do, không phát minh role/profile mới.
