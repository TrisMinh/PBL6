# Yêu cầu về miền nghiệp vụ và dữ liệu

## 1. Nguyên tắc dữ liệu Microservices

- Mỗi service sở hữu schema/database và migration riêng.
- ID từ service khác chỉ được lưu như external reference, không tạo foreign key xuyên service.
- Event và API là hợp đồng đồng bộ dữ liệu.
- Dữ liệu đọc chéo được snapshot/project, không join trực tiếp database.
- Entity giao dịch không hard delete.

## 2. Identity Service

| Entity | Trường chính | Ràng buộc |
|---|---|---|
| User | id, fullName, email, phone, passwordHash, status, verifiedAt | email/phone normalized unique khi có giá trị |
| Role | id, code, scope | code unique |
| UserRole | userId, roleId, organizationId | role tenant phải có organizationId |
| OrganizationMembership | userId, organizationId, status | unique active membership theo policy |
| RefreshToken | id, userId, tokenHash, expiresAt, revokedAt | chỉ lưu hash token |
| SecurityAudit | id, actorId, action, targetId, metadata, occurredAt | append-only |

## 3. Transport Service

| Entity | Trường chính | Ràng buộc |
|---|---|---|
| Organization | id, name, legalName, contact, status | tenant root |
| Bus | id, organizationId, licensePlate, type, seatTemplateVersion, status | plate normalized unique; soft delete |
| Seat | id, busId, code, floor, row, column, type, enabled | unique `(busId, code)` |
| DriverProfile | id, userId, organizationId, licenseNo, licenseExpiry, status | active license khi assignment |
| Route | id, organizationId, origin, destination, distanceKm, durationMinutes, status | tenant scoped |
| RouteStop | id, routeId, type, name, address, lat, lng, sequence, offsetMinutes | sequence unique theo route/type |
| Trip | id, organizationId, routeId, busId, departureAt, arrivalAt, fare, status, version | arrival > departure |
| DriverAssignment | id, tripId, driverId, role, startAt, endAt | không overlap |

## 4. Booking Service

| Entity | Trường chính | Ràng buộc |
|---|---|---|
| TripSnapshot | tripId, organizationId, route/stop snapshot, schedule, policyVersion, sellable | cập nhật bằng Transport event |
| TripSeat | id, tripId, sourceSeatId, code, status, basePrice, holdId, bookingId, version | unique `(tripId, sourceSeatId)` và `(tripId, code)` |
| SeatHold | id, tokenHash, customerId, tripId, status, expiresAt, idempotencyKey | một key/customer/operation |
| SeatHoldItem | holdId, tripSeatId, priceSnapshot | unique tripSeat trong active hold |
| Booking | id, code, customerId, tripId, status, subtotal, discount, fee, total, currency, expiresAt | code unique; money exact |
| Passenger | id, bookingId, fullName, phone, identityDocumentEncrypted, pickupStopId, dropoffStopId | một passenger mỗi booking item |
| BookingItem | id, bookingId, passengerId, tripSeatId, unitPrice, discount, total | immutable sau PAID |
| Ticket | id, publicCode, bookingItemId, qrTokenHash, status, checkedInAt | một ticket mỗi booking item |
| Promotion | id, organizationId, code, type, value, quota, startsAt, endsAt, status | code uniqueness theo scope |
| PromotionRedemption | promotionId, bookingId, customerId, amount | chống vượt quota |
| Review | id, ticketId, customerId, rating, content, status | unique ticketId |

`TripSeat` là nguồn sự thật về ghế theo chuyến. `Seat` của Transport chỉ mô tả ghế vật lý/template.

## 5. Payment Service

| Entity | Trường chính | Ràng buộc |
|---|---|---|
| Payment | id, bookingId, amount, currency, status, provider, idempotencyKey | một logical payment có thể có nhiều attempt |
| PaymentAttempt | id, paymentId, providerTransactionId, status, requestRef, startedAt, completedAt | providerTransactionId unique |
| WebhookReceipt | id, provider, externalEventId, payloadHash, verified, processedAt | externalEventId unique |
| Refund | id, paymentId, bookingId, amount, reason, status, idempotencyKey | tổng refund ≤ payment succeeded |
| ReconciliationCase | id, paymentId, type, status, resolution | dành cho callback thiếu/sai/trễ |

## 6. Notification và Reporting

| Service | Entity |
|---|---|
| Notification | Template, Notification, DeliveryAttempt, UserPreference |
| Reporting | RevenueProjection, BookingProjection, OccupancyProjection, ExportJob |

Reporting projection có thể rebuild từ event/history được lưu. Reporting không phải nguồn sự thật để cập nhật Booking hoặc Payment.

## 7. Dữ liệu nhạy cảm

| Dữ liệu | Biện pháp |
|---|---|
| Password | Hash bằng thuật toán password hashing phù hợp; không mã hóa có thể giải ngược |
| Refresh token/OTP | Chỉ lưu hash khi có thể; có expiry và revoke |
| CCCD/giấy phép | Mã hóa at rest, mask khi hiển thị, access audit |
| Email/số điện thoại | Mask trong log và màn hình hỗ trợ khi không cần toàn bộ |
| Payment card | Không lưu PAN/CVV; dùng token/reference của provider |
| QR token | Lưu hash hoặc chữ ký; không nhúng PII dạng rõ |

## 8. Retention baseline

| Dữ liệu | Thời hạn baseline |
|---|---|
| Security/audit log | 12 tháng |
| Application log | 30 ngày online, tối đa 90 ngày archive |
| Idempotency record | Ít nhất 24 giờ; payment/refund theo vòng đời đối soát |
| Webhook receipt | 12 tháng hoặc theo yêu cầu đối soát |
| SeatHold hết hạn | 30 ngày cho debug rồi archive/xóa theo policy |
| Booking/payment/ticket | Theo yêu cầu nghiệp vụ và quy định áp dụng; không tự động xóa khi chưa có policy được duyệt |
