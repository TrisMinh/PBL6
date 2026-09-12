# Configuration Baseline

Giá trị dưới đây là mặc định kiểm thử/nghiệm thu MVP. Secret không nằm trong file config commit; production override qua secret/config provider. Thay đổi policy nghiệp vụ phải tăng policy version và không sửa snapshot cũ.

## Identity

| Key | Default | Ghi chú |
|---|---:|---|
| `Identity:AccessTokenMinutes` | 15 | Không vượt NFR-SEC-003 |
| `Identity:RefreshTokenDays` | 30 | Rotating token; revoke/reuse detection |
| `Identity:EmailVerificationMinutes` | 30 | Single-use challenge, lưu hash |
| `Identity:PasswordResetMinutes` | 15 | Response không lộ account existence |
| `Identity:LoginFailureThreshold` | 5 | Theo NFR-SEC-005 |
| `Identity:LockoutMinutes` | 15 | Minimum baseline |
| `Identity:PasswordHash:MemoryKiB` | 19456 | Argon2id, parameter có version |
| `Identity:PasswordHash:Iterations` | 2 | Argon2id baseline |
| `Identity:PasswordHash:Parallelism` | 1 | Giới hạn memory burst khi login đồng thời |
| `Identity:PasswordHash:SaltBytes` | 16 | Random riêng mỗi password |
| `Identity:PasswordHash:OutputBytes` | 32 | Lưu cùng PHC-format metadata |

## Booking và pricing

| Key | Default | Ghi chú |
|---|---:|---|
| `Booking:TransactionWindowMinutes` | 10 | Tính từ SeatHold creation; Booking không gia hạn |
| `Booking:IdempotencyRetentionHours` | 24 | Payment/Refund có retention dài hơn theo reconciliation lifecycle |
| `Booking:ExpiryWorkerIntervalSeconds` | 5 | Worker chỉ là proactive cleanup; request path vẫn kiểm tra expiry |
| `Booking:SeatOwnershipMode` | `WHOLE_TRIP` | Không segment inventory trong MVP |
| `Pricing:Currency` | `VND` | Integer đồng, không float |
| `Pricing:Rounding` | `HALF_UP` | Áp cho fee/discount/refund |
| `Cancellation:PolicyVersion` | `cancel-mvp-v1` | Tier 24h/6h/2h trong SRS 11.5.1 |
| `Cancellation:PreviewMinutes` | 5 | Confirm quá hạn phải preview lại |

## Payment

| Key | Default | Ghi chú |
|---|---:|---|
| `Payment:Provider` | `VNPAY_SANDBOX` | Local/CI có thể dùng `SIMULATOR` cùng port/contract |
| `Payment:ConnectTimeoutSeconds` | 3 | Không retry charge mù quáng |
| `Payment:OverallTimeoutSeconds` | 10 | Timeout giữ trạng thái PROCESSING nếu outcome chưa chắc chắn |
| `Payment:WebhookReplayWindowMinutes` | 5 | Còn phải dedupe external event/transaction ID |
| `Payment:WebhookMaxBodyBytes` | 262144 | Verify raw body trước deserialize |
| `Payment:BookingConvergenceP95Seconds` | 5 | NFR-CONS-007 |
| `Payment:BookingConvergenceP99Seconds` | 30 | Quá ngưỡng alert/retry/manual case |

## RabbitMQ và worker

| Key | Default | Ghi chú |
|---|---:|---|
| `Messaging:RetryTiers` | `5s,30s,5m` | Không hot requeue |
| `Messaging:RetryAttemptsPerTier` | `1,2,3` | Hết tổng 6 retry vào DLQ |
| `Messaging:Prefetch` | 20 | Tuning sau load test; handler vẫn idempotent |
| `Outbox:BatchSize` | 100 | Claim bằng `FOR UPDATE SKIP LOCKED` |
| `Outbox:PollIntervalMilliseconds` | 500 | Alert theo oldest pending age |

## HTTP và UI

| Key | Default | Ghi chú |
|---|---:|---|
| `Api:DefaultPageSize` | 20 | Common contract |
| `Api:MaxPageSize` | 100 | Enforce server-side |
| `Api:MinimumViewportPx` | 360 | Customer/Back-office responsive |
| `Api:DefaultTimezone` | `Asia/Ho_Chi_Minh` | Persist UTC; API ISO-8601 offset |
| `Reporting:MaxRangeDays` | 366 | Query vượt giới hạn trả validation; không tự tạo ExportJob MVP |
| `Features:TicketChange` | `false` | SHOULD |
| `Features:Promotion` | `false` | SHOULD |
| `Features:Review` | `false` | SHOULD |
| `Features:PushNotification` | `false` | SHOULD |
| `Features:SmsNotification` | `false` | COULD |
| `Features:ReportExport` | `false` | SHOULD |
| `Features:AutomatedReconciliation` | `false` | SHOULD |
| `Features:SupportCase` | `false` | SHOULD |

## Environment rule

- `appsettings.json` chỉ chứa default không nhạy cảm.
- Local secret dùng user-secrets hoặc `.env` bị ignore; CI/shared environment dùng secret injection.
- Startup fail-fast khi thiếu issuer/audience/signing key/DB/Rabbit/provider credential thiết yếu.
- Log startup chỉ ghi tên key và source an toàn, không ghi secret value/connection string.
- Một artifact/image được dùng qua các môi trường; không build lại theo environment.
