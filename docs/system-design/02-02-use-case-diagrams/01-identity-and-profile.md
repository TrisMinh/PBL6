# 2.2.1 Use Case Diagram — Định danh và hồ sơ

Nguồn đặc tả: [Định danh và hồ sơ](../../srs-v2/04-use-cases/01-identity-and-profile.md).

```mermaid
flowchart LR
    G["◯<br/>╱│╲<br/>╱ ╲<br/>Guest"]
    C["◯<br/>╱│╲<br/>╱ ╲<br/>Customer"]
    STAFF["◯<br/>╱│╲<br/>╱ ╲<br/>Driver / Operator / Admin"]
    NP["Notification Provider<br/>«external system»"]

    subgraph SYS["Online Bus Ticket Booking System"]
        direction TB
        A1(["UC-AUTH-01<br/>Đăng ký và kích hoạt tài khoản"])
        A2(["UC-AUTH-02<br/>Đăng nhập"])
        A3(["UC-AUTH-03<br/>Refresh phiên và đăng xuất"])
        A4(["UC-AUTH-04<br/>Quên và đặt lại mật khẩu"])
        P1(["UC-PROFILE-01<br/>Xem và cập nhật hồ sơ"])
        VERIFY(["Gửi và xác minh OTP / liên kết"])
        SESSION(["Rotate / thu hồi phiên"])

        A1 -. "«include»" .-> VERIFY
        A4 -. "«include»" .-> VERIFY
        A3 -. "«include»" .-> SESSION
        VERIFY -. "«extend» khi đổi định danh" .-> P1
    end

    G --- A1
    G --- A2
    G --- A4
    C --- A2
    C --- A3
    C --- A4
    C --- P1
    STAFF --- A2
    STAFF --- A3
    STAFF --- A4
    VERIFY --- NP

    classDef actor fill:transparent,stroke:transparent
    class G,C,STAFF actor
    style SYS fill:transparent
```

`Guest` khởi tạo đăng ký/khôi phục; mọi nhóm user dùng đăng nhập và quản lý phiên. Xác minh định danh chỉ mở rộng cập nhật hồ sơ khi Customer thay email hoặc số điện thoại.
