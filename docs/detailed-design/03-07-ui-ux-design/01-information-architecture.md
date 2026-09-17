# 3.7.1 Information Architecture và Route Map

## Customer Web

```text
Public
├── /                         Home + trip search
├── /trips                   Search results
├── /trips/:tripId           Trip detail + seats entry
├── /auth/register
├── /auth/verify
├── /auth/login
├── /auth/forgot-password
└── /auth/reset-password

Customer protected
├── /checkout/:holdToken/passengers
├── /checkout/:bookingId/payment
├── /payments/:paymentId/result
├── /bookings
├── /bookings/:bookingId
├── /tickets/:ticketId
├── /profile
└── /notifications
```

- `/trips` query string chứa search/filter/sort/page để share/back/refresh được; không chứa PII.
- Checkout route chỉ giữ opaque ID/token; Passenger/contact nằm trong form state, không đưa vào URL/localStorage.
- Direct URL protected phải chạy auth/ownership check từ server; UI guard không thay authorization.

## Back-office Web

```text
/app
├── /dashboard
├── /organizations                  Platform Admin
├── /organizations/:id
├── /users                           Platform Admin
├── /users/:id
├── /memberships                     Platform Admin
├── /fleet/buses                     Operator
├── /fleet/buses/:id
├── /fleet/drivers
├── /fleet/drivers/:id
├── /routes
├── /routes/:id
├── /trips
├── /trips/new
├── /trips/:id
├── /trips/:id/manifest
├── /driver/assignments
├── /driver/trips/:id/check-in
├── /transactions/bookings
├── /transactions/payments
├── /transactions/refunds
├── /reports/revenue
├── /reports/bookings
├── /reports/occupancy
└── /audit
```

Navigation được sinh từ permission catalog; tenant scope lấy từ token/session context. Không cung cấp organization switcher cho Operator tenant. Platform actor có filter scope riêng nếu endpoint cho phép.

Không có route Promotion, Review moderation, SupportCase, Export hoặc automated reconciliation trong MVP.

## Mobile navigator

```text
AuthStack
├── Register / VerifyEmail / Login / ForgotPassword / ResetPassword

MainTabs
├── SearchStack: Search → Results → Trip → Seats → Passengers → (Payment nếu PREPAID) → Ticket/PaymentStatus
├── TripsStack: Bookings → BookingDetail → Ticket
├── Notifications
└── Profile
```

- Access/refresh token lưu secure storage; không lưu AsyncStorage dạng rõ.
- Ticket cache mã hóa/phù hợp secure storage policy và có `lastSyncedAt`.
- Payment deep link chỉ mang state/nonce/reference opaque; app gọi server lấy trạng thái thật.

## Cross-channel terminology

| Domain | Nhãn tiếng Việt baseline |
|---|---|
| Trip | Chuyến xe |
| SeatHold | Giữ ghế |
| Booking | Đơn đặt vé |
| Ticket | Vé điện tử |
| Payment `PAY_LATER` | Trả sau |
| Payment `PROCESSING` | Đang xử lý thanh toán |
| UI aggregate `CONFIRMING` | Đang xác nhận vé |
| Refund `PROCESSING` | Đang hoàn tiền |
| Trip `BOARDING` | Đang đón khách |

Client map theo stable error/state code; không parse message server để quyết định flow.
