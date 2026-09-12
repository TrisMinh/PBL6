# 3.7.2 Screen Contracts

Mỗi row là contract tối thiểu; thiết kế chi tiết có thể thay layout nhưng không được bỏ state/action/evidence.

## Customer screens

| Screen | Requirement | Dữ liệu/action chính | State bắt buộc |
|---|---|---|---|
| Register/verify | FR-IAM-001..002 | fullName, email, phone, password; email challenge/resend | validation, generic identity response, expired/rate-limited |
| Login/session | FR-IAM-003..005 | login, refresh, logout, reset | invalid credential, locked, session expired, offline |
| Search | FR-SEARCH-001..004 | origin, destination, date, passenger count, filter/sort/page | loading, empty, invalid query, retry |
| Trip detail | FR-SEARCH-005..006 | schedule, stops, operator, fare/policy, availabilityAsOf | stale availability, not sellable, retry |
| Seat map | FR-BOOK-001..003 | TripSeat status, multi-select, create hold | keyboard focus, unavailable conflict, all-or-nothing failure |
| Passenger/summary | FR-BOOK-004..007 | contact, passenger/seat, pickup/dropoff, server price, countdown | field error, price changed, hold expired, double-submit blocked |
| Payment | FR-PAY-001..007 | method, provider action, server status polling | PROCESSING, CONFIRMING, success, failed, cancelled, needs support |
| Booking list/detail | FR-BOOK-008 | own bookings/tickets and financial status | empty, pagination, owner-not-found, stale refresh |
| Ticket | FR-TICKET-001..003 | QR/public code, Trip/Passenger/seat/policy/status | issued, cancelled, refunded, used, offline cache age |
| Cancellation | FR-BOOK-009, FR-PAY-008 | previewId, fee/refund/policy/expiresAt, confirm | not allowed, preview stale, refund processing/failed/succeeded |
| Profile | FR-IAM-006 | view/update; reverify email change | optimistic conflict, pending verification, safe error |
| Notifications | FR-NOTIF-001..002 | cursor list, mark read | empty, retry, duplicate event no duplicate item |

## Operator/Driver/Admin screens

| Screen | Requirement | Dữ liệu/action chính | State bắt buộc |
|---|---|---|---|
| Organization | FR-OPS-001, FR-ADMIN-001 | profile/status/membership according to actor | permission denied, version conflict, audit reason |
| Bus/seat layout | FR-OPS-002,009 | bus CRUD/deactivate, seat template version | referenced/no hard-delete, invalid layout, conflict |
| Driver | FR-OPS-003,009 | profile, license expiry, deactivate | expired license, assigned resource conflict |
| Route/stop | FR-OPS-004,009 | ordered stops, timing, deactivate | invalid sequence, referenced route |
| Trip scheduler | FR-OPS-005..006 | draft, Bus/Driver/Route/fare/policy, publish | incomplete, schedule conflict, inventory preparing, sellable |
| Trip operations | FR-OPS-007..010 | assignment, state transition, manifest | invalid transition, stale version, not assigned |
| Check-in | FR-TICKET-004..006 | scan/manual code, validate and commit | valid, wrong Trip, cancelled, already checked in, offline blocked |
| Trip cancellation | FR-OPS-008 | reason, affected count, operation progress | duplicate command, partial batch progress, refund pending/failure |
| User/role/membership | FR-IAM-008..009, FR-ADMIN-001 | status, roles, tenant membership | self-escalation/last-admin blocked, audit reason |
| Transaction search | FR-PAY-009, FR-ADMIN-002 | Booking/Payment/Refund/audit lookup | masked PII, cross-scope denial, no mutation |
| Reports | FR-REPORT-001..002 | date/timezone/scope, dataAsOf, metric definitions | empty, projection lag, >10s bounded error/no export MVP |

## Destructive/financial confirmation pattern

1. Tải server preview/current version.
2. Hiển thị actor, target, policy/reason, fee/refund và tác động.
3. Bắt buộc reason nếu contract yêu cầu.
4. Khi xác nhận, khóa nút và gửi stable idempotency key.
5. Thành công/xung đột đều refetch authoritative state.
6. Không tự retry command tài chính khi outcome chưa chắc chắn.

## Error presentation

- Inline field error cho `VALIDATION_ERROR.details.fields`.
- Banner/toast chỉ cho lỗi page/action; không dùng toast làm nơi duy nhất cho lỗi quan trọng.
- `ACCESS_DENIED/RESOURCE_NOT_FOUND` không tiết lộ tenant/owner khác.
- `RATE_LIMITED` hiển thị thời gian thử lại từ `Retry-After` nếu có.
- Luôn có correlation ID trong panel hỗ trợ kỹ thuật, không bắt người dùng đọc mã trong luồng bình thường.
