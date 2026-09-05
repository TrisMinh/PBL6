# Identity Domain/Class Diagram

Owner: Identity Service. `organizationId` trong Membership/UserRole là external reference đến Organization do Transport Service sở hữu.

```mermaid
classDiagram
    class User {
        <<AggregateRoot>>
        +UUID id
        +Email email
        +Phone phone
        +string passwordHash
        +UserStatus status
        +datetime verifiedAt
        +activate()
        +changePassword()
        +disable(reason)
    }
    class VerificationChallenge {
        +UUID id
        +ChallengeType type
        +string tokenHash
        +datetime expiresAt
        +int failedAttempts
        +verify(value)
        +expire()
    }
    class RefreshSession {
        +UUID id
        +string tokenHash
        +datetime expiresAt
        +datetime revokedAt
        +rotate()
        +revoke(reason)
    }
    class Role {
        <<AggregateRoot>>
        +UUID id
        +string code
        +RoleScope scope
        +grant(permission)
        +revoke(permission)
    }
    class Permission {
        +UUID id
        +string resource
        +string action
    }
    class UserRole {
        +UUID userId
        +UUID roleId
        +UUID organizationId
        +revoke()
    }
    class OrganizationMembership {
        +UUID userId
        +UUID organizationId
        +MembershipStatus status
        +activate()
        +revoke()
    }
    class SecurityAudit {
        <<AppendOnly>>
        +UUID actorUserId
        +string action
        +string targetRef
        +UUID correlationId
        +datetime occurredAt
    }

    User "1" *-- "0..*" VerificationChallenge : challenges
    User "1" *-- "0..*" RefreshSession : sessions
    User "1" *-- "0..*" UserRole : assignments
    Role "1" o-- "0..*" UserRole : assigned through
    Role "0..*" o-- "0..*" Permission : grants
    User "1" *-- "0..*" OrganizationMembership : memberships
    User "0..1" --> "0..*" SecurityAudit : acts in
```

## Boundary rules

- Credential/token chỉ lưu dạng hash khi có thể; challenge có expiry và giới hạn thử.
- Role tenant yêu cầu `organizationId`; Role platform không được vô tình giới hạn bởi body/query tenant.
- Vô hiệu User hoặc thay đổi quyền nhạy cảm phải thu hồi session phù hợp và ghi audit.
