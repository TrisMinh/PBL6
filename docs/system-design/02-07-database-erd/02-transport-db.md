# Transport Database ERD

Database: `transport_db`. `user_id_external` là ID từ Identity Service, không có foreign key.

```mermaid
erDiagram
    ORGANIZATIONS {
        uuid id PK
        varchar code UK
        varchar name
        varchar legal_name
        varchar contact_email
        varchar status
        bigint row_version
        timestamptz created_at
        timestamptz updated_at
    }
    BUSES {
        uuid id PK
        uuid organization_id FK
        varchar normalized_plate_number
        varchar bus_type
        int seat_template_version
        varchar status
        timestamptz deleted_at
    }
    SEATS {
        uuid id PK
        uuid bus_id FK
        varchar code
        int floor_no
        int row_no
        int column_no
        varchar seat_type
        boolean enabled
    }
    DRIVER_PROFILES {
        uuid id PK
        uuid organization_id FK
        uuid user_id_external
        varchar license_number
        date license_expires_at
        varchar status
        timestamptz deleted_at
    }
    STOPS {
        uuid id PK
        uuid organization_id FK
        varchar name
        varchar address
        decimal latitude
        decimal longitude
        varchar status
    }
    ROUTES {
        uuid id PK
        uuid organization_id FK
        varchar origin_label
        varchar destination_label
        decimal distance_km
        int duration_minutes
        varchar status
        bigint row_version
    }
    ROUTE_STOPS {
        uuid id PK
        uuid route_id FK
        uuid stop_id FK
        varchar stop_type
        int sequence_no
        int offset_minutes
    }
    TRIPS {
        uuid id PK
        uuid organization_id FK
        uuid route_id FK
        uuid bus_id FK
        timestamptz departure_at
        timestamptz arrival_at
        numeric base_fare
        char currency
        varchar fare_policy_version
        varchar status
        boolean sellable
        bigint row_version
        varchar cancellation_reason
        timestamptz created_at
        timestamptz updated_at
    }
    DRIVER_ASSIGNMENTS {
        uuid id PK
        uuid trip_id FK
        uuid driver_profile_id FK
        varchar assignment_role
        timestamptz start_at
        timestamptz end_at
    }

    ORGANIZATIONS ||--o{ BUSES : owns
    BUSES ||--|{ SEATS : contains
    ORGANIZATIONS ||--o{ DRIVER_PROFILES : employs
    ORGANIZATIONS ||--o{ STOPS : owns
    ORGANIZATIONS ||--o{ ROUTES : owns
    ROUTES ||--|{ ROUTE_STOPS : orders
    STOPS ||--o{ ROUTE_STOPS : referenced_by
    ORGANIZATIONS ||--o{ TRIPS : schedules
    ROUTES ||--o{ TRIPS : used_by
    BUSES ||--o{ TRIPS : assigned_to
    TRIPS ||--|{ DRIVER_ASSIGNMENTS : contains
    DRIVER_PROFILES ||--o{ DRIVER_ASSIGNMENTS : receives
```

## Constraints và index bắt buộc

- `UNIQUE(organization_id, normalized_plate_number)` trên Bus hoạt động; `UNIQUE(bus_id, code)` trên Seat.
- `UNIQUE(route_id, stop_type, sequence_no)`; Route có origin/destination hợp lệ và ít nhất hai stop theo policy.
- `arrival_at > departure_at`, fare không âm và currency hợp lệ.
- Exclusion/transaction check ngăn lịch Bus và Driver chồng lấn theo buffer cấu hình.
- Index search Trip bắt đầu từ route/điểm/ngày/status/sellable; tenant index luôn dẫn bằng `organization_id` cho back-office.
