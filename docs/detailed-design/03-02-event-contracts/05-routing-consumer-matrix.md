# 3.2.5 Routing, Queue và Consumer Matrix

## Queue bindings

| Queue owner | Queue | Exchange/binding |
|---|---|---|
| Booking | `booking.trip-events.q` | events: `transport.trip.*.v1` |
| Booking | `booking.payment-events.q` | events: `payment.payment.*.v1`, `payment.refund.*.v1` |
| Transport | `transport.inventory-events.q` | events: `booking.trip-inventory.ready.v1` |
| Payment | `payment.refund-requests.q` | events: `booking.booking.cancelled.v1`, `booking.refund.requested.v1`; commands: `booking.payment.compensation-requested.v1` |
| Notification | `notification.integration-events.q` | explicit User/Trip/Booking/Ticket/Payment/Refund notification events |
| Notification | `notification.commands.q` | commands: `notification.delivery.send.v1` |
| Reporting | `reporting.integration-events.q` | explicit 15 baseline + approved design projection events; không bind `#` |

## Event consumer behavior

| Event | Booking | Transport | Payment | Notification | Reporting |
|---|---|---|---|---|---|
| UserRegistered | — | — | — | Verification delivery | User count projection |
| TripPublished | Create inventory | — | — | — | Trip projection |
| TripUpdated | Update allowed snapshot | — | — | Notify affected Customer | Trip projection |
| TripStatusChanged | Close/update inventory by rule | — | — | Optional operational notice | Trip projection |
| TripCancelled | Close/cancel affected | — | — | Notify affected Customer | Cancellation projection |
| TripInventoryReady | — | Mark sellable | — | — | Optional readiness metric |
| SeatHoldCreated/Expired | — | — | — | — | Funnel/occupancy projection |
| BookingCreated | — | — | Optional payment snapshot | — | Booking projection |
| PaymentSucceeded | Confirm Booking/Ticket | — | — | — | Payment projection |
| PaymentFailed | Keep non-PAID | — | — | Notify Customer | Payment projection |
| BookingPaid | — | — | — | Confirmation | Revenue/booking projection |
| TicketIssued/Changed | — | — | — | Deliver Ticket/change | Ticket projection |
| Booking/TicketCancelled | Converge own item state | — | `BookingCancelled`: close unresolved payment; refund only from explicit request | Notify Customer | Cancellation projection |
| RefundRequested | — | — | Create/process Refund | — | Requested projection if approved |
| RefundSucceeded/Failed | Converge refund status | — | — | Notify status | Refund projection |
| PassengerCheckedIn | — | — | — | — | Check-in/occupancy projection |

## Failure ownership

- Producer owns schema, Outbox publish reliability và unroutable alert.
- Consumer owns schema validation, Inbox, retry classification, DLQ và replay runbook của queue mình.
- Queue retry tiers baseline `5s → 30s → 5m`, nhưng số lần/tier là configuration theo handler.
- Retry/DLQ republish phải confirm trước ACK original; replay vẫn qua Inbox.
