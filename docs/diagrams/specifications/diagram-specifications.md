# Đặc tả đầu vào cho sơ đồ

Tài liệu này quy định nội dung cần đưa vào từng diagram. Diagram phải phản ánh đúng requirement ID, business rule, trạng thái và service ownership đã định nghĩa; không tự thêm entity hoặc luồng không có trong SRS.

Diagram tổng hợp đã được hiện thực tại [Online Bus Ticket Platform — Super Diagram](../bus-ticket-platform-super-diagram.html).

## 1. Thứ tự vẽ từ đơn giản đến phức tạp

| Thứ tự | Diagram | Câu hỏi được trả lời |
|---:|---|---|
| 1 | System Context | Ai và hệ thống ngoài nào tương tác với sản phẩm? |
| 2 | Use Case Overview | Mỗi actor sử dụng chức năng nào? |
| 3 | Activity/Business Process | Nghiệp vụ diễn ra theo thứ tự và quyết định nào? |
| 4 | Robustness | Boundary, control và entity nào tham gia use case? |
| 5 | Sequence | Các thành phần trao đổi message theo thời gian thế nào? |
| 6 | State Machine | Entity thay đổi trạng thái theo sự kiện nào? |
| 7 | Domain/Class Diagram | Khái niệm nghiệp vụ và quan hệ giữa chúng là gì? |
| 8 | ERD theo service | Dữ liệu được lưu thế nào trong từng database? |
| 9 | Microservices Architecture | Trách nhiệm và giao tiếp giữa các service là gì? |
| 10 | Event/Data Flow | Dữ liệu eventual consistency chạy qua hệ thống thế nào? |
| 11 | Deployment Diagram | Các thành phần được triển khai trên hạ tầng nào? |

Không nên bắt đầu bằng ERD hoặc Microservices Diagram khi Use Case và business process chưa ổn định.

## 2. Quy ước chung

- Dùng đúng tên actor: Guest, Customer, Driver, Operator Staff, Admin.
- `Operator Organization` là entity/tổ chức, không phải actor đăng nhập.
- Dùng đúng tên service: API Gateway, Identity, Transport, Booking, Payment, Notification, Reporting.
- Payment Gateway và Notification Provider nằm ngoài system boundary.
- `Seat` là ghế vật lý của Bus; `TripSeat` là ghế có trạng thái trong một Trip.
- `SELECTED` chỉ dùng trên UI; state diagram/server dùng `AVAILABLE`, `HELD`, `BOOKED`, `DISABLED`.
- Đường đồng bộ REST vẽ nét liền; event bất đồng bộ vẽ nét đứt và ghi tên event.
- Không vẽ foreign key xuyên service trong ERD.
- Mỗi diagram có title, scope, legend nếu cần và ghi requirement/use case nguồn.

## 3. DIA-01 — System Context Diagram

### Trung tâm

Một system boundary duy nhất: `Online Bus Ticket Booking Platform`.

### Actor bên trái

- Guest.
- Customer.
- Driver.
- Operator Staff.
- Admin.

### Hệ thống ngoài bên phải

- Payment Gateway.
- Email/Push Provider.

### Client channel

- Web End-user: Guest, Customer.
- Mobile App: Customer.
- Back-office Web: Driver, Operator Staff, Admin.

### Quan hệ cần vẽ

```text
Guest → Web End-user → Platform
Customer → Web End-user/Mobile App → Platform
Driver → Back-office Web → Platform
Operator Staff → Back-office Web → Platform
Admin → Back-office Web → Platform
Platform → Payment Gateway
Platform → Email/Push Provider
```

Không vẽ database, RabbitMQ hoặc service nội bộ trong Context Diagram.

## 4. DIA-02 — Use Case Overview

### System boundary

`Online Bus Ticket Booking System` chứa các use case dưới đây.

### Guest

- Đăng ký.
- Đăng nhập.
- Tìm kiếm chuyến.
- Xem chi tiết chuyến.
- Xem sơ đồ ghế khả dụng.

### Customer

- Quản lý hồ sơ.
- Tìm kiếm/xem chuyến.
- Giữ ghế.
- Tạo booking.
- Thanh toán.
- Xem vé và QR.
- Hủy vé.
- Đổi vé — SHOULD.
- Xem lịch sử.
- Đánh giá chuyến.

### Driver

- Xem chuyến được phân công.
- Xem manifest.
- Check-in hành khách.
- Cập nhật trạng thái chuyến.

### Operator Staff

- Quản lý nhà xe.
- Quản lý xe và sơ đồ ghế.
- Quản lý tài xế.
- Quản lý tuyến và điểm dừng.
- Tạo/publish/cập nhật/hủy chuyến.
- Xem manifest/booking.
- Check-in hỗ trợ.
- Xem báo cáo tenant.

### Admin

- Quản lý Organization.
- Quản lý User, role và membership.
- Tra cứu booking/payment/refund.
- Kiểm duyệt review/khiếu nại.
- Xem audit và báo cáo nền tảng.

### Secondary actor

- Payment Gateway liên kết với `Thanh toán` và `Hoàn tiền`.
- Notification Provider liên kết với `Gửi thông báo`.

### Quan hệ include/extend khuyến nghị

```text
Tạo booking <<include>> Giữ ghế
Tạo booking <<include>> Nhập thông tin hành khách
Tạo booking <<include>> Tính tổng tiền
Thanh toán <<include>> Xác minh kết quả thanh toán
Thanh toán thành công <<include>> Phát hành vé
Hủy vé <<include>> Xem trước phí và tiền hoàn
Hủy vé <<extend>> Hoàn tiền            [khi booking đã trả tiền]
Đổi vé <<include>> Giữ ghế mới
Đổi vé <<extend>> Thanh toán chênh lệch [khi giá mới cao hơn]
Hủy chuyến <<include>> Xử lý vé bị ảnh hưởng
Hủy chuyến <<include>> Gửi thông báo
```

Đăng nhập là precondition cho nghiệp vụ Customer, không cần nối `<<include>> Đăng nhập` vào mọi use case để tránh sơ đồ rối.

## 5. DIA-03 — Activity Diagram: Đặt vé

### Swimlane

- Customer.
- Web/Mobile Client.
- Booking Platform.
- Payment Gateway.

### Activity và decision theo thứ tự

```text
Start
→ Nhập tiêu chí tìm kiếm
→ Tìm Trip
→ [Có kết quả?]
   No → Hiển thị không có chuyến → End
   Yes → Chọn Trip
→ Xem TripSeat
→ Chọn ghế
→ Yêu cầu SeatHold
→ [Tất cả ghế còn trống?]
   No → Thông báo ghế không khả dụng → Chọn lại
   Yes → Tạo SeatHold + hiển thị countdown
→ Nhập Passenger
→ Tạo Booking
→ [Hold còn hạn?]
   No → Booking không được tạo/expired → Chọn lại ghế
   Yes → Hiển thị tổng tiền
→ Chọn phương thức thanh toán
→ Payment Gateway xử lý
→ [Payment hợp lệ?]
   No → Hiển thị failed/processing theo kết quả
   Yes → Booking PAID + TripSeat BOOKED + Ticket ISSUED
→ Hiển thị/Gửi Ticket
→ End
```

Không gom “thanh toán” thành một bước duy nhất; phải có decision giữa redirect client và webhook xác nhận server.

## 6. DIA-04 — Robustness Diagram

### 6.1. Quy ước BCE

- `<<boundary>>`: màn hình, API endpoint, webhook endpoint.
- `<<control>>`: điều phối use case/rule.
- `<<entity>>`: entity nghiệp vụ hoặc repository abstraction.
- Actor chỉ nối với boundary.
- Boundary nối control; control truy cập entity/control khác.
- Không cho actor nối trực tiếp entity.

### 6.2. Robustness — Đặt vé

#### Boundary

- SearchPage.
- TripDetailPage.
- SeatSelectionPage.
- PassengerForm.
- CheckoutPage.
- BookingAPI.
- PaymentRedirectPage.
- PaymentWebhookEndpoint.

#### Control

- SearchTripController.
- SeatHoldController.
- BookingController.
- PricingController.
- PaymentController.
- TicketIssuanceController.

#### Entity

- TripSnapshot.
- TripSeat.
- SeatHold.
- Booking.
- BookingItem.
- Passenger.
- Payment.
- Ticket.

#### Liên kết chính

```text
Customer → SearchPage → SearchTripController → TripSnapshot
Customer → SeatSelectionPage → SeatHoldController → TripSeat/SeatHold
Customer → PassengerForm → BookingController → Passenger/BookingItem
BookingController → PricingController → Booking
Customer → CheckoutPage → PaymentController → Payment
PaymentGateway → PaymentWebhookEndpoint → PaymentController → Payment
PaymentController → TicketIssuanceController → Booking/TripSeat/Ticket
```

### 6.3. Robustness tối thiểu khác

| Use Case | Boundary chính | Control chính | Entity chính |
|---|---|---|---|
| Đăng nhập | LoginPage, AuthAPI | AuthenticationController, TokenController | User, RefreshToken, SecurityAudit |
| Hủy vé | TicketDetailPage, CancellationAPI | CancellationPolicyController, RefundController | Ticket, Booking, Payment, Refund |
| Tạo chuyến | TripEditorPage, OperatorTripAPI | TripValidationController, PublishTripController | Trip, Route, Bus, DriverAssignment |
| Check-in | ManifestPage, QRScanner, CheckInAPI | TicketValidationController | Ticket, TripSnapshot, CheckInAudit |
| Hủy chuyến | TripOperationPage, TripAPI | TripCancellationController | Trip, Booking projection, Refund |

## 7. DIA-05 — Sequence Diagram: Giữ ghế và tạo Booking

### Lifeline

```text
Customer
Web/Mobile Client
API Gateway
Booking Service
Booking Database
Redis (optional TTL/cache)
```

### Message chuẩn

```text
Customer → Client: chọn seatIds
Client → Gateway: POST /trips/{id}/seat-holds + Idempotency-Key
Gateway → Booking Service: createSeatHold(command, identity)
Booking Service → Booking DB: BEGIN + lock TripSeat rows
Booking Service → Booking DB: validate AVAILABLE and trip sellable
alt all seats available
    Booking Service → Booking DB: insert SeatHold + items; update TripSeat=HELD; COMMIT
    Booking Service → Redis: set expiry helper (optional)
    Booking Service → Client: holdToken, expiresAt, price snapshot
else any seat unavailable
    Booking Service → Booking DB: ROLLBACK
    Booking Service → Client: 409 SEAT_UNAVAILABLE
end
Customer → Client: nhập passenger và xác nhận
Client → Gateway: POST /bookings + holdToken + Idempotency-Key
Gateway → Booking Service: createBooking(command)
Booking Service → Booking DB: validate ACTIVE hold and passenger count
Booking Service → Booking DB: calculate price; insert Booking/Items; SeatHold=CONSUMED
Booking Service → Client: Booking PENDING_PAYMENT
```

Phải thể hiện transaction và `alt`, vì đây là điểm chứng minh chống double-booking.

## 8. DIA-06 — Sequence Diagram: Thanh toán thành công

### Lifeline

```text
Customer
Client
API Gateway
Payment Service
Payment Database
Payment Gateway
RabbitMQ
Booking Service
Booking Database
Notification Service
```

### Message chuẩn

```text
Client → Gateway → Payment Service: createPayment(bookingId, Idempotency-Key)
Payment Service → Payment DB: insert Payment PENDING
Payment Service → Payment Gateway: create payment request
Payment Gateway → Client: payment UI/redirect
Payment Gateway → Payment Service: signed webhook
Payment Service → Payment Service: verify signature, amount, currency, transactionId
Payment Service → Payment DB: Payment=SUCCEEDED + Outbox(PaymentSucceeded) [same transaction]
Payment Service → Payment Gateway: 2xx acknowledgement
Payment Service → RabbitMQ: PaymentSucceeded
RabbitMQ → Booking Service: PaymentSucceeded
Booking Service → Booking DB: inbox dedupe + validate booking/hold
Booking Service → Booking DB: Booking=PAID, TripSeat=BOOKED, create Ticket + outbox
Booking Service → RabbitMQ: BookingPaid, TicketIssued
RabbitMQ → Notification Service: TicketIssued
Notification Service → Customer: email/in-app confirmation
Client → Gateway: GET booking/payment status
Gateway → Client: PAID + tickets
```

### Fragment bắt buộc

- `alt invalid signature/amount`: không phát PaymentSucceeded.
- `alt duplicate webhook`: trả 2xx, không xử lý lần hai.
- `alt hold expired/seat unavailable`: phát compensation request, không tạo Ticket.

## 9. DIA-07 — Sequence Diagram: Hủy vé và Refund

### Lifeline

Customer, Client, API Gateway, Booking Service, Booking Database, RabbitMQ, Payment Service, Payment Gateway, Notification Service.

### Message chuẩn

```text
Customer → Client → Booking Service: cancellation preview
Booking Service → Booking DB: load Ticket/Booking/policy snapshot
Booking Service → Client: fee + refund amount + eligibility
Customer → Client → Booking Service: confirm cancel + Idempotency-Key
Booking Service → Booking DB: cancel Ticket; release TripSeat if sellable; outbox RefundRequested
Booking Service → RabbitMQ: RefundRequested
RabbitMQ → Payment Service: RefundRequested
Payment Service → Payment Gateway: refund(transaction, amount)
Payment Gateway → Payment Service: refund result/webhook
Payment Service → Payment DB: Refund=SUCCEEDED/FAILED + outbox
Payment Service → RabbitMQ: RefundSucceeded/RefundFailed
RabbitMQ → Booking Service: update aggregate status
RabbitMQ → Notification Service: notify Customer
```

`alt cancellation not allowed` phải kết thúc trước khi thay đổi Ticket. `alt refund failed` giữ Ticket đã hủy và mở retry/manual case.

## 10. DIA-08 — Sequence Diagram: Publish và hủy Trip

### Publish Trip

```text
Operator → Back-office → Transport Service: publishTrip
Transport Service → Transport DB: validate route/bus/driver/schedule/policy
Transport Service → Transport DB: Trip=SCHEDULED + Outbox(TripPublished)
Transport Service → RabbitMQ: TripPublished
RabbitMQ → Booking Service: create TripSnapshot + TripSeat
Booking Service → RabbitMQ: TripInventoryReady
Transport/Search → mark Trip sellable
```

### Hủy Trip

```text
Operator → Transport Service: cancelTrip(reason)
Transport Service → Transport DB: Trip=CANCELLED + Outbox(TripCancelled)
Transport Service → RabbitMQ: TripCancelled
RabbitMQ → Booking Service: cancel affected tickets/bookings
Booking Service → RabbitMQ: RefundRequested + BookingCancelled
RabbitMQ → Payment Service: process refunds
RabbitMQ → Notification Service: notify affected customers
RabbitMQ → Reporting Service: update projections
```

## 11. DIA-09 — State Machine Diagrams

Không gộp tất cả entity vào một hình. Vẽ các hình riêng:

1. `TripSeat + SeatHold` — quan trọng nhất cho concurrency.
2. `Booking + Payment` — thể hiện eventual consistency.
3. `Ticket + Refund`.
4. `Trip`.

Nguồn chuyển trạng thái chính thức: [Yêu cầu về trạng thái nghiệp vụ](../../srs/requirements/state-requirements.md). Mỗi mũi tên phải có dạng:

```text
event [guard] / action
```

Ví dụ:

```text
PaymentSucceeded [hold valid] / confirm seats and issue tickets
HoldExpired [not paid] / release seats
TripCancelled [ticket paid] / cancel ticket and request refund
```

## 12. DIA-10 — Domain/Class Diagram

### Package

- Identity.
- Transport.
- Booking.
- Payment.
- Notification/Reporting chỉ cần class chính nếu diagram không quá tải.

### Class và quan hệ bắt buộc

```text
User "1" -- "0..*" UserRole
Role "1" -- "0..*" UserRole
Organization "1" -- "0..*" OrganizationMembership
User "1" -- "0..*" OrganizationMembership

Organization "1" -- "0..*" Bus
Bus "1" *-- "1..*" Seat
Organization "1" -- "0..*" DriverProfile
Route "1" *-- "2..*" RouteStop
Organization "1" -- "0..*" Trip
Trip "1" -- "1" Bus
Trip "1" -- "1" Route
Trip "1" -- "1..*" DriverAssignment
DriverProfile "1" -- "0..*" DriverAssignment

TripSnapshot "1" *-- "1..*" TripSeat
SeatHold "1" *-- "1..*" SeatHoldItem
SeatHoldItem "*" -- "1" TripSeat
Customer(User) "1" -- "0..*" Booking
Booking "1" *-- "1..*" BookingItem
Booking "1" *-- "1..*" Passenger
BookingItem "1" -- "1" Passenger
BookingItem "1" -- "1" TripSeat
BookingItem "1" -- "0..1" Ticket
Ticket "1" -- "0..1" Review

Booking "1" -- "0..*" Payment
Payment "1" *-- "1..*" PaymentAttempt
Payment "1" -- "0..*" Refund
```

### Method nghiệp vụ nên thể hiện

```text
SeatHold.isExpired(now)
Booking.calculateTotal()
Booking.confirmPayment(paymentRef)
Booking.expire()
Ticket.checkIn(actor, tripId)
Trip.publish()
Trip.cancel(reason)
Payment.markSucceeded(providerTransactionId)
Refund.markSucceeded()
```

Không biến class diagram thành bản sao database; chỉ giữ thuộc tính/method mang ý nghĩa nghiệp vụ.

## 13. DIA-11 — ERD theo Service

Vẽ riêng từng database để thể hiện đúng Microservices.

### Identity ERD

```text
users 1—N user_roles N—1 roles
users 1—N organization_memberships N—1 organizations
users 1—N refresh_tokens
users 1—N security_audits (actor reference)
```

### Transport ERD

```text
organizations 1—N buses 1—N seats
organizations 1—N driver_profiles
organizations 1—N routes 1—N route_stops
organizations 1—N trips
routes 1—N trips
buses 1—N trips
trips 1—N driver_assignments N—1 driver_profiles
```

### Booking ERD

```text
trip_snapshots 1—N trip_seats
seat_holds 1—N seat_hold_items N—1 trip_seats
bookings 1—N booking_items
bookings 1—N passengers
booking_items 1—1 passengers
booking_items N—1 trip_seats
booking_items 1—0..1 tickets
promotions 1—N promotion_redemptions N—1 bookings
tickets 1—0..1 reviews
```

### Payment ERD

```text
payments 1—N payment_attempts
payments 1—N refunds
payments 1—N reconciliation_cases
webhook_receipts references provider event; no duplicate externalEventId
```

ID từ service khác như `bookingId`, `customerId`, `organizationId` là external reference, không vẽ foreign key xuyên database.

## 14. DIA-12 — Microservices Architecture Diagram

### Node

- Web End-user, Mobile App, Back-office Web.
- API Gateway.
- Identity Service.
- Transport Service.
- Booking Service.
- Payment Service.
- Notification Service.
- Reporting Service.
- RabbitMQ.
- Redis.
- Database riêng của từng service.
- Payment Gateway, Email/Push Provider.

### Kết nối đồng bộ

```text
Clients → API Gateway
Gateway → Identity/Transport/Booking/Payment/Reporting
Booking Service → Redis
Payment Service → Payment Gateway
Notification Service → Email/Push Provider
```

### Kết nối bất đồng bộ

```text
Transport ↔ RabbitMQ
Booking ↔ RabbitMQ
Payment ↔ RabbitMQ
Notification ← RabbitMQ
Reporting ← RabbitMQ
Identity → RabbitMQ
```

Mỗi service nối duy nhất đến database của nó. Không vẽ Gateway truy cập database hoặc chứa business logic.

## 15. DIA-13 — Event/Data Flow Diagram

### Luồng Trip

```text
Transport: TripPublished
→ Booking: create TripSnapshot/TripSeat
→ Reporting: create Trip/occupancy projection
```

### Luồng Payment

```text
Payment: PaymentSucceeded
→ Booking: confirm Booking, book seats, issue Ticket
→ Booking: BookingPaid + TicketIssued
→ Notification: send confirmation
→ Reporting: update revenue/booking projection
```

### Luồng hủy

```text
Transport/Booking: TripCancelled or BookingCancelled
→ Payment: process RefundRequested
→ Payment: RefundSucceeded/Failed
→ Booking: update Ticket/Booking aggregate
→ Notification: inform Customer
→ Reporting: update net revenue/refund projection
```

Ghi rõ eventual consistency và DLQ/retry, nhưng không vẽ chi tiết HTTP endpoint trong hình này.

## 16. DIA-14 — Deployment Diagram

### Local/demo deployment

```text
User Device
  ├── Browser
  └── Mobile App
        ↓ HTTPS
Reverse Proxy / API Gateway container
        ↓ internal Docker network
Service containers
  ├── identity-service → identity_db
  ├── transport-service → transport_db
  ├── booking-service → booking_db + Redis
  ├── payment-service → payment_db
  ├── notification-service → notification_db
  └── reporting-service → reporting_db

Shared infrastructure containers
  ├── PostgreSQL server (separate DB/schema and credentials)
  ├── RabbitMQ
  ├── Redis
  └── Observability stack

External
  ├── Payment Gateway
  └── Email/Push Provider
```

Vẽ port/network boundary chỉ khi đã chốt công nghệ; không đưa credential vào diagram.

## 17. Ma trận nguồn diagram

| Diagram | Nguồn chính |
|---|---|
| Context | Product Overview, System Scope and Context, Actors and Permissions |
| Use Case | Actors and Permissions, Functional Requirements, Use Cases |
| Activity | Business Processes, Business Rules |
| Robustness | Use Cases, Data Requirements, User Interface Requirements |
| Sequence | Use Cases, Service Architecture Constraints, Service Interfaces, Exceptions and Recovery |
| State Machine | State Requirements |
| Class Diagram | Business Rules, Data Requirements |
| ERD | Data Requirements |
| Microservices Architecture | Service Architecture Constraints, Service Interfaces |
| Event/Data Flow | Service Architecture Constraints, Service Interfaces, Exceptions and Recovery |
| Deployment | Service Architecture Constraints, Quality Requirements |

## 18. Checklist trước khi chốt diagram

- Tên actor/service/entity khớp SRS.
- Mọi quan hệ có lý do nghiệp vụ, không nối trang trí.
- Use Case không chứa chi tiết database/API.
- Robustness tuân thủ Actor → Boundary → Control → Entity.
- Sequence có `alt/opt` cho lỗi quan trọng và thể hiện sync/async.
- Class Diagram dùng composition/association/cardinality đúng.
- ERD không có foreign key xuyên service.
- State Diagram không tạo trạng thái ngoài danh mục chuẩn.
- Architecture Diagram thể hiện database ownership và message broker.
- Mỗi diagram có nguồn requirement/use case để truy vết.
