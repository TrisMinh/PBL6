# RabbitMQ Retry và Dead-letter Flow

Ví dụ dùng primary queue `booking.payment-events.q`; mọi consumer queue áp dụng cùng pattern với policy riêng.

```mermaid
flowchart TB
    P[(booking.payment-events.q)] --> C[Booking consumer]
    C --> D{"Failure classification"}
    D -- Success/duplicate --> ACK[Commit rồi ACK]
    D -- Transient lần 1 --> R5[(retry.5s)]
    R5 -->|TTL + dead-letter<br/>direct to primary| P
    D -- Transient lần 2 --> R30[(retry.30s)]
    R30 -->|TTL + dead-letter<br/>direct to primary| P
    D -- Transient lần 3 --> R5M[(retry.5m)]
    R5M -->|TTL + dead-letter<br/>direct to primary| P
    D -- Permanent/unsupported schema --> DLQ[(booking.payment-events.q.dlq)]
    D -- Retry exhausted --> DLQ
    DLQ --> INSPECT[Operator inspects safe metadata<br/>and fixes root cause]
    INSPECT --> AUTH{"Authorized replay<br/>with audit?"}
    AUTH -- Không --> HOLD[Keep quarantined]
    AUTH -- Có --> REPLAY[Replay through primary path]
    REPLAY --> P
```

## Retry rules

- Không dùng immediate `requeue=true` vô hạn.
- Republish đến retry/DLQ phải nhận publisher confirm rồi mới ACK message gốc.
- Retry queue quay trực tiếp về đúng primary queue, không fan-out lại sang consumer khác.
- DLQ giữ message ID/type/version, queue nguồn, safe error code, first/last failure, retry count và correlation ID.
- Không sửa payload trong DLQ rồi replay; correction tạo message mới và audit liên kết message cũ.

