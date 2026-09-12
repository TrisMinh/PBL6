# Giao diện dịch vụ: API và sự kiện

## 1. Quy ước API chung

| Hạng mục | Quy ước |
|---|---|
| Protocol | HTTPS |
| Format | JSON UTF-8 |
| Public base path | `/api/v1` |
| Authentication | `Authorization: Bearer <access-token>` hoặc cơ chế cookie bảo mật được duyệt |
| Correlation | `X-Correlation-ID`; Gateway tạo nếu client không gửi |
| Idempotency | `Idempotency-Key` bắt buộc cho hold, booking, payment, cancel và refund command |
| Time | ISO-8601 có timezone; server lưu UTC |
| Pagination | `page`, `size`, tối đa 100; hoặc cursor cho dữ liệu lớn |
| Version client | `X-Client-Version` cho Mobile/Web khi cần kiểm soát tương thích |

Service phải trả status code đúng ngữ nghĩa; không trả HTTP 200 cho lỗi nghiệp vụ.

## 2. Error envelope

```json
{
  "error": {
    "code": "SEAT_UNAVAILABLE",
    "message": "Một hoặc nhiều ghế không còn khả dụng.",
    "details": {
      "seatCodes": ["A1"]
    },
    "correlationId": "01J..."
  }
}
```

Quy tắc:

- `message` an toàn để hiển thị; không chứa stack trace hoặc dữ liệu bí mật.
- Client xử lý theo `code`, không parse text.
- Validation error có danh sách field và reason.
- Cùng lỗi phải có cùng code trên Web và Mobile.

## 3. API Gateway routing

| Public route | Service |
|---|---|
| `/api/v1/auth/**`, `/api/v1/users/**`, `/api/v1/admin/organizations/**` | Identity |
| `/api/v1/trips/**`, `/api/v1/routes/**`, `/api/v1/operator/**`, `/api/v1/driver/assignments/**` | Transport |
| `/api/v1/seat-holds/**`, `/api/v1/bookings/**`, `/api/v1/tickets/**`, `/api/v1/reviews/**` | Booking |
| `/api/v1/payments/**`, `/api/v1/refunds/**` | Payment |
| `/api/v1/notifications/**` | Notification |
| `/api/v1/reports/**`, `/api/v1/exports/**` | Reporting |

Webhook provider có route riêng, giới hạn nguồn/rate và không dùng auth token người dùng:

```text
POST /integrations/payments/{provider}/webhooks
```

## 4. Identity API

```text
POST   /api/v1/auth/register
POST   /api/v1/auth/verify
POST   /api/v1/auth/resend-verification
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password
GET    /api/v1/users/me
PATCH  /api/v1/users/me

GET    /api/v1/admin/users
GET    /api/v1/admin/users/{userId}
PATCH  /api/v1/admin/users/{userId}/status
PUT    /api/v1/admin/users/{userId}/roles
POST   /api/v1/admin/organizations
POST   /api/v1/admin/organizations/{organizationId}/members
```

Login/reset phải rate-limit và trả thông báo không làm lộ tài khoản có tồn tại hay không.

## 5. Transport API

### Public/customer

```text
GET /api/v1/trips
GET /api/v1/trips/{tripId}
GET /api/v1/trips/{tripId}/stops
```

Search parameters tối thiểu:

```text
originId, destinationId, departureDate, passengerCount,
operatorId, busType, minPrice, maxPrice, departureFrom,
departureTo, pickupStopId, dropoffStopId, sort, page, size
```

### Operator

```text
GET    /api/v1/operator/buses
POST   /api/v1/operator/buses
PATCH  /api/v1/operator/buses/{busId}
POST   /api/v1/operator/buses/{busId}/deactivate

GET    /api/v1/operator/drivers
POST   /api/v1/operator/drivers
PATCH  /api/v1/operator/drivers/{driverId}

GET    /api/v1/operator/routes
POST   /api/v1/operator/routes
PATCH  /api/v1/operator/routes/{routeId}

GET    /api/v1/operator/trips
POST   /api/v1/operator/trips
PATCH  /api/v1/operator/trips/{tripId}
POST   /api/v1/operator/trips/{tripId}/publish
POST   /api/v1/operator/trips/{tripId}/cancel
POST   /api/v1/operator/trips/{tripId}/status-transitions
```

Không dùng `DELETE` cho Trip/Bus/Driver đã được tham chiếu.

## 6. Booking và Ticket API

```text
GET    /api/v1/trips/{tripId}/seats
POST   /api/v1/trips/{tripId}/seat-holds
GET    /api/v1/seat-holds/{holdToken}
DELETE /api/v1/seat-holds/{holdToken}

POST   /api/v1/bookings
GET    /api/v1/bookings
GET    /api/v1/bookings/{bookingId}
POST   /api/v1/bookings/{bookingId}/cancellation-preview
POST   /api/v1/bookings/{bookingId}/cancel
POST   /api/v1/tickets/{ticketId}/change-preview
POST   /api/v1/tickets/{ticketId}/change

GET    /api/v1/tickets
GET    /api/v1/tickets/{ticketId}
POST   /api/v1/tickets/validate
POST   /api/v1/tickets/{ticketId}/check-in

POST   /api/v1/reviews
PATCH  /api/v1/reviews/{reviewId}
GET    /api/v1/trips/{tripId}/reviews
```

Ví dụ hold request:

```json
{
  "seatIds": ["trip-seat-1", "trip-seat-2"],
  "pickupStopId": "stop-1",
  "dropoffStopId": "stop-4"
}
```

Ví dụ hold response:

```json
{
  "holdToken": "opaque-token",
  "tripId": "trip-1",
  "seats": [
    {"id": "trip-seat-1", "code": "A1", "price": 150000},
    {"id": "trip-seat-2", "code": "A2", "price": 150000}
  ],
  "currency": "VND",
  "expiresAt": "2026-08-19T03:10:00Z"
}
```

## 7. Payment API

```text
POST /api/v1/bookings/{bookingId}/payments
GET  /api/v1/payments/{paymentId}
GET  /api/v1/bookings/{bookingId}/payments
POST /api/v1/payments/{paymentId}/cancel

POST /api/v1/refunds
GET  /api/v1/refunds/{refundId}
GET  /api/v1/admin/payments
GET  /api/v1/admin/refunds
```

Payment create request không nhận `amount` làm nguồn sự thật. Payment Service phải dùng payment snapshot được Booking Service cung cấp/xác nhận.

## 8. Notification và Reporting API

```text
GET   /api/v1/notifications
PATCH /api/v1/notifications/{notificationId}/read
GET   /api/v1/notification-preferences
PUT   /api/v1/notification-preferences

GET  /api/v1/reports/revenue
GET  /api/v1/reports/bookings
GET  /api/v1/reports/occupancy
POST /api/v1/exports
GET  /api/v1/exports/{exportId}
```

## 9. Event envelope

```json
{
  "eventId": "01J...",
  "eventType": "PaymentSucceeded",
  "version": 1,
  "occurredAt": "2026-08-19T03:05:42Z",
  "producer": "payment-service",
  "correlationId": "01J...",
  "causationId": "01J...",
  "payload": {}
}
```

## 10. Event catalog

| Event | Producer | Consumer chính | Payload tối thiểu |
|---|---|---|---|
| UserRegistered | Identity | Notification, Reporting | userId, verification channel |
| TripPublished | Transport | Booking, Reporting | tripId, organizationId, schedule, seat/fare/policy snapshot |
| TripUpdated | Transport | Booking, Notification, Reporting | tripId, changedFields, version |
| TripCancelled | Transport | Booking, Notification, Reporting | tripId, reason, cancelledAt |
| SeatHoldCreated | Booking | Reporting | holdId, tripId, seatCount, expiresAt |
| SeatHoldExpired | Booking | Reporting | holdId, tripId, seatCount |
| BookingCreated | Booking | Payment, Reporting | bookingId, customerId, total, currency, expiresAt |
| PaymentSucceeded | Payment | Booking, Reporting | paymentId, bookingId, amount, currency, providerTransactionId |
| PaymentFailed | Payment | Booking, Notification, Reporting | paymentId, bookingId, reasonCode |
| BookingPaid | Booking | Notification, Reporting | bookingId, customerId, tripId, total |
| TicketIssued | Booking | Notification, Reporting | ticketId, bookingId, customerId |
| BookingCancelled | Booking | Payment, Notification, Reporting | bookingId, ticketIds, refundAmount |
| RefundRequested | Booking/Admin | Payment | refundId/reference, paymentId, amount, reason |
| RefundSucceeded | Payment | Booking, Notification, Reporting | refundId, bookingId, amount |
| PassengerCheckedIn | Booking | Reporting | ticketId, tripId, checkedInAt |

## 11. Contract compatibility

- Producer chỉ thêm field optional trong cùng event version.
- Xóa/đổi nghĩa field bắt buộc phải tăng version.
- Consumer phải bỏ qua field chưa biết.
- OpenAPI/event schema được kiểm tra trong CI.
- Contract test tối thiểu tồn tại giữa Booking–Payment và Transport–Booking.
