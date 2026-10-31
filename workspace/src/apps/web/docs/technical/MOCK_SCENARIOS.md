# Kịch bản mock

**Trạng thái:** Đã duyệt · **Công cụ:** MSW

## Dữ liệu nền

Đã triển khai collection readonly/frozen cho location, operator và trip với ID ổn định, không chứa dữ liệu thật. Tên bến và operator là nhãn mock/hư cấu; tỉnh/thành chỉ làm ngữ cảnh địa lý. Không có logo hoặc testimonial doanh nghiệp thật. Các fixture/database và workflow seat, booking session, booking, ticket, payment, refund, organization, staff, admin session bên dưới là phạm vi các plan downstream, chưa được search handlers triển khai.

## Search HTTP hiện có (Plan 03 Task 3)

MSW đăng ký `GET /api/v1/locations` trả `{ items: locations }` và `GET /api/v1/trips` trả `{ items, total }`. Request đi qua `tripSearchSchema.safeParse`, lọc route/ngày theo **Asia/Ho_Chi_Minh**, sort trên array mới và giữ seed order khi bằng key. PassengerCount validate 1..6; chưa lọc số ghế còn lại nên có kết quả sold-out. Không có state mutation hoặc booking workflow trong hai endpoints này.

Query nền có tính quyết định:

```text
/api/v1/trips?originId=loc-hcm&destinationId=loc-dalat&departureDate=2099-01-01&passengerCount=2
```

| Control trên query hợp lệ | Kết quả trong development/test |
|---|---|
| Không có scenario | HTTP 200, 4 trips cho query nền; sort mặc định departure |
| `sort=price-asc` hoặc `price-desc` | HTTP 200, theo giá tăng/giảm; không mutate fixture |
| `departureDate=2099-01-02` | HTTP 200, 1 trip; phân biệt ngày Việt Nam dù timestamp UTC cùng ngày trước |
| `scenario=empty` | HTTP 200, `{ items: [], total: 0 }` |
| `scenario=error` | HTTP 503, `application/problem+json`, code SERVICE_UNAVAILABLE, detail tiếng Việt hướng dẫn thử lại |
| Query thiếu/sai/trùng key core hoặc sort | HTTP 400 Problem Details, code VALIDATION_ERROR và errors theo field; validate trước scenario |
| Scenario không nhận diện | Bỏ qua control, trả kết quả search bình thường |

`scenario` chỉ được đọc khi `!import.meta.env.PROD && (import.meta.env.DEV || import.meta.env.MODE === "test")`; production và mode khác bỏ qua control. Không có selector scenario trong UI. Production MSW bootstrap bị tắt; hai handlers này là frontend mock, không tạo API backend. Lỗi 503 mô phỏng HTTP failure có cấu trúc, chưa mô phỏng transport error/timeout/latency. UUID traceId chỉ assert shape; instance không ghi query/PII và không trả raw Zod issues. Shape chính xác trong `API_CONTRACT.md`.

Network tests gọi fetch qua MSW server đã đăng ký tập trung, reset handler override sau từng case. Factory `createTripHandlers(readonly sourceTrips)` cho phép đưa fixture ties vào handler override, không sửa seed chung hoặc dựa vào thứ tự test. Browser smoke dùng cache Vite mới xác nhận service worker intercept và response thực; Zod được prebundle để lazy mock bootstrap không kích hoạt optimizer reload.

## Customer discovery đã kiểm chứng

- Home locations và Results có loading/empty/error/retry/success; search URL invalid có CTA phục hồi.
- Xe domain Giường nằm 34/Cabin 22; một seed sold-out khóa CTA; Plan04Task3 đã nối chuyến còn chỗ tạo empty session và mở guarded seat placeholder, chưa tạo booking/order hoặc chọn ghế.
- Immutable sort/vehicle filter/reset giữ core và mọi extra URL entry; vehicleType chỉ lọc client, không gửi repository/MSW.
- Unit/network tests dùng MSW override cho latency/transport failure; browser probe dùng test-only worker overrides cho loading/503/retry. Đây không phải global timeout/scenario UI trong sản phẩm.

## Customer downstream (chưa triển khai)

- Seat UI/recovery/countdown cho success, max6, conflict và expiry (wire handlers đã có ở Task2).
- Form hành khách hợp lệ/không hợp lệ.
- VNPay pending, success, failed và refresh callback an toàn.
- Tra cứu vé thành công/không tìm thấy.
- Hủy A01, A02 hoặc nhiều vé; refund chuyển sang processing.
- Đăng nhập email/số điện thoại; Google/Facebook thành công hoặc lỗi giả lập.

## Admin downstream (chưa triển khai)

- Danh sách/chi tiết tổ chức và nhân viên.
- Booking/payment/refund có dữ liệu, loading, empty, network error, not found và forbidden.
- Modal tạo/sửa có validation và submit states.
- Admin session hết hạn trả `401`; `403` chỉ là trạng thái phòng thủ vì v1 có một super admin.

## Điều khiển kịch bản

Control hiện có chỉ là query `scenario` cho GET trips như trên; không coi các customer/admin scenarios downstream là đã có handler hoặc UI. Các control về sau phải giới hạn development/test và test dùng handler override theo từng case thay vì phụ thuộc thứ tự chạy. Ownership pending theo TASK-006 (seat/session), TASK-007 (passenger/booking review và FR-003 policy detail), TASK-008 (payment), TASK-009 (ticket/auth/aftersales), TASK-010 (admin), xem [TASK-003](../../.tasks/003-mock-api-foundation.md).

## Seat/session mock — Plan 04 Task 2

- Immutable sleeper34/cabin22 seeds and resettable independent mockDb clones; GET seats and POST/PUT session endpoints are now implemented, without booking UI/repository/hooks.
- Deterministic network tests exercise create/10min original expiry/idempotent replay, replace/clear/own holds, six/seven/duplicate/unknown/sold/held/disabled, two-session races, atomic rollback, expiry release and reset isolation. Passenger boundary is structural/exact-seat only; form business rules remain Task6.
- Default browser mock persists minimal active-session state to optional dev/test sessionStorage for reload continuity. Same session/expiry/ownership/idempotency survive reload; invalid/expired snapshots are removed, never renewed. Seeds/fares stay canonical; no PII in URLs/logs/errors. reset clears snapshot; storage blocked means RAM only. See FRONTEND_ARCHITECTURE for bounds/lifecycle.
- Booking query scenario=empty/error is ignored in every mode, not a booking control. Use deterministic factory clocks/IDs and isolated MSW handler overrides in tests. Existing trips scenario gate is unchanged; no production scenario UI.
- GET trips counts remain immutable discovery seed snapshots; seat GET and session mutations provide live availability/conflict truth. Cross-tab synchronization and real persistence are outside this mock.

- Plan04Task3: browser/UI now starts sessions from Results. Test-only MSW override can hold POST or fail once503 to verify pending lock/retry key; no production scenario control was added. Successful session creation does not select seats or create a booking/order. Existing server/session snapshot and client draft preserve original expiry on refresh. Full seat/countdown/passenger UI remains downstream.
## Plan 04 Task 5 recovery scenarios

Seat selection now supports both layouts, own-held deselection after refresh, max6, exact passenger-count continue, pending lock, safe loading/error/refetch, atomic optimistic total/selection rollback, conflict modal with known codes and authoritative refetch, countdown/HOLD_EXPIRED recovery. Test/browser harnesses inject failures at MSW network boundary only; no booking scenario control is exposed in production UI. Missing/invalid persisted passengerCount fails closed. Expiry release is triggered by GET/hydration through the repository; no direct UI mock-state access. Optional sessionStorage remains tab-local dev/test continuity, not production persistence or cross-tab locking.

## Booking creation / locked review — Plan 04 Task 7

Default POST /api/v1/bookings body{sessionId}+required Idempotency-Key returns201 immutable pending-payment summary. Concurrent same-session requests and refresh/retry replay one booking/code/amount without renewing holds; cross-session reuse409 IDEMPOTENCY_CONFLICT. Incomplete contact/passenger/selection/total400, missing404, expiry410; Problem Details never echo input. Post-booking seat/passenger mutations409 BOOKING_LOCKED, no partial changes. Canonical mockDb/reset and bounded active-session snapshot persist booking/key references and original expiry; no payments/tickets.

Tests/harness override only MSW boundary for pending,503 retry,410 expiry and schema/total drift. There is no production scenario query/UI for booking. Production browser mocks remain disabled. Client snapshot key and mock snapshot key remain separate; malformed/expired snapshots discard safely and storage denial remains memory-only. Task8 owns subsequent payment state/completion cleanup.

Task7 ambiguous-success regression: create the mock booking while retaining the client draft without `bookingId`; a seat/passenger PUT must return sanitized 409 `BOOKING_LOCKED`, preserve the immutable booking/amount/expiry and expose review recovery. The review POST with the persisted key replays the same booking. Malformed already-booked local review data offers Home search recovery rather than a locked edit loop.

## VNPay mock — Plan 04 Task 8 (current)

Four explicit dev/test actions: success issues tickets once; failed/cancelled issue none and preserve booking/original expiry for retry with a new attempt; pending retains the same transaction and offers explicit recheck (never auto-success). Production UI exposes only normal pay/cancel and production-configured handler rejects failed/pending controls. Production browser mocks remain disabled.

MSW tests/isolated browser overrides cover create503 same-key retry, wrong/missing IDs, malformed response, expired hold, rapid double submit, double callback, terminal refresh after draft clear and ambiguous successful callback response. Returning Back after a lost response resumes the persisted transaction even though seats are already sold. Snapshot restore preserves same IDs/tickets/expiry; reset removes them. Completed receipts/private ticket proof are bounded24h/100payments/600tickets/262144characters and cross-validated against canonical fixtures. No new auth/lookup/cancellation endpoint or external bank integration.

Initial full E2E used14 workers and exhausted30s cold-start budgets (21pass/9timeout; initial pages24–28s). No stale workspace Node process remained. Concurrency bounded to2 without changing timeouts/retry/sleep: forced-cold Vite30/30 pass38.8s; final normal run30/30 pass39.6s. This prevents local cold-start resource contention rather than masking application failures.

## Guest lookup/detail — Plan04 Task9

Luồng thật qua MSW: payment success → link vé chưa có access → safe lookup recovery → body-only mã/proof → exact15min header grant → issued detail/other scoped tickets/refresh. Sai mã hoặc proof đều generic404; raw malformed400; thiếu/sai header401; known-expired410; valid grant ngoài scope404. Max100active grants503; expiry/reset prune access, giữ completed receipts/tickets. Snapshot malformed/cross-link/cap/TTL fail closed; clientmalformed/expired removes token+detail cache. Account access chưa có.

Network overrides trong test/browser chỉ tạo loading,503 retry,404 missing,410 revocation và malformed detail. Không production scenario UI/query. Shared E2E fixture dùng exported TEST_CONTACT_EMAIL để proof khớp contact, không giảm validation/auth. Form value không mutation variables/persist/log/URL; server snapshot giữ private Task8 proof theo ruling, lookup grant không copy proof. QR chỉ mock marker, không scanning/export/history/cancel.

## Auth/account scenarios — Plan04 Task10

Login mặc định chấp nhận hai public fixture `test+review@example.invalid` và `admin@blue.example.invalid` với mật khẩu demo ghi ngay trong UI; đây không phải secret/credential production. Sai credential trả generic401. OAuth Google/Facebook có select success/error chỉ ở development/test; production không gửi scenario và handler bỏ qua control. Register/forgot hợp lệ luôn202 cùng neutral copy, không tạo account/email thật.

Auth session exact1h/max100 được dọn expired trước grant mới và persist cùng bounded mock snapshot. Account history chỉ `status=issued`: customer fixture sở hữu vé khi normalized account email khớp private proof; admin403, thiếu/hết token401, query lặp/sai400. Tests/browser override network/state tại MSW boundary; không production query control. Task11 mới thêm cancelled/refund, vì vậy history hiện không giả dữ liệu hậu mãi.

## Partial cancellation/refund — Plan04 Task11

Guest token hoặc owner customer session có thể lấy options và hủy một/both vé issued. None bị chặn ở schema/UI. Unknown, duplicate, foreign-scope, other-booking hoặc already-cancelled trả lỗi an toàn và giữ toàn bộ state/refund count. Success tạo đúng một refund processing với100% selected fare; đây là policy mô phỏng, không gọi VNPay và không tự chuyển completed.

Retry cùng key/tập vé replay đúng refund kể cả sau refresh; đổi tập với cùng key conflict. Max100 refunds/keys trả service unavailable trước mutation. Snapshot restore kiểm tra refund-key-ticket cross-links và amount; malformed archive fail closed. Account history hỗ trợ all/issued/cancelled; guest detail phản ánh current status. Không có production scenario query hoặc quyền dựa trên bookingCode.

## Admin resources — Plan05 Task2

Admin fixtures là dữ liệu hư cấu frozen với ID/cross-reference ổn định và email `.invalid`; handler clone seed trước mutation. GET list/detail có cho organization/staff/booking/payment/refund; POST/PUT chỉ cho organization/staff và validate strict body/cross-reference. Mọi request cần mock session admin còn hạn trước khi trả data hay áp scenario.

Test/dev có thể gửi `x-mock-scenario: loading|empty|error|forbidden|not-found`. Loading là delay bounded 200 ms qua injectable function; empty chỉ làm list 200 rỗng; error503; forbidden403; not-found chỉ detail404 còn list chạy bình thường. Production bỏ qua header và browser production không mount MSW. Scenario không nằm trong query string hoặc repository/cache contract.
