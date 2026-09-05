# Robustness — Authentication

Nguồn: `UC-AUTH-02`, `UC-AUTH-03`, `UC-AUTH-04`.

```mermaid
flowchart LR
    U["◯<br/>╱│╲<br/>╱ ╲<br/>Guest/User"]:::actor

    LOGIN[["«boundary»<br/>Login / Reset UI"]]
    AUTHAPI[["«boundary»<br/>Auth HTTP endpoint"]]

    AUTH(("«control»<br/>AuthenticationController"))
    TOKEN(("«control»<br/>SessionController"))
    RESET(("«control»<br/>PasswordResetController"))

    USER["«entity»<br/>User"]
    SESSION["«entity»<br/>RefreshSession"]
    CHALLENGE["«entity»<br/>VerificationChallenge"]
    AUDIT["«entity»<br/>SecurityAudit"]

    U --> LOGIN
    LOGIN --> AUTHAPI
    AUTHAPI -->|login| AUTH
    AUTHAPI -->|refresh/logout| TOKEN
    AUTHAPI -->|forgot/reset| RESET
    AUTH --> USER
    AUTH --> TOKEN
    AUTH --> AUDIT
    TOKEN --> SESSION
    TOKEN --> USER
    TOKEN --> AUDIT
    RESET --> USER
    RESET --> CHALLENGE
    RESET --> SESSION
    RESET --> AUDIT

    classDef actor fill:transparent,stroke:transparent
```

## Trách nhiệm kiểm tra

- Boundary chỉ parse/validate shape, rate-limit context và chuyển correlation ID.
- Control xác thực credential/challenge, generic error, rotation/revoke và transaction boundary.
- User/Session/Challenge bảo toàn status, hash, expiry và replay invariant; Audit append-only.

