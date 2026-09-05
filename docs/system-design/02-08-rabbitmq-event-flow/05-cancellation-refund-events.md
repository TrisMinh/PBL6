# Event Flow — Hủy và Refund

Áp dụng cho Customer hủy Ticket, đổi vé cần hoàn chênh lệch và Operator/Admin hủy Trip.

```mermaid
flowchart LR
    CAUSE["Cancellation committed:<br/>Ticket/Booking/Trip no longer usable"] --> BDB[(Booking DB + Outbox)]
    BDB -.->|booking.booking.cancelled.v1| MQ{{platform.events}}
    BDB -.->|booking.ticket.cancelled.v1| MQ
    BDB -.->|booking.refund.requested.v1| MQ
    MQ -.->|BookingCancelled: close unresolved payment<br/>RefundRequested: start logical refund| PQ[(payment.refund-requests.q)]
    PQ --> PAY["Payment consumer:<br/>Inbox + dispatch by message type"]
    PAY --> D1{"Refund required and<br/>within remaining amount?"}
    D1 -- Không --> REJ[Reject/open reconciliation case]
    D1 -- Có --> PDB[(Payment DB<br/>Refund REQUESTED/PROCESSING)]
    PDB --> PSP[Payment Gateway]
    PSP --> D2{"Verified final outcome"}
    D2 -- Thành công --> OUT1[("Refund SUCCEEDED<br/>+ Outbox")]
    OUT1 -.->|payment.refund.succeeded.v1| MQ
    D2 -- Thất bại cuối --> OUT2[("Refund FAILED<br/>+ Outbox/manual case")]
    OUT2 -.->|payment.refund.failed.v1| MQ
    MQ -.->|converge state| BQ[(booking.payment-events.q)]
    MQ -.->|notify| NQ[(notification.integration-events.q)]
    MQ -.->|projection| RQ[(reporting.integration-events.q)]
```

## Correctness rules

- Quyền dùng Ticket bị thu hồi trước/độc lập với kết quả Refund; Refund lỗi không phục hồi Ticket.
- `BookingCancelled` chỉ đóng/cancel payment intent chưa có final success; nó không tự tạo Refund.
- `RefundRequested` mang logical refund reference và Payment ID; retry không tạo Refund mới.
- Consumer khóa/kiểm tra Payment để tổng refund thành công không vượt số tiền đã thu.
- `RefundFailed` là design event phục vụ hội tụ UI/support; không có nghĩa tự động charge/refund lại.
