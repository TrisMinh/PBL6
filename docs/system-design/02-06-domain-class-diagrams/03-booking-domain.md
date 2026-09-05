# Booking Domain/Class Diagram

Owner: Booking Service. `customerId` và `sourceTripId/sourceSeatId` là external reference; `TripSnapshot` là bản sao lịch sử cục bộ.

## Inventory và SeatHold

```mermaid
classDiagram
    class TripSnapshot {
        +UUID tripId
        +UUID organizationId
        +string routeSnapshot
        +datetime departureAt
        +Money fareSnapshot
        +string policyVersion
        +bool sellable
        +long sourceVersion
        +closeInventory()
    }
    class TripSeat {
        <<InventoryRoot>>
        +UUID id
        +UUID sourceSeatId
        +string seatCode
        +TripSeatStatus status
        +Money basePrice
        +UUID holdId
        +UUID bookingItemId
        +long version
        +hold(owner)
        +book(owner)
        +release(owner)
    }
    class SeatHold {
        <<AggregateRoot>>
        +UUID id
        +UUID customerId
        +UUID tripId
        +SeatHoldStatus status
        +datetime expiresAt
        +string idempotencyKey
        +consume()
        +expire()
        +release()
    }
    class SeatHoldItem {
        +UUID id
        +UUID tripSeatId
        +Money priceSnapshot
    }

    TripSnapshot "1" *-- "1..*" TripSeat : inventory
    SeatHold "1" *-- "1..*" SeatHoldItem : all-or-nothing selection
    SeatHoldItem "0..*" --> "1" TripSeat : historical reservation
```

## Booking, Ticket, Promotion và Review

```mermaid
classDiagram
    class Booking {
        <<AggregateRoot>>
        +UUID id
        +string bookingCode
        +UUID customerId
        +UUID tripId
        +BookingStatus status
        +Money subtotal
        +Money discount
        +Money fee
        +Money total
        +string currency
        +confirmPayment(paymentRef)
        +requestCancellation()
        +complete()
    }
    class BookingItem {
        +UUID id
        +UUID tripSeatId
        +Money unitPrice
        +Money discount
        +Money total
    }
    class Passenger {
        +UUID id
        +string fullName
        +string phone
        +string documentEncrypted
        +string pickupSnapshot
        +string dropoffSnapshot
    }
    class Ticket {
        +UUID id
        +string publicCode
        +string qrTokenHash
        +TicketStatus status
        +datetime checkedInAt
        +checkIn(actor, tripId)
        +cancel(reason)
        +markRefunded()
    }
    class Promotion {
        <<AggregateRoot>>
        +UUID id
        +string code
        +PromotionScope scope
        +PromotionType type
        +decimal value
        +int quota
        +datetime validFrom
        +datetime validTo
        +validate(context)
        +consumeQuota()
    }
    class PromotionRedemption {
        +UUID id
        +Money discountAmount
    }
    class Review {
        +UUID id
        +UUID customerId
        +int rating
        +string content
        +ReviewStatus status
        +publish()
        +moderate(reason)
    }
    class SupportCase {
        <<AggregateRoot>>
        +UUID id
        +UUID customerId
        +UUID organizationId
        +string transactionReference
        +SupportCaseStatus status
        +UUID assigneeId
        +open()
        +assign(actor)
        +resolve(resolution)
        +reopen(reason)
    }
    class SupportCaseHistory {
        <<AppendOnly>>
        +UUID actorId
        +SupportCaseStatus fromStatus
        +SupportCaseStatus toStatus
        +string reason
        +datetime occurredAt
    }

    Booking "1" *-- "1..*" BookingItem : items
    BookingItem "1" *-- "1" Passenger : passenger
    BookingItem "1" *-- "0..1" Ticket : issued ticket
    Promotion "1" o-- "0..*" PromotionRedemption : redemptions
    Booking "1" *-- "0..*" PromotionRedemption : applied promotions
    Ticket "1" *-- "0..1" Review : eligible review
    SupportCase "1" *-- "1..*" SupportCaseHistory : history
    SupportCase "0..*" --> "0..1" Booking : transaction reference
```

## Aggregate rules

- `TripSeat` concurrency guard là nguồn quyết định chống bán trùng; Redis không thay invariant DB.
- Booking `PAID` có đúng một Ticket trên mỗi Booking Item và dữ liệu item không sửa trực tiếp.
- Review tối đa một bản ghi trên Ticket đủ điều kiện; Promotion redemption không được ghi trùng.
