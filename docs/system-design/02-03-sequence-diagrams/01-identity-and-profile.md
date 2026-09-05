# 2.3.1 Định danh và hồ sơ

Nguồn nghiệp vụ: [SRS — Định danh và hồ sơ](../../srs-v2/04-use-cases/01-identity-and-profile.md).

## UC-AUTH-01 — Đăng ký và kích hoạt tài khoản

```mermaid
sequenceDiagram
    autonumber
    actor G as Guest
    participant C as Web/Mobile Client
    participant GW as API Gateway
    participant ID as Identity Service
    participant DB as Identity DB
    participant MQ as RabbitMQ
    participant N as Notification Service
    participant NP as Notification Provider

    G->>C: Nhập thông tin đăng ký
    C->>GW: Gửi đăng ký
    GW->>ID: Register customer
    ID->>DB: Kiểm tra duy nhất và tạo PENDING_VERIFICATION
    alt Dữ liệu sai hoặc định danh đã dùng
        ID-->>GW: Validation hoặc identity conflict
        GW-->>C: Lỗi an toàn theo trường
    else Chấp nhận đăng ký
        ID->>DB: Ghi Outbox(NotificationRequested)
        ID->>MQ: NotificationRequested
        MQ-->>N: Yêu cầu gửi OTP/link
        N->>NP: Gửi thông tin xác minh
        N-->>MQ: Delivery result
        ID-->>C: Trạng thái chờ xác minh
        G->>C: Nhập OTP hoặc mở link
        C->>GW: Gửi token xác minh
        GW->>ID: Verify registration
        ID->>DB: Kích hoạt User và ghi audit + Outbox
        ID->>MQ: UserRegistered
        ID-->>C: Đăng ký thành công
    end
```

## UC-AUTH-02 — Đăng nhập

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant C as Web/Mobile/Back-office
    participant GW as API Gateway
    participant ID as Identity Service
    participant DB as Identity DB

    U->>C: Nhập định danh và mật khẩu
    C->>GW: Login request
    GW->>ID: Authenticate
    ID->>DB: Kiểm tra rate limit và account state
    ID->>DB: Verify password hash, role và membership
    alt Sai thông tin hoặc tài khoản bị khóa
        ID->>DB: Ghi failed attempt/security audit
        ID-->>GW: Generic authentication error
        GW-->>C: Không tiết lộ tài khoản tồn tại
    else Hợp lệ
        ID->>DB: Tạo refresh session
        ID-->>GW: Access token + rotating refresh token
        GW-->>C: Phiên và scope hiện hành
        C-->>U: Điều hướng theo role
    end
```

## UC-AUTH-03 — Refresh phiên và đăng xuất

```mermaid
sequenceDiagram
    autonumber
    actor U as Authenticated User
    participant C as Client
    participant GW as API Gateway
    participant ID as Identity Service
    participant DB as Identity DB

    alt Refresh phiên
        C->>GW: Refresh token
        GW->>ID: Rotate session
        ID->>DB: Verify hash, expiry, revoke và User scope
        alt Token hợp lệ
            ID->>DB: Revoke token cũ và tạo token mới
            ID-->>C: Access token + refresh token mới
        else Token sai, hết hạn, revoked hoặc reuse
            ID->>DB: Revoke token family khi cần
            ID-->>C: Yêu cầu đăng nhập lại
        end
    else Đăng xuất
        U->>C: Chọn đăng xuất
        C->>GW: Revoke current session
        GW->>ID: Logout
        ID->>DB: Revoke refresh session idempotently
        ID-->>C: Logout thành công
        C->>C: Xóa credential cục bộ
    end
```

## UC-AUTH-04 — Quên và đặt lại mật khẩu

```mermaid
sequenceDiagram
    autonumber
    actor U as Guest/User
    participant C as Client
    participant GW as API Gateway
    participant ID as Identity Service
    participant DB as Identity DB
    participant MQ as RabbitMQ
    participant N as Notification Service

    U->>C: Yêu cầu quên mật khẩu
    C->>GW: Submit email/phone
    GW->>ID: Request password reset
    ID->>DB: Kiểm tra rate limit và định danh
    ID-->>C: Luôn trả thông báo chung
    opt Tài khoản hợp lệ
        ID->>DB: Lưu one-time token + Outbox
        ID->>MQ: NotificationRequested
        MQ-->>N: Gửi OTP/link khôi phục
    end
    U->>C: Gửi token và mật khẩu mới
    C->>GW: Confirm password reset
    GW->>ID: Reset password
    ID->>DB: Verify token và password policy
    alt Token hợp lệ
        ID->>DB: Đổi password hash, consume token, revoke sessions
        ID-->>C: Đặt lại mật khẩu thành công
    else Token sai, hết hạn hoặc đã dùng
        ID-->>C: Từ chối, mật khẩu không đổi
    end
```

## UC-PROFILE-01 — Xem và cập nhật hồ sơ

```mermaid
sequenceDiagram
    autonumber
    actor CUS as Customer
    participant C as Client
    participant GW as API Gateway
    participant ID as Identity Service
    participant DB as Identity DB
    participant MQ as RabbitMQ
    participant N as Notification Service

    CUS->>C: Mở hồ sơ
    C->>GW: Get my profile
    GW->>ID: Identity context + request
    ID->>DB: Đọc đúng User và mask field nhạy cảm
    ID-->>C: Hồ sơ được phép hiển thị
    CUS->>C: Lưu thay đổi
    C->>GW: Update my profile
    GW->>ID: Update allowed fields
    ID->>DB: Validate ownership, format và uniqueness
    alt Cố sửa role/tenant hoặc dữ liệu sai
        ID-->>C: Từ chối, dữ liệu cũ giữ nguyên
    else Chỉ đổi thông tin thường
        ID->>DB: Cập nhật profile + audit
        ID-->>C: Hồ sơ đã cập nhật
    else Đổi email/số điện thoại
        ID->>DB: Lưu định danh mới ở trạng thái pending + Outbox
        ID->>MQ: NotificationRequested
        MQ-->>N: Gửi OTP/link xác minh
        N-->>CUS: Thông tin xác minh
        CUS->>C: Gửi OTP/token
        C->>ID: Verify new identity
        ID->>DB: Promote định danh mới nếu token hợp lệ
        ID-->>C: Kết quả xác minh
    end
```
