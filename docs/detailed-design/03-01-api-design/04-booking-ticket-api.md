# 3.1.4 Booking, Ticket, Promotion, Review & Support API

Owner: Booking Service. Nguồn: `UC-BOOK-*`, `UC-TICKET-01`, `UC-CANCEL-01`, `UC-CHANGE-01`, `UC-DRIVER-01`, `UC-PROMO-01`, `UC-REVIEW-*`, `UC-ADMIN-03`.

MVP active: SeatHold, Booking, Ticket, cancellation và check-in. Ticket change, Promotion, Review và SupportCase là P1 vì requirement tương ứng là `SHOULD`; các route này không được đăng ký trong runtime MVP.

## Seat availability và SeatHold

| Operation ID | Method/path | Auth | Idempotency | Success/errors |
|---|---|---|---|---|
| `getTripSeats` | `GET /api/v1/trips/{tripId}/seats` | Customer | No | `200`; `TRIP_NOT_SELLABLE` |
| `createSeatHold` | `POST /api/v1/trips/{tripId}/seat-holds` | Customer | Required | `201`; `SEAT_UNAVAILABLE`, `TRIP_NOT_SELLABLE` |
| `getSeatHold` | `GET /api/v1/seat-holds/{holdToken}` | Owner | No | `200`; `RESOURCE_NOT_FOUND`, `SEAT_HOLD_EXPIRED` |
| `releaseSeatHold` | `DELETE /api/v1/seat-holds/{holdToken}` | Owner | Required | `204`; expired/released vẫn idempotent |

```json
{
  "seatIds": ["trip-seat-1", "trip-seat-2"],
  "pickupStopId": "stop-1",
  "dropoffStopId": "stop-4"
}
```

Response trả opaque `holdToken`, seat code/price, `currency`, `expiresAt` và `serverTime`. Không trả token hash/DB ID nội bộ không cần thiết.

## Booking và ownership queries

| Operation ID | Method/path | Permission | Idempotency |
|---|---|---|---|
| `createBooking` | `POST /api/v1/bookings` | Customer | Required |
| `listMyBookings` | `GET /api/v1/bookings` | Customer owner | No |
| `getMyBooking` | `GET /api/v1/bookings/{bookingId}` | Customer owner | No |
| `getTripManifest` | `GET /api/v1/operator/trips/{tripId}/manifest` | `tenant.manifest.read` + assigned/tenant Trip, hoặc `platform.support.read` có reason | No |
| `searchBookingsForSupport` | `GET /api/v1/admin/bookings` | `tenant.booking.read` hoặc `platform.support.read`, luôn filter theo scope | No |

Create body MVP gồm `holdToken`, Booking contact, đúng một Passenger trên mỗi `seatId` và pickup/dropoff. Client có thể gửi expected price để cảnh báo thay đổi nhưng server tự tính subtotal/discount/fee/total. `promotionCode` chưa được nhận trong MVP.

```json
{
  "holdToken": "opaque-hold-token",
  "contact": {
    "fullName": "Nguyễn Văn A",
    "email": "a@example.com",
    "phone": "+84901234567"
  },
  "passengers": [
    {
      "seatId": "trip-seat-1",
      "fullName": "Nguyễn Văn A",
      "documentType": null,
      "documentNumber": null,
      "pickupStopId": "stop-1",
      "dropoffStopId": "stop-4"
    }
  ],
  "expectedTotal": 150000,
  "currency": "VND"
}
```

`documentType/documentNumber` chỉ trở thành required khi Trip policy snapshot yêu cầu. Mỗi Passenger phải ánh xạ đúng một seat trong hold; thiếu/thừa/trùng seat làm toàn request thất bại.

## Cancellation và change

Cancellation là MVP. Các operation `previewTicketChange/changeTicket` được giữ làm thiết kế P1 và không map route trong MVP.

| Operation ID | Method/path | Idempotency | Success |
|---|---|---|---:|
| `previewCancellation` | `POST /api/v1/bookings/{bookingId}/cancellation-preview` | Recommended | `200` |
| `cancelBookingItems` | `POST /api/v1/bookings/{bookingId}/cancel` | Required | `202` |
| `previewTicketChange` | `POST /api/v1/tickets/{ticketId}/change-preview` | Recommended | `200` |
| `changeTicket` | `POST /api/v1/tickets/{ticketId}/change` | Required | `202/200` |

Preview response bắt buộc có `previewId`, `policyVersion`, item IDs, fee/refund/fare difference, currency và `expiresAt`. Confirm gửi `previewId`, `expectedVersion`; preview hết hạn hoặc thay đổi trả `PREVIEW_STALE`, không tự chấp nhận giá mới.

Change request gửi hold token mới. Nếu phải thu thêm tiền, response `202` trả payment action; Ticket cũ chỉ bị hủy tại commit point sau khi tài chính thành công.

## Ticket và check-in

| Operation ID | Method/path | Permission | Semantics |
|---|---|---|---|
| `listMyTickets` | `GET /api/v1/tickets` | Customer owner | Filter upcoming/used/cancelled/refunded |
| `getMyTicket` | `GET /api/v1/tickets/{ticketId}` | Customer owner | QR/public code chỉ khi policy cho phép |
| `validateTicket` | `POST /api/v1/tickets/validate` | `tenant.ticket.validate` + assigned/tenant Trip | Read-only validation, không check-in |
| `checkInTicket` | `POST /api/v1/tickets/{ticketId}/check-in` | `tenant.ticket.checkin` + assigned/tenant Trip | Idempotency required; `ISSUED→CHECKED_IN` |

Check-in body có `tripId`, `scannedToken/publicCode`, `expectedVersion`. Scan lặp trả `TICKET_ALREADY_CHECKED_IN` kèm `checkedInAt` an toàn và không tạo audit transition thứ hai.

## Promotion và Review

Toàn bộ section này là P1; route không được đăng ký trong MVP.

| Operation ID | Method/path | Permission |
|---|---|---|
| `listPromotions` | `GET /api/v1/operator/promotions` | `tenant.promotion.read` |
| `createPromotion` | `POST /api/v1/operator/promotions` | `tenant.promotion.manage` |
| `updatePromotion` | `PATCH /api/v1/operator/promotions/{promotionId}` | `tenant.promotion.manage` |
| `deactivatePromotion` | `POST /api/v1/operator/promotions/{promotionId}/deactivate` | `tenant.promotion.manage` |
| `createReview` | `POST /api/v1/reviews` | Customer owns USED Ticket |
| `updateReview` | `PATCH /api/v1/reviews/{reviewId}` | Customer owner within edit window |
| `listTripReviews` | `GET /api/v1/trips/{tripId}/reviews` | Public |
| `moderateReview` | `POST /api/v1/admin/reviews/{reviewId}/moderation` | `tenant.review.moderate` hoặc `platform.review.moderate` + scope |

Promotion quota và redemption được bảo vệ bằng database transaction; cùng Booking không redeem hai lần. Moderation bắt buộc `action`, `reason`, `expectedVersion` và audit; ẩn không xóa lịch sử.

## Support case

Toàn bộ section này là P1; route không được đăng ký trong MVP. Manual payment/cancellation issue của MVP được lưu dưới `ReconciliationCase` ở Payment và audit/operator runbook, không mở SupportCase API.

`UC-ADMIN-03` được đặt trong Booking Service ở baseline vì liên kết chủ yếu Booking/Ticket/Payment external reference, chưa đủ lý do tạo service thứ bảy.

| Operation ID | Method/path | Permission |
|---|---|---|
| `createSupportCase` | `POST /api/v1/admin/support/cases` | `tenant.support.manage` hoặc `platform.support.manage` + scope |
| `listSupportCases` | `GET /api/v1/admin/support/cases` | `tenant.support.read` hoặc `platform.support.read` + scope |
| `getSupportCase` | `GET /api/v1/admin/support/cases/{caseId}` | `tenant.support.read` hoặc `platform.support.read` + scope |
| `updateSupportCase` | `PATCH /api/v1/admin/support/cases/{caseId}` | `tenant.support.manage` hoặc `platform.support.manage` + scope |

Case được nhân sự có quyền tạo từ kênh hợp lệ; baseline không mở Customer/Guest API trực tiếp. State baseline: `OPEN → IN_PROGRESS → RESOLVED → CLOSED`, cho phép `RESOLVED → IN_PROGRESS` khi reopen. Đóng case bắt buộc resolution; mọi đổi assignee/state có audit.
