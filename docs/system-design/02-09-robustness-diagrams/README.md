# 2.9 Robustness Diagrams

Robustness diagram nối đặc tả Use Case với Sequence/Class Diagram bằng quy tắc BCE:

```text
Actor → Boundary → Control → Entity
```

Actor không truy cập Entity trực tiếp; Boundary không chứa business rule; Control điều phối use case và chỉ Entity bảo toàn business state/invariant.

## Danh mục

| Luồng rủi ro cao | Sơ đồ | Use Case nguồn |
|---|---|---|
| Đăng nhập | [Authentication robustness](./01-authentication.md) | `UC-AUTH-02..04` |
| Đặt vé và thanh toán | [Booking–Payment robustness](./02-booking-payment.md) | `UC-SEARCH-01`, `UC-BOOK-01`, `UC-PAY-01` |
| Hủy vé và hoàn tiền | [Ticket cancellation robustness](./03-ticket-cancellation.md) | `UC-CANCEL-01` |
| Tạo và mở bán Trip | [Trip publishing robustness](./04-trip-publishing.md) | `UC-OPS-05` |
| Check-in | [Passenger check-in robustness](./05-passenger-checkin.md) | `UC-OPS-06`, `UC-DRIVER-01` |
| Hủy Trip | [Trip cancellation robustness](./06-trip-cancellation.md) | `UC-TRIP-01` |
| Đổi vé | [Ticket change robustness](./07-ticket-change.md) | `UC-CHANGE-01` |

Các use case CRUD/query đơn giản đã có Use Case + Sequence Diagram; robustness tập trung vào bảy luồng có nhiều rule, concurrency hoặc giao dịch liên service, nơi BCE giúp phát hiện boundary/control/entity bị đặt sai trách nhiệm.

## Ký pháp Mermaid

- Hình người que: Actor.
- Hộp kép: `«boundary»` — UI/API/provider endpoint.
- Hình tròn: `«control»` — application use-case coordinator/policy.
- Hộp: `«entity»` — aggregate/entity/value object bền vững.

