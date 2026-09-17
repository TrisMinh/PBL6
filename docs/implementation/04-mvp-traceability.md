# MVP Traceability — Requirement đến code boundary

Register này là gate lập trình cho MVP 2.0.1. Có đúng **61 FR MUST active**. Một slice chỉ đạt Done khi endpoint/event/table/UI/test ở cùng hàng đã được triển khai và evidence được gắn vào requirement ID.

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

## P1 bị khóa khỏi runtime MVP — 10 FR SHOULD

`FR-SEARCH-007`, `FR-BOOK-010`, `FR-PAY-010`, `FR-PROMO-001`, `FR-PROMO-002`, `FR-REVIEW-001`, `FR-REVIEW-002`, `FR-NOTIF-003`, `FR-ADMIN-003`, `FR-REPORT-003`.

Không được tạo route, navigation, consumer binding hoặc table “để sẵn” cho các FR này. Thiết kế P1 vẫn được giữ để lưu quyết định, nhưng chỉ kích hoạt bằng release decision, contract/migration mới và test tương ứng.

## Quy tắc evidence

- Tên test hoặc test trait chứa requirement/AC ID; CI xuất manifest ID đã chạy.
- OpenAPI conformance và event schema test là bắt buộc, không thay thế test nghiệp vụ.
- Các flow tiền/ghế/check-in phải có integration test trên PostgreSQL/RabbitMQ thật và test retry/idempotency.
- UI phải có loading, empty, validation, conflict, forbidden, unavailable và retry state được mô tả trong Screen Contract.
