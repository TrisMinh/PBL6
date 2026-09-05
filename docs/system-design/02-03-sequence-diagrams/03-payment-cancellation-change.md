# 2.3.3 Payment, hủy và đổi vé

Nguồn nghiệp vụ: [SRS — Payment, hủy và đổi vé](../../srs-v2/04-use-cases/03-payment-cancellation-change.md).

## UC-PAY-01 — Thanh toán và nhận vé

```mermaid
sequenceDiagram
    autonumber
    actor CUS as Customer
    participant C as Web/Mobile Client
    participant GW as API Gateway
    participant PAY as Payment Service
    participant DBP as Payment DB
    participant PSP as Payment Gateway
    participant MQ as RabbitMQ
    participant BK as Booking Service
    participant DBB as Booking DB
    participant N as Notification Service

    CUS->>C: Chọn thanh toán Booking
    C->>GW: Create Payment + Idempotency-Key
    GW->>PAY: Booking ID + customer context
    PAY->>DBP: Verify payment snapshot và tạo PENDING
    PAY->>PSP: Create payment intent
    PSP-->>C: Payment UI/redirect
    CUS->>PSP: Hoàn tất bước thanh toán
    PSP->>PAY: Signed webhook
    PAY->>PAY: Verify signature, replay key, amount và currency
    alt Webhook không hợp lệ
        PAY-->>PSP: Reject, không phát event
    else Webhook duplicate
        PAY-->>PSP: 2xx idempotent, không xử lý lần hai
    else Webhook hợp lệ
        PAY->>DBP: Payment=SUCCEEDED + Outbox(PaymentSucceeded)
        PAY-->>PSP: 2xx
        PAY->>MQ: PaymentSucceeded
        MQ-->>BK: PaymentSucceeded at-least-once
        BK->>DBB: Inbox dedupe + kiểm tra Booking/hold
        alt Booking và ghế còn hợp lệ
            BK->>DBB: Booking=PAID, TripSeat=BOOKED, Ticket=ISSUED + Outbox
            BK->>MQ: BookingPaid + TicketIssued
            MQ-->>N: Tạo và gửi xác nhận
        else Hold hết hạn hoặc ghế không còn hợp lệ
            BK->>DBB: Lưu kết quả xử lý + Outbox compensation
            BK->>MQ: PaymentCompensationRequested
            MQ-->>PAY: Yêu cầu refund/reconciliation
        end
    end
    C->>GW: Get payment/booking status
    GW->>PAY: Read Payment state
    PAY-->>C: PROCESSING, SUCCEEDED hoặc FAILED
```

## UC-CANCEL-01 — Hủy vé và hoàn tiền

```mermaid
sequenceDiagram
    autonumber
    actor CUS as Customer
    participant C as Client
    participant GW as API Gateway
    participant BK as Booking Service
    participant DBB as Booking DB
    participant MQ as RabbitMQ
    participant PAY as Payment Service
    participant DBP as Payment DB
    participant PSP as Payment Gateway
    participant N as Notification Service

    CUS->>C: Chọn Ticket cần hủy
    C->>GW: Request cancellation preview
    GW->>BK: Customer context + Ticket ID
    BK->>DBB: Check ownership, state, departure và policy snapshot
    BK-->>C: Fee, refund amount, policy version và expiry
    CUS->>C: Xác nhận preview
    C->>GW: Cancel Ticket + Idempotency-Key
    GW->>BK: Cancellation command
    BK->>DBB: Recheck preview và điều kiện hiện hành
    alt Không đủ điều kiện hoặc preview đã đổi
        BK-->>C: Từ chối hoặc yêu cầu xác nhận preview mới
    else Được phép hủy
        BK->>DBB: Ticket=CANCELLED, release seat + Outbox
        alt Refund amount bằng 0
            BK->>MQ: BookingCancelled
            MQ-->>N: Thông báo kết quả hủy
        else Có tiền cần hoàn
            BK->>MQ: RefundRequested
            MQ-->>PAY: RefundRequested
            PAY->>DBP: Inbox + tạo Refund PROCESSING
            PAY->>PSP: Refund với provider reference và amount
            alt Provider timeout, chưa rõ kết quả
                PAY->>DBP: Giữ Refund PROCESSING
                PAY-->>MQ: ReconciliationRequested
            else Refund thất bại cuối
                PAY->>DBP: Refund=FAILED + Outbox
                PAY->>MQ: RefundFailed
            else Refund thành công
                PAY->>DBP: Refund=SUCCEEDED + Outbox
                PAY->>MQ: RefundSucceeded
            end
            MQ-->>BK: RefundSucceeded hoặc RefundFailed
            BK->>DBB: Inbox + cập nhật trạng thái tổng hợp
            MQ-->>N: Thông báo trạng thái Refund
        end
        BK-->>C: Ticket đã hủy, Refund state nếu có
    end
```

## UC-CHANGE-01 — Đổi vé

```mermaid
sequenceDiagram
    autonumber
    actor CUS as Customer
    participant C as Client
    participant GW as API Gateway
    participant BK as Booking Service
    participant DBB as Booking DB
    participant MQ as RabbitMQ
    participant PAY as Payment Service
    participant PSP as Payment Gateway
    participant N as Notification Service

    CUS->>C: Chọn Ticket cũ và ghế mới
    C->>GW: Request change preview
    GW->>BK: Ticket cũ + TripSeat mới
    BK->>DBB: Verify owner/policy và lock ghế mới
    alt Không giữ được ghế mới
        BK-->>C: SEAT_UNAVAILABLE, Ticket cũ còn hiệu lực
    else Giữ ghế mới thành công
        BK->>DBB: Tạo SeatHold mới và tính chênh lệch
        BK-->>C: Preview phí/chênh lệch + expiry
        CUS->>C: Xác nhận đổi vé
        alt Giá mới cao hơn
            BK->>MQ: AdditionalPaymentRequested
            MQ-->>PAY: Tạo Payment bổ sung
            PAY->>PSP: Create payment intent
            PSP-->>CUS: Payment UI
            PSP->>PAY: Signed payment result
            alt Payment bổ sung thất bại
                PAY->>MQ: PaymentFailed
                MQ-->>BK: PaymentFailed
                BK->>DBB: Release hold mới, giữ Ticket cũ
                BK-->>C: Đổi vé thất bại
            else Payment bổ sung thành công
                PAY->>MQ: PaymentSucceeded
                MQ-->>BK: PaymentSucceeded
            end
        else Giá mới bằng hoặc thấp hơn
            Note over BK,DBB: Không cần thu thêm trước điểm commit
        end
        opt Điều kiện tài chính đã đạt
            BK->>DBB: Atomically issue Ticket mới, cancel Ticket cũ, consume hold + Outbox
            opt Giá mới thấp hơn và policy cho hoàn
                BK->>MQ: RefundRequested
                MQ-->>PAY: Xử lý phần tiền hoàn
            end
            BK->>MQ: TicketChanged
            MQ-->>N: Gửi Ticket mới và kết quả tài chính
            BK-->>C: Đổi vé thành công
        end
    end
```

Nếu Payment bổ sung đã thành công nhưng bước đổi vé không thể commit, Booking phải phát compensation để hoàn khoản bổ sung và giữ Ticket cũ; trường hợp không tự phục hồi được chuyển manual case có audit.
