# 3.4.1 Authentication, Token và Session

## Password

- Hash bằng Argon2id hoặc bcrypt được benchmark trên production-like hardware; target cost đủ chậm để chống brute force nhưng không phá SLO/login capacity.
- Per-password salt từ library; optional pepper từ secret store, không nằm trong DB/repository.
- Không log password, hash, strength input hoặc raw credential.
- Password policy kiểm tra độ dài, block common/compromised pattern theo capability được duyệt; không ép rotation định kỳ vô nghĩa nếu không có incident/policy.

## Access token

| Claim | Mục đích |
|---|---|
| `iss`, `aud` | Chặn token sai issuer/audience |
| `sub` | User ID |
| `sid`, `jti` | Session/token identity, incident trace/revoke support |
| `iat`, `nbf`, `exp` | Time validity; mặc định TTL ≤15 phút |
| `roles`/`permissions` | Capability coarse-grained |
| tenant memberships/scopes | Candidate tenant scope; resource owner vẫn được kiểm tra server-side |

Token ký bằng asymmetric key khi nhiều verifier; verifier pin issuer/audience/algorithm/key ID và hỗ trợ key rotation overlap. Không chấp nhận `alg=none`, thuật toán ngoài allow-list hoặc key từ untrusted header URL.

## Refresh session rotation

- Refresh token opaque, entropy đủ mạnh, lưu hash; Mobile secure storage, Web ưu tiên HttpOnly/Secure/SameSite cookie nếu chọn cookie model.
- Mỗi refresh atomically revoke token cũ và cấp token mới liên kết `replacedBy`.
- Reuse token đã rotate là tín hiệu replay: revoke session family theo policy, audit và yêu cầu đăng nhập lại.
- Logout revoke refresh session hiện tại; khóa User/giảm quyền nhạy cảm revoke các session liên quan.
- Access token ngắn hạn có thể còn hiệu lực đến expiry; action cực nhạy cảm kiểm tra session/user status hoặc token version theo risk decision.

## Verification/reset challenge

- OTP/token lưu hash, one-time consume, expiry, attempt limit và rate limit theo identifier + IP/device signal.
- Forgot/resend response giống nhau dù identity tồn tại hay không.
- Thay email/phone chỉ commit định danh mới sau verify; giá trị cũ còn hiệu lực nếu challenge thất bại.

## Abuse controls

Sau 5 login failure liên tiếp khóa/làm chậm ít nhất 15 phút theo policy. Rate limit tách login, register, OTP resend/verify, reset và webhook. Redis có thể giữ counter nhanh nhưng security outcome/audit quan trọng phải bền vững và tránh fail-open không kiểm soát.

Nếu Web dùng cookie auth, mutation cần CSRF token/origin checking; nếu Bearer token trong header, vẫn cấu hình CORS exact origin/method/header và không dùng wildcard với credential.

