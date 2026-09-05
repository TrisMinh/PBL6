# 3.4.5 Data Protection, Logging và Audit

## Data handling matrix

| Data | Persist | Log/UI | Control |
|---|---|---|---|
| Password | Argon2id/bcrypt hash | Never | secret-safe memory handling |
| OTP/reset/refresh token | Hash + expiry/revoke | Never | one-time/rotation/rate limit |
| Access token | Không persist raw mặc định | Never | short TTL, signed claims |
| CCCD/license | Chỉ khi mục đích được duyệt; encrypt at rest | Mask | permission + access audit |
| Email/phone/passenger | Required fields only | Mask ngoài need-to-know | tenant/ownership + retention |
| PAN/CVV | Không lưu | Never | provider token/reference only |
| QR token | Hash hoặc signature | Chỉ QR/public code đúng owner | revoke by Ticket state |
| Provider reference | Metadata cần đối soát | Mask theo role | finance permission |
| Export | Private object + short expiry | Watermark/metadata nếu cần | recheck + download audit |

Encryption key không cùng quyền với encrypted DB dump. Key rotation và backup restore phải được test.

## Structured log contract

Required fields: UTC timestamp, service, environment, level, event/action, safe error code, correlation ID, trace ID, actor/service ID dạng safe, tenant ID khi allowed. Không log request/response body mặc định cho auth/payment/ticket/export.

Redaction deny-list tối thiểu: password, authorization/cookie, access/refresh/reset/OTP, CVV/PAN, QR token, full identity document, provider signature/secret.

## Audit events

Audit bắt buộc cho role/membership/user status, organization/Trip/fare/policy mutation, Booking override, Payment/Refund intervention, check-in, review moderation, support resolution, export PII download và DLQ replay.

Audit fields: actor ID hoặc workload identity, action, target type/ID, tenant, result, reason, timestamp UTC, correlation ID, source channel và safe metadata. Application actor thông thường không update/delete audit.

Debug log retention không quyết định audit retention. Audit read cần permission riêng và truy vấn cũng có access audit khi dữ liệu nhạy cảm.

