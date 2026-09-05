# Message Lifecycle — Outbox, Inbox và ACK

Sơ đồ áp dụng cho mọi event/async command quan trọng.

```mermaid
flowchart LR
    C[Command/Event cause] --> TX1["Producer local transaction:<br/>business state + Outbox"]
    TX1 --> OW[Outbox worker claims row]
    OW --> PUB["Publish persistent message<br/>mandatory=true"]
    PUB --> D1{"Publisher confirm?"}
    D1 -- Không/timeout --> R1[Keep Outbox pending<br/>schedule retry] --> OW
    D1 -- Có --> MARK[Set published_at]
    MARK --> RMQ[(RabbitMQ primary queue)]
    RMQ --> CON[Consumer receives<br/>manual ACK]
    CON --> VAL{"Envelope/schema/version valid?"}
    VAL -- Không --> DLQ[(Consumer DLQ)]
    VAL -- Có --> TX2["Consumer local transaction:<br/>insert Inbox + side effect + optional Outbox"]
    TX2 --> DUP{"Inbox unique conflict?"}
    DUP -- Có --> ACK1[ACK duplicate as no-op]
    DUP -- Không --> COMMIT{"Local commit succeeds?"}
    COMMIT -- Có --> ACK2[ACK after commit]
    COMMIT -- Transient failure --> RETRY[Republish confirmed to retry tier<br/>then ACK original]
    COMMIT -- Permanent failure --> DLQ2[Republish confirmed to DLQ<br/>then ACK original]
    ACK2 --> NEXT[Optional next Outbox event]
```

## Crash windows

| Crash point | Kết quả đúng |
|---|---|
| Sau business commit, trước publish | Outbox row còn pending và được worker khác publish. |
| Sau broker nhận, trước producer nhận confirm | Producer có thể publish lại; Inbox dedupe ở consumer. |
| Sau consumer commit, trước ACK | RabbitMQ redeliver; Inbox biến lần giao lại thành no-op. |
| Khi republish retry chưa confirm | Không ACK bản gốc, tránh mất message. |

