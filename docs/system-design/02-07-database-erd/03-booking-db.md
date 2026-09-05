# Booking Database ERD

Database: `booking_db`. `customer_id_external`, `source_trip_id` và `source_seat_id` không có foreign key sang service khác.

```mermaid
erDiagram
    TRIP_SNAPSHOTS {
        uuid trip_id PK
        uuid organization_id_external
        jsonb route_stop_snapshot
        timestamptz departure_at
        timestamptz arrival_at
        numeric base_fare
        char currency
        varchar policy_version
        boolean sellable
        bigint source_version
        timestamptz updated_at
    }
    TRIP_SEATS {
        uuid id PK
        uuid trip_id FK
        uuid source_seat_id_external
        varchar seat_code
        varchar status
        numeric base_price
        uuid hold_id
        uuid booking_item_id
        bigint row_version
        timestamptz created_at
        timestamptz updated_at
    }
    SEAT_HOLDS {
        uuid id PK
        uuid trip_id FK
        uuid customer_id_external
        varchar token_hash UK
        varchar status
        timestamptz expires_at
        varchar idempotency_key
        timestamptz created_at
        timestamptz updated_at
    }
    SEAT_HOLD_ITEMS {
        uuid id PK
        uuid seat_hold_id FK
        uuid trip_seat_id FK
        numeric price_snapshot
        char currency
    }
    BOOKINGS {
        uuid id PK
        varchar booking_code UK
        uuid seat_hold_id FK,UK
        uuid customer_id_external
        uuid trip_id FK
        varchar status
        numeric subtotal
        numeric discount
        numeric fee
        numeric total_amount
        char currency
        varchar policy_snapshot
        timestamptz payment_expires_at
        bigint row_version
        timestamptz created_at
        timestamptz updated_at
    }
    BOOKING_ITEMS {
        uuid id PK
        uuid booking_id FK
        uuid trip_seat_id FK
        numeric unit_price
        numeric discount
        numeric total_amount
    }
    PASSENGERS {
        uuid id PK
        uuid booking_id FK
        uuid booking_item_id FK,UK
        varchar full_name
        varchar phone
        bytea document_encrypted
        jsonb pickup_snapshot
        jsonb dropoff_snapshot
    }
    TICKETS {
        uuid id PK
        uuid booking_item_id FK,UK
        varchar public_code UK
        varchar qr_token_hash UK
        varchar status
        timestamptz checked_in_at
        timestamptz issued_at
        timestamptz cancelled_at
        timestamptz updated_at
    }
    PROMOTIONS {
        uuid id PK
        uuid organization_id_external
        varchar code
        varchar scope
        varchar promotion_type
        numeric promotion_value
        int quota
        int redeemed_count
        timestamptz valid_from
        timestamptz valid_to
        varchar status
        jsonb conditions
        timestamptz created_at
        timestamptz updated_at
    }
    PROMOTION_REDEMPTIONS {
        uuid id PK
        uuid promotion_id FK
        uuid booking_id FK
        uuid customer_id_external
        numeric discount_amount
        timestamptz redeemed_at
    }
    REVIEWS {
        uuid id PK
        uuid ticket_id FK,UK
        uuid customer_id_external
        int rating
        text content
        varchar status
        uuid moderated_by_external
        varchar moderation_reason
        timestamptz created_at
        timestamptz updated_at
        timestamptz moderated_at
    }
    SUPPORT_CASES {
        uuid id PK
        uuid customer_id_external
        uuid organization_id_external
        uuid booking_id FK
        uuid payment_id_external
        varchar status
        varchar priority
        uuid assignee_id_external
        text resolution
        bigint row_version
        timestamptz created_at
        timestamptz updated_at
    }
    SUPPORT_CASE_HISTORY {
        uuid id PK
        uuid support_case_id FK
        uuid actor_id_external
        varchar from_status
        varchar to_status
        varchar reason
        timestamptz occurred_at
    }

    TRIP_SNAPSHOTS ||--|{ TRIP_SEATS : contains
    TRIP_SNAPSHOTS ||--o{ SEAT_HOLDS : receives
    SEAT_HOLDS ||--|{ SEAT_HOLD_ITEMS : contains
    SEAT_HOLDS ||--o| BOOKINGS : creates
    TRIP_SEATS ||--o{ SEAT_HOLD_ITEMS : reserved_in
    TRIP_SNAPSHOTS ||--o{ BOOKINGS : booked_for
    BOOKINGS ||--|{ BOOKING_ITEMS : contains
    TRIP_SEATS ||--o| BOOKING_ITEMS : allocated_to
    BOOKINGS ||--|{ PASSENGERS : contains
    BOOKING_ITEMS ||--|| PASSENGERS : assigned_to
    BOOKING_ITEMS ||--o| TICKETS : issues
    PROMOTIONS ||--o{ PROMOTION_REDEMPTIONS : redeemed_as
    BOOKINGS ||--o{ PROMOTION_REDEMPTIONS : applies
    TICKETS ||--o| REVIEWS : receives
    BOOKINGS o|--o{ SUPPORT_CASES : referenced_by
    SUPPORT_CASES ||--|{ SUPPORT_CASE_HISTORY : records
```

## Constraints và index bắt buộc

- `UNIQUE(trip_id, source_seat_id_external)` và `UNIQUE(trip_id, seat_code)` cho TripSeat.
- Partial unique/locking bảo đảm tối đa một hold ACTIVE hoặc một Ticket hiệu lực trên TripSeat; state transition vẫn phải nằm trong transaction.
- `UNIQUE(seat_hold_id, trip_seat_id)` trên item; `BOOKINGS.seat_hold_id` unique bảo đảm một SeatHold chỉ tạo tối đa một Booking.
- Booking Item, Passenger và Ticket có quan hệ 1–1 theo unique constraint; Booking `PAID` phải có đủ Ticket.
- `UNIQUE(scope, organization_id_external, code)` cho Promotion; redemption unique theo Promotion/Booking và quota được cập nhật có concurrency guard.
- Check constraint: rating `1..5`, mọi money không âm và `total_amount = subtotal - discount + fee` theo quy tắc làm tròn đã cấu hình.
- SupportCase đóng bắt buộc `resolution`; state/version guard áp dụng cho assign/transition và history append-only.
