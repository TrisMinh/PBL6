# Payment Database ERD

Database: `payment_db`. `booking_id_external` là external reference đến Booking Service.

```mermaid
erDiagram
    PAYMENTS {
        uuid id PK
        uuid booking_id_external
        numeric amount
        char currency
        varchar status
        varchar provider
        varchar provider_reference
        varchar idempotency_key
        bigint row_version
        timestamptz created_at
        timestamptz updated_at
    }
    PAYMENT_ATTEMPTS {
        uuid id PK
        uuid payment_id FK
        varchar provider_transaction_id
        varchar request_reference
        varchar request_hash
        varchar status
        varchar safe_error_code
        timestamptz created_at
        timestamptz completed_at
    }
    WEBHOOK_RECEIPTS {
        uuid id PK
        uuid payment_id FK
        varchar provider
        varchar external_event_id
        varchar payload_hash
        boolean signature_verified
        varchar processing_status
        timestamptz received_at
        timestamptz processed_at
    }
    REFUNDS {
        uuid id PK
        uuid payment_id FK
        uuid booking_id_external
        numeric amount
        char currency
        varchar reason
        varchar status
        varchar idempotency_key
        varchar provider_reference
        int attempt_count
        bigint row_version
        timestamptz created_at
        timestamptz updated_at
    }
    RECONCILIATION_CASES {
        uuid id PK
        uuid payment_id FK
        uuid refund_id FK
        varchar case_type
        varchar provider_status
        varchar local_status
        varchar status
        text resolution
        uuid resolved_by_external
        timestamptz opened_at
        timestamptz resolved_at
    }

    PAYMENTS ||--|{ PAYMENT_ATTEMPTS : attempts
    PAYMENTS ||--o{ WEBHOOK_RECEIPTS : receives
    PAYMENTS ||--o{ REFUNDS : refunds
    PAYMENTS ||--o{ RECONCILIATION_CASES : discrepancies
    REFUNDS o|--o{ RECONCILIATION_CASES : discrepancies
```

## Constraints và index bắt buộc

- `UNIQUE(provider, provider_transaction_id)` trên attempt khi provider ID tồn tại.
- `UNIQUE(provider, external_event_id)` trên webhook receipt; duplicate đã persist trả 2xx và không phát event lần hai.
- `UNIQUE(payment_id, idempotency_key)` trên Refund/Payment command theo logical operation.
- Check constraint money dương, currency khớp Payment và tổng Refund `SUCCEEDED` không vượt Payment amount; transaction lock Payment khi xác nhận refund.
- Không lưu PAN/CVV hoặc raw secret; payload webhook chỉ giữ metadata/payload hash an toàn theo retention.

