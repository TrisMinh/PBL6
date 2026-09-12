# Event Flow — Notification và Reporting

Trong MVP, nhánh Notification dùng allow-list policy cố định cho `IN_APP`/`EMAIL`; preference và ExportJob trong sơ đồ là nhánh P1, không có binding/worker/runtime cho tới khi được đưa vào release.

Hai service này là consumer ngoài critical path. Mỗi service có queue, Inbox và failure policy riêng.

```mermaid
flowchart LR
    MQ{{platform.events}} -. explicit bindings .-> NQ[(notification.integration-events.q)]
    MQ -. explicit bindings .-> RQ[(reporting.integration-events.q)]

    NQ --> NI["Notification Inbox<br/>dedupe message_id"]
    NI --> NDB[("Notification DB:<br/>Notification + DeliveryAttempt")]
    NDB --> PREF{"Channel allowed by<br/>preference/policy?"}
    PREF -- Có --> PROVIDER[Email/Push/SMS Provider]
    PREF -- Không --> INAPP[In-app only/skip optional channel]
    PROVIDER --> OUT{"Delivery outcome"}
    OUT -- Transient --> NR[Consumer/provider retry with backoff]
    OUT -- Final --> NH[Persist success/failure + metric]

    RQ --> RI["Reporting Inbox<br/>dedupe message_id"]
    RI --> VER{"Aggregate version valid?"}
    VER -- Duplicate/old --> NOOP[ACK no-op]
    VER -- Gap --> REC[Retry/reconcile owner API]
    VER -- Next --> RDB[(Update projection + dataAsOf)]
    RDB --> API[Report API / ExportJob]
```

## Isolation rules

- Lỗi Notification/Reporting không rollback Booking, Payment, Ticket hoặc Trip.
- Mỗi queue retry/DLQ độc lập; poison message của Reporting không chặn Notification.
- Notification payload tối thiểu và không chứa secret/PII không cần thiết.
- Reporting không bind wildcard `#`, không join trực tiếp transaction DB và luôn công bố `dataAsOf`.
