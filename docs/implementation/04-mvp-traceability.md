# MVP Traceability — Requirement đến code boundary

Register này là gate lập trình cho MVP theo SRS 2.1.0. Có đúng **61 FR MUST active**; `FR-REPORT-004` Power BI là `SHOULD` hậu MVP. Một slice chỉ đạt Done khi endpoint/event/table/UI/test ở cùng hàng đã được triển khai và evidence được gắn vào requirement ID.

| Scope | FR MUST active | OpenAPI operation | Event/message chính | Database owner | UI/test owner |
|---|---|---|---|---|---|
| Identity | `FR-IAM-001`..`009` | `registerUser`, `verifyRegistration`, `resendVerification`, `login`, `refreshSession`, `logout`, `forgotPassword`, `resetPassword`, `getMyProfile`, `updateMyProfile`, `listUsers`, `getUser`, `changeUserStatus`, `replaceUserRoles`, `listMemberships`, `addMembership`, `changeMembership` | `UserRegistered` | Identity: users, auth challenge/session, role/permission/membership, audit | Customer auth/profile; Admin IAM; `TS-AUTH-*`, `TS-PROFILE`, `TS-ADMIN-IAM` |
| Search | `FR-SEARCH-001`..`006` | `searchTrips`, `getTrip`, `getTripStops` | Trip projection updates | Transport: trip/route/stop/bus + search indexes | Customer search/detail; `TS-SEARCH` |
| SeatHold/Booking | `FR-BOOK-001`..`009`, `FR-BOOK-011`..`012` | `getTripSeats`, `createSeatHold`, `getSeatHold`, `releaseSeatHold`, `createBooking`, `listMyBookings`, `getMyBooking`, `previewCancellation`, `cancelBookingItems`, `getTripManifest` | `TripInventoryReady`, `SeatHoldCreated/Expired`, `BookingCreated/Paid/Cancelled`, `RefundRequested` | Booking: trip inventory, hold, booking/item/passenger/ticket, cancellation preview, `payment_channel` | Customer booking/cancel/history; Operator manifest; `TS-SEAT-HOLD`, `TS-BOOK-*`, `TS-CANCELLATION-REFUND` |
| Payment/Refund | `FR-PAY-001`..`009`, `FR-PAY-011`..`013` | `createPayment`, `listBookingPayments`, `getPayment`, `cancelPayment`, `createRefund`, `getRefund`, `searchAdminPayments`, `searchAdminRefunds`, `handlePaymentWebhook`, `listOperatorSettlements`, `listAdminSettlements`, `createOperatorPayout` | `PaymentSucceeded/Failed`, `RefundSucceeded/Failed`, `PaymentCompensationRequested` | Payment: payment/attempt/webhook/refund/reconciliation, booking_settlements, ledger_entries, operator_payouts | Customer payment result; Finance trace/settlement; `TS-PAYMENT`, `TS-CANCELLATION-REFUND`, `TS-ADMIN-TRACE` |
| Ticket/check-in | `FR-TICKET-001`..`006` | `listMyTickets`, `getMyTicket`, `validateTicket`, `checkInTicket` | `TicketIssued/Cancelled/CheckedIn` | Booking: tickets + `payment_channel` + business audit/outbox | Customer ticket; Driver scan/manual entry; `TS-TICKET-VIEW`, `TS-CHECKIN` |
| Operator/Trip | `FR-OPS-001`..`011` | Organization/Bus/Driver/Route/Trip CRUD trong tag `Operator`, `publishTrip`, `cancelTrip`, `transitionTrip`, `getMyAssignments` | `TripPublished/Updated/StatusChanged/Cancelled` | Transport: organization (`allow_pay_later`, `commission_rate`)/bus/seat/driver/route/trip/assignment | Backoffice operations; Driver assignments; `TS-OPS-*`, `TS-TRIP-*` |
| Notification | `FR-NOTIF-001`..`002` | `listMyNotifications`, `markNotificationRead` | consume các outcome MVP có notification | Notification: template/notification/delivery attempt | Notification center + email; `TS-NOTIFICATION` |
| Platform Admin | `FR-ADMIN-001`..`002` | Admin IAM + `searchBookingsForSupport`, `searchAdminPayments`, `searchAdminRefunds`, `listAdminSettlements`, `createOperatorPayout` | không thêm command sửa lịch sử | Identity/Booking/Payment audit và read model | Admin IAM/transaction trace; `TS-ADMIN-IAM`, `TS-ADMIN-TRACE` |
| Reporting | `FR-REPORT-001`..`002` | `getRevenueReport`, `getBookingReport`, `getOccupancyReport` | consume Booking/Refund/Trip/Ticket events | Reporting projections/checkpoints | Admin/Finance reports; `TS-REPORT` |

## P1 bị khóa khỏi runtime MVP — 11 FR SHOULD

`FR-SEARCH-007`, `FR-BOOK-010`, `FR-PAY-010`, `FR-PROMO-001`, `FR-PROMO-002`, `FR-REVIEW-001`, `FR-REVIEW-002`, `FR-NOTIF-003`, `FR-ADMIN-003`, `FR-REPORT-003`, `FR-REPORT-004`.

Không được tạo route, navigation, consumer binding hoặc table “để sẵn” cho các FR này. Thiết kế P1 vẫn được giữ để lưu quyết định, nhưng chỉ kích hoạt bằng release decision, contract/migration mới và test tương ứng.

## Quy tắc evidence

- Tên test hoặc test trait chứa requirement/AC ID; CI xuất manifest ID đã chạy.
- OpenAPI conformance và event schema test là bắt buộc, không thay thế test nghiệp vụ.
- Các flow tiền/ghế/check-in phải có integration test trên PostgreSQL/RabbitMQ thật và test retry/idempotency.
- UI phải có loading, empty, validation, conflict, forbidden, unavailable và retry state được mô tả trong Screen Contract.

## Evidence snapshot — 2026-10-29

| Scope | Automated evidence hiện có | Trạng thái gate |
|---|---|---|
| Identity | 17 PostgreSQL integration tests; Auth/Common 39/39, security 16/16, admin/profile/second-customer 18/18 Postman assertions | API complete; Customer/Mobile auth-profile và Back-office IAM đã build production |
| Transport/Search/Ops | 9 PostgreSQL integration tests; 35/35 targeted Postman assertions gồm lifecycle, conflict và cross-tenant | API complete; Customer/Mobile search và Back-office Operator/Driver đã build production |
| Booking/Ticket | 8 PostgreSQL integration tests; 45/45 targeted Postman assertions gồm atomic/concurrent holds, validation, ownership và check-in | API complete; cancellation matrix còn được xác nhận lại trong full Round 2 |
| Payment/Refund/Settlement | 5 PostgreSQL integration tests; PAY-11 3/3 và signed pay/cancel 9/9; DB readback xác nhận payment/refund/settlement reversal | API complete; performance/reconciliation ngoài happy path còn chờ release gate |
| Reporting | 2 PostgreSQL integration tests; RefundSucceeded/BookingCancelled được kiểm tra ở cả hai thứ tự, projection cuối `REFUNDED`/net 0 | API behavior và report/finance UI covered; full Postman chờ Task 9 |
| Gateway/Contract | 10 gateway integration tests, 9 contract tests; OpenAPI 2.1.0 có callback/return và safe default error envelope | Contract complete cho API hiện hành |
| Notification | 2 integration tests trong full solution; Web/Mobile notification list + mark-read build thành công | Client complete; full notification Postman chờ Task 9 |
| Cross-cutting | Full .NET solution 96/96 trước Task 6; Docker `pbl6-r2` fresh build healthy | Production security/restart/backup chờ Task 8 |

Task 7 client gate: Customer Web và Back-office Web production build thành công; Mobile TypeScript check và Expo Android Hermes export (930 modules, 2.1 MB bundle) thành công. Task 8 production gate: non-root/read-only images, production secret preflight, fresh-stack health, restart recovery, public smoke và backup/restore sáu database đều pass; chi tiết tại `08-production-deployment-runbook.md` và `09-production-readiness-checklist.md`. Full deterministic Postman Round 2 lần cuối thuộc Task 9.
