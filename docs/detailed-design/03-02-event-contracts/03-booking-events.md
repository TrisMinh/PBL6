# 3.2.3 Booking, SeatHold và Ticket Events

## SRS baseline events

| Event v1 | Routing key | Required payload |
|---|---|---|
| `SeatHoldCreated` | `booking.seat-hold.created.v1` | `holdId`, `tripId`, `organizationId`, `seatCount`, `expiresAt` |
| `SeatHoldExpired` | `booking.seat-hold.expired.v1` | `holdId`, `tripId`, `organizationId`, `seatCount`, `expiredAt` |
| `BookingCreated` | `booking.booking.created.v1` | `bookingId`, `customerId`, `tripId`, `organizationId`, `total`, `currency`, `paymentExpiresAt` |
| `BookingPaid` | `booking.booking.paid.v1` | `bookingId`, `customerId`, `tripId`, `organizationId`, `paymentId`, `total`, `currency`, `paidAt` |
| `TicketIssued` | `booking.ticket.issued.v1` | `ticketId`, `bookingId`, `customerId`, `tripId`, `organizationId`, `issuedAt` |
| `BookingCancelled` | `booking.booking.cancelled.v1` | `bookingId`, `customerId`, `tripId`, `organizationId`, `ticketIds[]`, `refundAmount`, `currency`, `reasonCode`, `cancelledAt` |
| `PassengerCheckedIn` | `booking.ticket.checked-in.v1` | `ticketId`, `tripId`, `organizationId`, `checkedInAt`, `checkedInByType` |

Money là integer 64-bit theo đơn vị nhỏ nhất; không gửi float. Event Notification không chứa QR token hoặc passenger document.

## Design events

| Event v1 | Routing key | Consumer | Required payload |
|---|---|---|---|
| `TripInventoryReady` | `booking.trip-inventory.ready.v1` | Transport | `tripId`, `organizationId`, `sourceTripVersion`, `tripSeatCount`, `preparedAt` |
| `TicketCancelled` | `booking.ticket.cancelled.v1` | Notification, Reporting | `ticketId`, `bookingId`, `tripId`, `organizationId`, `reasonCode`, `refundExpected`, `cancelledAt` |
| `TicketChanged` | `booking.ticket.changed.v1` | Notification, Reporting | `changeId`, `oldTicketId`, `newTicketId`, `bookingId`, `oldTripId`, `newTripId`, `fareDifference`, `currency`, `changedAt` |

## Refund request event

| Event v1 | Routing key | Producer/consumer | Required payload |
|---|---|---|---|
| `RefundRequested` | `booking.refund.requested.v1` | Booking, kể cả business flow do Admin khởi tạo → Payment | `refundReference`, `paymentId`, `bookingId`, `organizationId`, `amount`, `currency`, `reasonCode`, `requestedAt` |

`RefundRequested` là sự thật “logical refund đã được Booking chấp nhận” và có thể được Reporting quan sát; Admin chỉ là actor khởi tạo flow, không phải message producer. Payment là owner duy nhất thực hiện provider refund. `refundReference` ổn định qua redelivery/retry.

## Atomic publish points

- SeatHold state + corresponding Outbox cùng transaction.
- Booking + items/passengers/redemption + `BookingCreated` Outbox cùng transaction.
- Payment consume: Inbox + Booking `PAID` + TripSeat `BOOKED` + Ticket + `BookingPaid/TicketIssued` Outbox cùng transaction.
- Cancellation: Ticket/Booking state + released seat + RefundRequested/notification events cùng transaction.
- Check-in: Ticket transition + audit + PassengerCheckedIn Outbox cùng transaction.

Event lặp không được tạo thêm Ticket, Promotion redemption, cancellation hoặc check-in.
