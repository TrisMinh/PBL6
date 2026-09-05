# Event Flow — Payment xác nhận Booking và Ticket

Nguồn: `UC-PAY-01`, `BP-01`, `QA-02`, `QA-03`.

```mermaid
flowchart LR
    PSP[Payment Gateway] -->|signed webhook| PAY[Payment Service]
    PAY --> V{"Signature, replay key,<br/>amount, currency valid?"}
    V -- Không --> REJ[Reject/audit<br/>no success event]
    V -- Có --> PDB[("Payment DB:<br/>Payment SUCCEEDED + Outbox")]
    PDB -.->|payment.payment.succeeded.v1| MQ{{platform.events}}
    MQ -.->|at-least-once| BQ[(booking.payment-events.q)]
    MQ -.->|projection| RQ[(reporting.integration-events.q)]
    BQ --> BK["Booking consumer:<br/>validate schema + Inbox dedupe"]
    BK --> OWN{"Booking pending and<br/>seat ownership valid?"}
    OWN -- Có --> BDB[("Booking DB transaction:<br/>PAID + BOOKED + Ticket + Outbox")]
    BDB -.->|booking.booking.paid.v1| MQ
    BDB -.->|booking.ticket.issued.v1| MQ
    MQ -.->|fan-out| NQ[(notification.integration-events.q)]
    MQ -.->|fan-out| RQ
    OWN -- Không --> COMP["Persist compensation/manual case<br/>do not reclaim another booking's seat"]
    COMP -.->|booking.payment.compensation-requested.v1| CMD{{platform.commands}}
    CMD -.->|single Payment consumer| PQ[(payment.refund-requests.q)]
```

## Correctness rules

- Payment webhook trả 2xx sau khi Payment state + Outbox đã commit, không chờ Booking/Notification/Reporting.
- Duplicate webhook không tạo `PaymentSucceeded` lần hai; duplicate delivery không tạo Ticket lần hai.
- Booking kiểm tra amount/currency/reference và state guard, không chỉ tin event name.
- Nếu payment thành công trễ nhưng không thể cấp ghế, đi vào compensation/refund hoặc manual case.
