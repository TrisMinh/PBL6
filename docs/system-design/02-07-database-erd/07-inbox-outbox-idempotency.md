# Inbox, Outbox, Idempotency và Audit ERD

Mẫu này tồn tại trong từng database cần publish/consume message; đây không phải một shared database. Business state và Outbox cùng local transaction; Inbox và consumer side effect cũng cùng local transaction.

```mermaid
erDiagram
    OUTBOX_MESSAGES {
        uuid id PK
        varchar message_type
        int schema_version
        uuid aggregate_id
        bigint aggregate_version
        jsonb payload
        uuid correlation_id
        uuid causation_id
        timestamptz occurred_at
        timestamptz published_at
        int attempt_count
        timestamptz next_attempt_at
        varchar last_error_code
    }
    INBOX_MESSAGES {
        uuid id PK
        varchar consumer_name
        varchar message_id
        varchar message_type
        int schema_version
        varchar payload_hash
        timestamptz received_at
        timestamptz processed_at
    }
    IDEMPOTENCY_RECORDS {
        uuid id PK
        varchar actor_scope
        varchar operation
        varchar idempotency_key
        varchar request_hash
        int response_status
        jsonb response_snapshot
        varchar resource_reference
        timestamptz expires_at
        timestamptz created_at
    }
    AUDIT_LOGS {
        uuid id PK
        uuid actor_id_external
        varchar service_identity
        varchar action
        varchar target_type
        varchar target_id
        uuid organization_id_external
        varchar result
        varchar reason
        uuid correlation_id
        jsonb safe_metadata
        timestamptz occurred_at
    }
```

## Constraints và lifecycle

- `UNIQUE(consumer_name, message_id)` biến redelivery thành no-op an toàn.
- `UNIQUE(actor_scope, operation, idempotency_key)`; cùng key khác request hash bị từ chối.
- Outbox chỉ set `published_at` sau publisher confirm; timeout giữ row để retry.
- Consumer chỉ ACK sau khi transaction gồm Inbox + side effect + Outbox kế tiếp đã commit.
- Claim Outbox dùng `FOR UPDATE SKIP LOCKED` hoặc cơ chế tương đương; nhiều publisher không được claim cùng row.
- Thao tác nhạy cảm ghi Audit trong transaction hoặc Outbox audit event bền vững; application role thông thường không được update/delete Audit.
- Cleanup theo retention, nhưng không dùng Outbox như event store và không xóa record còn cần đối soát.
