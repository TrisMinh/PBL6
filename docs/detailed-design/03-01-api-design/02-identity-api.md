# 3.1.2 Identity API

Owner: Identity Service. Nguồn: `UC-AUTH-01..04`, `UC-PROFILE-01`, phần Identity của `UC-ADMIN-01`, `FR-IAM-*`.

## Authentication và profile endpoints

| Operation ID | Method/path | Auth | Idempotency | Success | Error chính |
|---|---|---|---|---:|---|
| `registerUser` | `POST /api/v1/auth/register` | Public | Optional/recommended | `202` | `VALIDATION_ERROR`, `IDENTITY_ALREADY_USED`, `RATE_LIMITED` |
| `verifyRegistration` | `POST /api/v1/auth/verify` | Public challenge | Required | `200` | `VERIFICATION_INVALID`, `VERIFICATION_EXPIRED`, `RATE_LIMITED` |
| `resendVerification` | `POST /api/v1/auth/resend-verification` | Public | Required | `202` | `RATE_LIMITED` |
| `login` | `POST /api/v1/auth/login` | Public | No | `200` | `INVALID_CREDENTIALS`, `ACCOUNT_LOCKED`, `RATE_LIMITED` |
| `refreshSession` | `POST /api/v1/auth/refresh` | Refresh token | Required | `200` | `SESSION_INVALID`, `SESSION_REUSE_DETECTED` |
| `logout` | `POST /api/v1/auth/logout` | Access/refresh | Required | `204` | `AUTHENTICATION_REQUIRED` |
| `forgotPassword` | `POST /api/v1/auth/forgot-password` | Public | Required | `202` | `RATE_LIMITED` |
| `resetPassword` | `POST /api/v1/auth/reset-password` | Public challenge | Required | `204` | `VERIFICATION_INVALID`, `VERIFICATION_EXPIRED`, `PASSWORD_POLICY_VIOLATION` |
| `getMyProfile` | `GET /api/v1/users/me` | User | No | `200` | `AUTHENTICATION_REQUIRED` |
| `updateMyProfile` | `PATCH /api/v1/users/me` | User | Recommended | `200/202` | `VALIDATION_ERROR`, `IDENTITY_ALREADY_USED`, `VERSION_CONFLICT` |

`register`, `forgot-password` và `resend-verification` trả response công khai không xác nhận định danh đã tồn tại. Audit nội bộ vẫn phân biệt outcome an toàn.

## DTO cốt lõi

### Register request

```json
{
  "fullName": "Nguyễn Văn A",
  "email": "a@example.com",
  "phone": "+84901234567",
  "password": "client-supplied-secret",
  "verificationChannel": "EMAIL"
}
```

Password chỉ tồn tại trong request TLS và vùng nhớ xử lý cần thiết; không log/echo/persist dạng rõ.

### Login response

```json
{
  "accessToken": "opaque-or-jws",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "refreshToken": "opaque-rotating-token",
  "sessionId": "01J...",
  "user": {
    "id": "user-1",
    "roles": ["CUSTOMER"],
    "organizationMemberships": []
  }
}
```

Web có thể nhận refresh token qua `HttpOnly; Secure; SameSite` cookie theo deployment decision; nếu dùng cookie phải có CSRF control. Mobile lưu trong secure storage.

### Update profile request

```json
{
  "fullName": "Nguyễn Văn A",
  "email": "new@example.com",
  "phone": "+84901234567",
  "expectedVersion": 4
}
```

Đổi email/phone tạo verification challenge; giá trị cũ còn hiệu lực đến khi xác minh thành công.

## Admin user, role và membership

| Operation ID | Method/path | Permission | Success |
|---|---|---|---:|
| `listUsers` | `GET /api/v1/admin/users` | `platform.user.read` | `200` |
| `getUser` | `GET /api/v1/admin/users/{userId}` | `platform.user.read` | `200` |
| `changeUserStatus` | `PATCH /api/v1/admin/users/{userId}/status` | `platform.user.manage` | `200` |
| `replaceUserRoles` | `PUT /api/v1/admin/users/{userId}/roles` | `platform.role.manage` | `200` |
| `listMemberships` | `GET /api/v1/admin/organizations/{organizationId}/members` | `platform.membership.read` | `200` |
| `addMembership` | `POST /api/v1/admin/organizations/{organizationId}/members` | `platform.membership.manage` | `201` |
| `changeMembership` | `PATCH /api/v1/admin/organizations/{organizationId}/members/{membershipId}` | `platform.membership.manage` | `200` |

Mutation request bắt buộc `reason`, `expectedVersion` và audit. Không cho actor tự nâng quyền; không được vô hiệu/xóa platform admin cuối cùng. Khi khóa User hoặc giảm quyền nhạy cảm, revoke các session liên quan.

## Service contract

- Token claim tối thiểu: `sub`, `sid`, `roles`, tenant membership IDs/scopes, `iat`, `exp`, `jti`, issuer/audience.
- Service business tự kiểm tra permission và resource scope; token không chứa profile PII không cần thiết.
- Identity không sở hữu Organization profile; `organizationId` là external ID được xác nhận qua projection/contract với Transport.

