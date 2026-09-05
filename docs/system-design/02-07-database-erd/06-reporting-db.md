# Reporting Database ERD

Database: `reporting_db`. Các ID nghiệp vụ là projection key, không có FK sang transaction database.

```mermaid
erDiagram
    BOOKING_PROJECTIONS {
        uuid booking_id PK
        uuid organization_id_external
        uuid customer_id_external
        uuid trip_id_external
        varchar status
        numeric total_amount
        char currency
        timestamptz booked_at
        timestamptz data_as_of
        bigint source_version
    }
    REVENUE_PROJECTIONS {
        uuid id PK
        uuid organization_id_external
        date period_date
        char currency
        numeric gross_amount
        numeric refund_amount
        numeric net_amount
        timestamptz data_as_of
    }
    OCCUPANCY_PROJECTIONS {
        uuid trip_id_external PK
        uuid organization_id_external
        int total_seats
        int held_seats
        int booked_seats
        int checked_in_count
        decimal occupancy_rate
        timestamptz data_as_of
        bigint source_version
    }
    EXPORT_JOBS {
        uuid id PK
        uuid requested_by_external
        uuid organization_id_external
        varchar report_type
        jsonb filter_json
        varchar status
        varchar object_key
        varchar safe_error_code
        timestamptz data_as_of
        timestamptz expires_at
        timestamptz created_at
        timestamptz completed_at
    }
    EXPORT_DOWNLOAD_AUDITS {
        uuid id PK
        uuid export_job_id FK
        uuid actor_id_external
        uuid correlation_id
        timestamptz downloaded_at
    }
    PROJECTION_CHECKPOINTS {
        varchar projection_name PK
        varchar last_event_id
        timestamptz data_as_of
        timestamptz updated_at
    }

    EXPORT_JOBS ||--o{ EXPORT_DOWNLOAD_AUDITS : downloads
```

## Constraints và index bắt buộc

- `UNIQUE(organization_id_external, period_date, currency)` trên RevenueProjection.
- Source `aggregateVersion` không được đi lùi; gap được retry hoặc reconcile với owner API.
- API report bắt buộc trả `generatedAt/dataAsOf`; projection không được dùng để update transaction nguồn.
- Export file nằm ở Object Storage; database chỉ giữ object key, expiry và audit metadata.
- `reporting.integration-events.q` vẫn dùng Inbox để dedupe; checkpoint không thay Inbox unique constraint.

