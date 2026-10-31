# Mapping dữ liệu frontend

**Trạng thái:** Dùng cho mock frontend

## TASK-014 Explore

| UI | Domain / JSON | Quy tắc |
| --- | --- | --- |
| Tỉnh/thành | `ProvinceSummary.slug/name/region/description` | GET public mock; slug canonical lowercase/hyphens; `isMock:true` |
| Số điểm/nhà xe | `pickupCount/dropoffCount/operatorCount` | Derived từ detail points/services/operators; schema validate counts |
| Điểm đón/trả | `ProvinceDetail.points[].services` | pickup/dropoff hoặc cả hai; cùng physical point có thể xuất hiện hai vùng |
| Tên/địa chỉ/nhà xe | `points[].name/address/operatorIds` + `operators` | Địa chỉ cấp khu vực mô phỏng; references phải hợp lệ |
| Tọa độ địa lý | `latitude/longitude/coordinateSource` | Hiện cả ba null; không dựng map/chỉ đường từ dữ liệu chưa xác minh |
| Search tỉnh/thành | URL `q` | Tối đa100ký tự, local accent-insensitive filter, giữ query keys khác; không đưa vào API/cache identity |

Chi tiết source/CSS/BEM/layout coordinates và provenance tại [EXPLORE.md](./EXPLORE.md).

| Vị trí UI | State/domain FE | JSON mock | Kiểu/quy tắc |
|---|---|---|---|
| Điểm đi | `search.originId` | `originId` | string |
| Điểm đến | `search.destinationId` | `destinationId` | string |
| Ngày đi | `search.departureDate` | `departureDate` | `YYYY-MM-DD` |
| Số khách | `search.passengerCount` | `passengerCount` | integer 1..6 |
| Nhà xe | `trip.operator.name` | `operator.name` | string |
| Nhãn nhà xe | `trip.displayOperatorName` | `displayOperatorName` | presentation-only string; không đổi operator ID |
| Nhãn loại xe | `trip.vehicleLabel` | `vehicleLabel` | presentation-only string; `vehicleType` vẫn quyết định seat layout thật |
| Giờ khởi hành | `trip.departureTime` | `departureTime` | ISO 8601 UTC |
| Giờ đến | `trip.arrivalTime` | `arrivalTime` | ISO 8601 UTC |
| Giá vé | `trip.fareVnd` | `fareVnd` | positive integer VND; 0 bị response schema từ chối |
| Ghế còn | `trip.availableSeatCount` | `availableSeatCount` | nonnegative integer |
| Điểm đón/trả hiển thị | `trip.originStopName` / `trip.destinationStopName` | cùng tên | presentation-only string |
| Tiện ích lọc mock | `trip.amenities` | `amenities` | readonly enum array |
| Trạng thái ghế | `seat.status` | `status` | enum |
| Ghế đã chọn | `booking.selectedSeatIds` | `seatIds` | string[] |
| Hết hạn giữ ghế | `booking.expiresAt` | `expiresAt` | ISO 8601 UTC |
| Hành khách | `booking.passengers` | `passengers` | array theo seat |
| Tổng tiền | `booking.totalVnd` | `totalVnd` | integer VND |
| Mã đặt vé | `booking.code` | `bookingCode` | string |
| Liên kết payment guard | `bookingDraft.bookingId?` | `bookingId` khi tạo booking | optional string; Plan 04 Task 7 lưu vào draft trước navigation |
| Mã vé | `ticket.code` | `ticketCode` | string |
| Trạng thái payment | `payment.status` | `status` | enum |
| Trạng thái refund | `refund.status` | `status` | enum |

Mỗi thay đổi contract phải cập nhật file này, `API_CONTRACT.md`, handler MSW, schema Zod, repository/mapper và test liên quan. Không đưa email, số điện thoại hoặc token vào query string.

Plan 04 Task 1: full BookingDraft được persist riêng trong sessionStorage, không chứa Trip/Seat server entities. `selectedSeatIds`/`totalVnd` thay cùng action replaceSeats; contact và passengers dùng typed actions. `expiresAt` giữ ISO UTC gốc qua set/patch/hydration, không tự gia hạn. Hydration parse full shape và expiry trước khi guard đọc; legacy minimal draft không được coi là full persisted data. Đây chỉ là state boundary, chưa có wire handler/mutation booking trong Task 1.

Plan 03 Task 4 dùng `tripResponse.schema.ts` tại HTTP repository để parse Location/Trip và hai collection envelopes; ISO UTC Z, nested nonempty strings, arrival sau departure và total bằng items.length được kiểm tra trước khi items đi vào Query cache. Wire fields/domain fields giữ nguyên hình dạng nên chưa cần mapper riêng. UI chỉ qua feature hooks, không nhận raw payload hoặc server error strings.

Plan 07 Task 2 consolidation: TripCard chỉ nhận validated Trip qua props. `fareVnd`, `departureTime`, `arrivalTime`, `availableSeatCount` và `vehicleType` là một canonical truth dùng chung cho Results, booking session, seat map, review, payment và ticket; không có duplicate `displayFare*`, `displayTime*`, `displaySeat*` hoặc `displayVehicleType`. `vehicleLabel` có thể giữ marketing copy Figma nhưng typed `vehicleType` phải khớp layout ghế mở sau CTA. Departure/arrival giữ UTC ở datetime và hiển thị theo Asia/Ho_Chi_Minh; duration tính elapsed minutes. `availableSeatCount=0` khóa CTA.

## Seat/session boundary — Plan 04 Task 2

| Before | Implemented wire/domain | Constraint |
|---|---|---|
| Seat status proposed enum | Seat.id/code/deck/row/column/status; GET {tripId,vehicleType,items} | IDs per trip; geometry from immutable vehicle seeds; selected is session state, not seed status |
| Draft selection only | PUT {seatIds} → BookingSession.selectedSeatIds | Unique, max6, atomically replace; own holds retained; unknown IDs never echoed |
| Draft total only | BookingSession.totalVnd | Trusted fareVnd × selected count; no fees/client price |
| Client expiry only | POST server expiresAt and unchanged PUT/replay expiry | Original ISO UTC now+10min, equality expired, never refresh renewal |
| Contact/passengers draft only | PUT {contact,passengers} → full session | Structural strings + exact selected-seat correspondence; Task6 business rules pending |
| No refresh server continuity | Mock-only bounded blue-mock-booking-db snapshot | Active sessions/key indexes only; canonical seats/fares reconstructed, original ownership/expiry retained |

The booking server state is independent of blue-booking-draft. Its optional dev/test storage adapter is not a second runtime draft store or production persistence. Repository/runtime response schemas and hooks are Task3/downstream; the current Results CTA is still deferred. GET trips continues to expose immutable discovery seed counts; GET seats is authoritative for live mock availability and session mutation conflicts.

Plan04Task3 mapping: Results Trip.id → hook createSession(tripId) → POST {tripId} with attempt key header; parsed201 BookingSession → existing setDraft projection → bookingSeatsPath(sessionId). Wire/server status is not persisted in blue-booking-draft; only validated draft fields are copied. HTTP201 runtime schema rejects wrong trip/status/expiry/selection/passenger/total shape before either store or navigation. Failure preserves prior draft identity/storage. UI consumes safe code/canRetry rather than raw response; pending props are presentation-only. No new route/query fields, PII or Task4 seat/countdown behavior.
## Plan 04 Task 5 mapping (current)

| UI/domain | Wire/persistence | Boundary |
|---|---|---|
| TripSearch.passengerCount → BookingDraft.passengerCount | POST `{tripId,passengerCount}` → BookingSession.passengerCount → both tab snapshots | Number integer1..6, required; no navigation-state fallback; legacy missing count rejected |
| SeatLayout.trip | GET seats `trip:Trip` | Existing Trip schema; canonical operator/route/UTC schedule/fare recovered after refresh |
| Selected seat IDs | PUT full seatIds → full BookingSession | Stable IDs; exact requested selection and fare×count verified before commit |
| Conflict display codes | Safe conflictingSeatIds intersect validated layout | Never render raw submitted IDs/server strings; rollback entire prior draft/cache |
| Expiry recovery | `/trips?reason=expired` plus optional trusted core params | No PII; Vietnam service date, never UTC string prefix; no incomplete trips query |

These signatures supersede the earlier Task3 createSession(tripId) examples. Selection pending is transient Query state, not a new persisted business status. No Task6 passenger business rules or completion/payment implementation is included.

## Passenger mapping — Plan 04 Task 6 (current)

| UI / domain | Wire / storage | Boundary |
|---|---|---|
| Required contact name/email/mobile | PUT body contact; verified BookingSession.contact → existing draft | Trim, safe business validation, body only; never query/log |
| One passenger row per selected seat | passengers[{seatId,fullName,phone?}] | Hidden stable ID, fieldset keyed by ID, exact set before network; order independent response verification |
| Seat label and pickup | validated GET layout.items.code / trip.origin.name | Read-only pickup; no untrusted navigation state, notes or fee field |
| Saved values on back/refresh | draft contact/passengers from prior successful PUT | Match by seatId, detached defaults; unsaved keystrokes stay local to RHF |
| Save outcome | verified full draft → bookingReviewPath(sessionId) | Store before SPA route; unchanged expiry/selection/total/count; no booking creation |

This section supersedes Task5's statement that passenger business validation is pending. Mock handler remains structural by design; the frontend repository/form owns this slice's validated values. Unknown extra response fields are stripped; safe errors expose no raw payload.

## Review/create-booking mapping — Plan 04 Task 7

| UI/domain | Wire/persisted projection | Verification |
|---|---|---|
| Trusted review | validated layout.trip/items plus draft contact/passengers | Exact held selected IDs/count/fare total, business-valid contact/passenger set; no row index identity |
| bookingAttemptKey | canonical draft optional validated field; Idempotency-Key header | Generate/persist before POST; same-session save/refresh/retry preserves key, new session does not inherit |
| Create request | POST strict {sessionId} | No client amount/contact/passengers/key query or competing repository/store |
| BookingCreationSummary | 201 bookingId/bookingCode/sessionId/totalVnd/pending-payment | Runtime readonly schema; requested session/exact draft total/existing ID checked |
| Successful transition | setDraft({...source,bookingId}) → paymentVnPayPath | Original expiry/key/selection/contact unchanged; matching payment guard before Outlet |
| Locked session | session.bookingId + immutable summary + bookingKeys in mockDb snapshot | PUT seats/passengers409 BOOKING_LOCKED; review resume, no editing/duplicate booking |

Earlier statements that review/create-booking are pending are superseded for Task7 only. VNPay transactions/results/ticket issuance remain Task8+, with no payment endpoint added.

## Payment mapping — Plan 04 Task 8 (current)

| UI/domain | Wire/storage | Boundary |
|---|---|---|
| PaymentAttempt key/scenario/optional paired IDs | Existing BookingDraft/sessionStorage; key header on create | Persist before POST, reuse failed network attempt, terminal failed/cancelled rotates only payment metadata |
| PaymentTransaction | Strict201 readonly resource | Exact canonical booking/trip/session/amount/original expiry, local IDs-only returnPath; no PII/full Trip |
| Callback browser URL | Only transactionId/resultId via paymentReturnPath + URLSearchParams | Server resolves outcome; no status, booking code, amount, email or phone in URL |
| PaymentResult |200 readonly status + issued ticket summaries | Unique exact set, canonical total; matching validated success only clears draft |
| Public journey display | result.tripId -> existing useSeats/getSeats | Trusted route/operator/time after refresh; no copied Trip in receipt |
| Private issued Ticket | Existing bounded dev/test mock snapshot only | Passenger name/optional phone plus private guestVerification email/phone; no contact fullName, never projected into payment responses/logs |
| Paid lifecycle | paidBookings + sold seats + immutable tickets | Creation summary stays immutable; completed session PII cleared; callback replay cannot duplicate issuance |

Supervisor ruling: retain private normalized contact email/phone proof because optional passenger phone may be absent or belong to someone else. Task9 compares normalized values safely and returns only a short-lived lookup session as specified below. Cost if wrong: private proof migration and up to6 duplicated proof objects; not production verification.

## Guest ticket access — Plan04 Task9

| UI/domain | Wire/storage | Boundary |
|---|---|---|
| Lookup form bookingCode/proof | Strict POST body, không query | Code trim uppercase; email lowercase/trim hoặc mobile0/+84 canonical; proof không echo/persist/log |
| Lookup response | token + ticketCodes + expiresAt | Opaque UUID, unique scope1..6, original15min; không passenger/proof/booking object |
| Client access | blue-ticket-access sessionStorage, <=4096 chars | Strict readonly schema, effect-only hydrate, malformed/expired remove; storage denial recovery |
| Mock grant | Canonical mockDb ticketAccess + existing bounded snapshot | Max100, exact15min TTL, createdAt/canonical issued-ticket/same-booking links; no submitted verificationValue |
| Detail authorization | X-Ticket-Lookup-Token header | Token không URL/query key/log; ticketCode không tự cấp quyền, payment link cũng cần lookup |
| TicketDetail |200 summary + bookingCode/payment ref/issuedAt/canonical trip/passenger name | Không guestVerification/contact/email/phone; fare/id exact canonical |
| Expiry/revocation | timer/focus/visibility/storage/server401/410 | Xóa token và ticket-detail Query cache, recovery canonical /tickets/lookup |

Đây là phần triển khai tiếp contract private proof của Task8; không thay đổi payment receipt. Account session/history được Task10 mở rộng bên dưới; cancel vẫn chưa triển khai. Chi phí ruling: phải lookup lại sau15 phút/reset/storage loss/cap; production cần auth/permission/rate limit phía server thật.

## Auth/account mapping — Plan04 Task10

| UI/domain | Wire/storage | Boundary |
|---|---|---|
| Login email/password | POST body only | Zod trim/lowercase email, password8..128; input bị xóa trước await, không cache/persist/URL/log |
| OAuth provider/scenario | POST provider google/facebook + optional dev/test scenario | Production không gửi/nhận control lỗi; UI luôn ghi rõ mô phỏng |
| AuthSession | `{token,userId,role,expiresAt}` → `blue-mock-session` | UUID opaque, role customer/admin, exact1h, không email/password/profile |
| Register form | fullName/email/phone/password/confirmPassword →202 accepted | Neutral; không tạo fixture/account/email thật |
| Forgot form | email →202 accepted | Cùng copy cho mọi email hợp lệ, không account enumeration claim |
| History filter | fixed `status=issued` | GET header token; response `{items,total}` parsed strict; không cancelled/refund giả |
| Account ownership | server session identity → fixture normalized email → private ticket proof | Không dùng ticketCode/bookingCode làm authority; public TicketDetail không thêm email/proof |
| Intended route | router state `from` | Chỉ canonical local path/validated trip query; role fallback account/admin |

## Cancellation/refund mapping — Plan04 Task11

| UI/domain | Wire/storage | Boundary |
|---|---|---|
| Booking cancellation page | `bookingCode` path + guest/account header | Path chỉ định resource, header mới là authority; không đưa token/proof vào URL/query |
| Checkbox A01/A02 | `TicketDetail.ticketId` → strict `{ticketIds}` |1..6 unique, same booking/scope, tất cả phải issued; request atomic |
| Confirm copy | selected `ticketCode[]` + sum `fareVnd` | Hiển thị exact code; estimate100% tính từ response trusted, ghi rõ mô phỏng |
| Mutation attempt | required `Idempotency-Key` header | Tập ID canonical sorted; same key/same set replay, changed set conflict |
| Refund result | `refundId,bookingId,bookingCode,ticketIds,amountVnd,status,createdAt` | Chỉ `processing`; không claim VNPay đã hoàn thật hoặc có ngày hoàn tất |
| Ticket lifecycle | private Ticket `issued|cancelled` → public detail/history badge | Selected-only transition; payment issuance summary gốc không bị rewrite |
| Account filter | `status=all|issued|cancelled` | Server ownership trước filter; strict single query value |
| Refresh continuity | bounded refunds + cancellationKeys in existing mock snapshot | Max100 mỗi map, canonical cross-links/amount/status; malformed archive fail closed |

## Admin domain/list mapping — Plan05 Task1

| UI/domain | Mock wire | Boundary |
|---|---|---|
| Organization/Staff ID và quan hệ | `id`, `organizationId` string | Safe identifier chỉ áp dụng cho list query; runtime entity parse thuộc Task3 |
| Booking/payment/refund ID | `id`, `bookingId`, `paymentId` string | Plain strings, không branded ID |
| Tiền | `totalVnd`, `amountVnd` number | Integer VND phải được runtime schema Task3 xác nhận |
| Thời gian | `createdAt`, `updatedAt` string | ISO-8601 phải được runtime schema Task3 xác nhận |
| List response | `{items,page,pageSize,total}` | `PagedResult<T>`; chưa có handler/repository trong Task1 |
| List URL | `query?,status?,organizationId?,page,pageSize` | Single-value only; invalid/unknown/repeated input normalize an toàn, page1/pageSize20, max pageSize100 |

### Admin mock handlers — Plan05 Task2

| UI/domain | Mock wire | Boundary |
|---|---|---|
| Quyền admin | `X-Mock-Session-Token` | Kiểm tra session còn hạn + role admin trước data/scenario; missing/expired401, customer403 |
| List state | query/status/organizationId/page/pageSize → `{items,page,pageSize,total}` | Filter trước slice; total sau filter; payload clone |
| Organization create/update | strict contact/name/status body → POST/PUT | Server mock cấp id/createdAt/updatedAt; unknown field400 |
| Staff create/update | strict organizationId/profile/status body → POST/PUT | organizationId phải tồn tại; server mock cấp id/timestamps |
| Booking/payment/refund | GET list/detail | Read-only trong Task2; quan hệ deterministic qua bookingId/paymentId |
| Scenario | header `x-mock-scenario` | Chỉ dev/test; không đưa vào URL/domain/cache key và production bỏ qua |

### Admin repository boundary — Plan05 Task3

| FE boundary | Mock wire | Quy tắc |
|---|---|---|
| `createHttpAdminRepository({sessionToken})` | `X-Mock-Session-Token` header | Access được caller truyền rõ; repository không đọc storage, token không vào URL/query key |
| `AdminListParams` | canonical query/status/organizationId/page/pageSize | Projection bỏ field dư; input sai bị `VALIDATION_ERROR`; AbortSignal forward |
| Entity/PagedResult | unknown JSON → strict Zod parse | Safe IDs, integer VND, ISO timestamps, exact status và exact object keys |
| Organization/Staff mutation | strict input → POST201 hoặc PUT200 | Client parse cả request và response; booking/payment/refund vẫn read-only |
| Failure | `AdminRepositoryError` | Tĩnh, không raw server text; status giữ 401/403/404 phân biệt; network/abort/contract drift có code riêng |
| TanStack identity tương lai | `adminKeys.{resource}.list/detail` | Tuple và params frozen/detached; không token/scenario/unknown field |

### Organization UI — Plan05 Task6

| UI / form | Domain / mock wire | Boundary |
|---|---|---|
| Tên tổ chức | `OrganizationInput.name` | RHF/Zod trim và giới hạn độ dài trước repository |
| Người liên hệ | `contactName` | Bắt buộc, trim; không đưa vào URL/log |
| Email liên hệ | `contactEmail` | Email hợp lệ; chỉ truyền trong body POST/PUT |
| Số điện thoại | `contactPhone` | Chuẩn mobile Việt Nam theo form schema; chỉ truyền trong body POST/PUT |
| Trạng thái | `status: active\|inactive` | Select canonical, schema và response parser cùng union |
| Create/edit | POST collection / PUT detail | Mock admin token do caller truyền; pending chống gửi lặp; success invalidate list + detail |

### Staff UI — Plan05 Task7

| UI / form | Domain / mock wire | Boundary |
|---|---|---|
| Tên nhân viên | `StaffInput.fullName` | RHF/Zod trim, bắt buộc, tối đa 120 ký tự |
| Email | `email` | Email hợp lệ; chỉ nằm trong POST/PUT body, không URL/log |
| Số điện thoại | `phone` | 10–15 chữ số theo contract mock; invalid bị chặn trước repository |
| Tổ chức | `organizationId` | Select lấy từ organization query; safe ID, bắt buộc và server mock xác nhận reference |
| Trạng thái | `status: active\|inactive` | Native select, form schema và strict response schema cùng union |
| Create/edit | POST collection / PUT detail | Explicit mock admin token; pending chống gửi lặp; success invalidate staff list + exact detail |

### Admin transactions UI — Plan05 Task8

| UI | Domain/wire field | Quy tắc |
|---|---|---|
| Đơn đặt vé | `AdminBooking.id/bookingCode/organizationId/customerName/routeLabel/passengerCount/totalVnd/status/createdAt/updatedAt` | Read-only; integer VND, ISO time, status canonical |
| Thanh toán | `AdminPayment.id/bookingId/transactionCode/amountVnd/status/createdAt/updatedAt` | Link `bookingId` sang detail booking; không tạo mutation |
| Hoàn tiền | `AdminRefund.id/bookingId/paymentId/amountVnd/status/createdAt/updatedAt` | Link đúng booking/payment; không suy diễn lý do hoặc backend state ngoài contract |
| Trạng thái | exact union booking/payment/refund | Ba map dùng `satisfies Record<Status,{label;tone}>`; thiếu member làm TypeScript fail |

## Plan07 Task8 — organization và membership

| UI | Mock contract | Ghi chú |
| --- | --- | --- |
| Tên pháp lý, mã số thuế, địa chỉ | `Organization.legalName`, `taxId`, `address` | Request/response parse strict; thêm vào mock CRUD |
| Email/điện thoại nhân viên đã che | `Staff.displayEmail`, `displayPhone` | Không suy diễn dữ liệu gốc từ frame |
| Nhà xe, nhân viên, vai trò, trạng thái, lý do | `MembershipInput` | POST có idempotency key; PUT theo cặp, không chuyển account |
| Thành viên từ | `Membership.memberSince` | Ngày ISO, server mock sở hữu |
| Hỗ trợ nền tảng | `Staff.role=PLATFORM_SUPPORT`, scope marker `platform-blue` | Không tạo Organization/membership nhà xe; account status độc lập membership status |
| Lý do xác nhận quyền nền tảng | `StaffInput.membershipReason` | Body-only, tối đa500ký tự, không đưa URL/log |
