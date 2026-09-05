# Robustness — Đổi vé

Nguồn: `UC-CHANGE-01`, `BP-03` (`SHOULD`).

```mermaid
flowchart LR
    C["◯<br/>╱│╲<br/>╱ ╲<br/>Customer"]:::actor

    PAGE[["«boundary»<br/>Ticket Change UI"]]
    API[["«boundary»<br/>Ticket Change API"]]

    ELIG(("«control»<br/>ChangeEligibilityPolicy"))
    HOLD(("«control»<br/>NewSeatHoldController"))
    FARE(("«control»<br/>FareDifferencePolicy"))
    SWAP(("«control»<br/>TicketSwapCoordinator"))
    COMP(("«control»<br/>CompensationController"))

    OLD["«entity»<br/>Old Ticket/TripSeat"]
    NEWHOLD["«entity»<br/>New SeatHold/TripSeat"]
    BOOK["«entity»<br/>Booking/BookingItem"]
    NEWT["«entity»<br/>Replacement Ticket"]
    FIN["«entity»<br/>Payment/Refund Reference"]
    AUDIT["«entity»<br/>Change Audit/Outbox"]

    C --> PAGE
    PAGE --> API
    API --> ELIG
    API --> HOLD
    API --> FARE
    API --> SWAP
    ELIG --> OLD
    HOLD --> NEWHOLD
    FARE --> OLD
    FARE --> NEWHOLD
    FARE --> FIN
    SWAP --> OLD
    SWAP --> NEWHOLD
    SWAP --> BOOK
    SWAP --> NEWT
    SWAP --> AUDIT
    SWAP -->|failure before commit| COMP
    COMP --> FIN
    COMP --> OLD
    COMP --> NEWHOLD

    classDef actor fill:transparent,stroke:transparent
```

## Trách nhiệm kiểm tra

- Eligibility và hold mới hoàn tất trước khi tác động Ticket cũ.
- Fare policy tính phí/chênh lệch phía server; payment bổ sung phải thành công trước commit swap.
- Swap coordinator bảo đảm tại điểm commit chỉ Ticket mới có hiệu lực; command lặp trả cùng logical change.
- Compensation hoàn khoản thu thêm/release hold mới và giữ Ticket cũ nếu chưa qua điểm commit.
