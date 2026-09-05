# 2.3.5 Promotion, Review và Notification

Nguồn nghiệp vụ: [SRS — Promotion, Review và Notification](../../srs-v2/04-use-cases/05-promotion-review-notification.md).

## UC-PROMO-01 — Quản lý và áp dụng Promotion

```mermaid
sequenceDiagram
    autonumber
    actor O as Operator/Admin
    actor CUS as Customer
    participant UI as Back-office/Customer Client
    participant GW as API Gateway
    participant BK as Booking Service
    participant DB as Booking DB

    alt Quản lý Promotion
        O->>UI: Tạo/cập nhật/deactivate Promotion
        UI->>GW: Promotion command
        GW->>BK: Actor + tenant scope
        BK->>DB: Check permission, code, scope, period và quota
        alt Không có quyền hoặc dữ liệu sai
            BK-->>UI: Forbidden/validation error
        else Hợp lệ
            BK->>DB: Save Promotion + audit
            BK-->>UI: Promotion version mới
        end
    else Áp dụng Promotion
        CUS->>UI: Nhập mã khi tạo Booking
        UI->>GW: Apply Promotion to hold/booking
        GW->>BK: Customer + code + booking context
        BK->>DB: Check active, scope, condition, quota và usage
        alt Không hợp lệ hoặc quota vừa hết
            BK-->>UI: Không áp dụng, total không đổi
        else Hợp lệ
            BK->>DB: Server tính discount và reserve/commit redemption atomically
            BK-->>UI: Total + discount snapshot
        end
    end
```

## UC-REVIEW-01 — Tạo và cập nhật Review

```mermaid
sequenceDiagram
    autonumber
    actor CUS as Customer
    participant C as Client
    participant GW as API Gateway
    participant BK as Booking Service
    participant DB as Booking DB

    CUS->>C: Mở Ticket đã sử dụng
    C->>GW: Check review eligibility
    GW->>BK: Customer + Ticket ID
    BK->>DB: Verify ownership, Ticket=USED và review window
    alt Không đủ điều kiện hoặc đã có Review khác
        BK-->>C: Từ chối, không tạo Review
    else Đủ điều kiện
        BK-->>C: Cho phép nhập Review
        CUS->>C: Nhập rating và nội dung
        C->>GW: Create/update Review
        GW->>BK: Review command
        BK->>DB: Validate content và unique Ticket review
        alt Nội dung/rating sai hoặc hết thời hạn cập nhật
            BK-->>C: Validation/moderation result
        else Hợp lệ
            BK->>DB: Save Review + version
            BK-->>C: Review đã lưu
        end
    end
```

## UC-REVIEW-02 — Kiểm duyệt Review

```mermaid
sequenceDiagram
    autonumber
    actor M as Admin/Operator Moderator
    participant BO as Back-office Web
    participant GW as API Gateway
    participant BK as Booking Service
    participant DB as Booking DB

    M->>BO: Tìm và chọn Review
    BO->>GW: Get Review in scope
    GW->>BK: Moderator identity + tenant scope
    BK->>DB: Verify visibility/permission
    BK-->>BO: Review và trạng thái hiện hành
    M->>BO: Ẩn/khôi phục + reason
    BO->>GW: Moderate Review + expected version
    GW->>BK: Moderation command
    BK->>DB: Check permission, scope, reason và version
    alt Ngoài tenant, thiếu reason hoặc conflict
        BK-->>BO: Từ chối, Review giữ nguyên
    else Hợp lệ
        BK->>DB: Update status + moderator + reason + audit
        BK-->>BO: Moderation result
    end
```

## UC-NOTIF-01 — Xem và cấu hình Notification

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant C as Client
    participant GW as API Gateway
    participant MQ as RabbitMQ
    participant N as Notification Service
    participant DB as Notification DB
    participant NP as Notification Provider

    alt Xử lý sự kiện giao dịch
        MQ-->>N: Booking/Payment/Trip/Ticket/Refund event
        N->>DB: Inbox dedupe + tạo Notification/DeliveryAttempt
        N->>NP: Gửi theo loại và preference
        alt Provider thành công
            N->>DB: DeliveryAttempt=DELIVERED
        else Lỗi transient
            N->>DB: DeliveryAttempt=RETRYING
            N->>MQ: Republish tới retry tier
        else Lỗi permanent hoặc hết retry
            N->>DB: DeliveryAttempt=FAILED
            N->>MQ: Dead-letter + alert metadata
        end
    else User xem Notification
        U->>C: Mở trung tâm thông báo
        C->>GW: List/read Notification
        GW->>N: User identity + paging/action
        N->>DB: Query hoặc mark read idempotently
        N-->>C: Notification list/read state
    else User cập nhật preference
        U->>C: Bật/tắt kênh tùy chọn
        C->>GW: Update preferences
        GW->>N: User identity + preference command
        N->>DB: Enforce mandatory transactional channels
        N-->>C: Preferences đã lưu
    end
```

Delivery failure không đảo Booking, Payment, Ticket hoặc Refund đã commit.
