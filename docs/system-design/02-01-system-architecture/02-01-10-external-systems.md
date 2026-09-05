# 2.1.10 External Systems

## 1. Danh mục tích hợp

| External system | Owner nội bộ | Giao thức | Dữ liệu trao đổi | Criticality |
|---|---|---|---|---|
| Payment Gateway | Payment Service | HTTPS API + signed webhook | Payment intent, provider reference, amount/currency, result | Cao |
| Email/Push Provider | Notification Service | HTTPS provider API/webhook khi có | Recipient/token, template/rendered content, delivery result | Trung bình; ngoài booking critical path |
| Object Storage | Reporting/Platform | Private HTTPS/S3-compatible API | Export file, object key, expiry metadata | Trung bình |
| Client platforms | Gateway/Identity | HTTPS; push token registration | Request, auth/session metadata, device/app version | Cao cho trải nghiệm, không phải nguồn business state |

Payment provider và notification provider nằm ngoài system boundary. Object Storage có thể là managed platform component; dù cách mua dịch vụ khác nhau, code vẫn coi nó là dependency qua port/adapter.

## 2. Payment Gateway integration

### 2.1 Outbound request

- Payment Service tạo idempotency key ổn định cho một logical payment/refund attempt.
- Amount/currency lấy từ trusted booking/payment snapshot, không lấy client làm nguồn sự thật.
- Connect/overall timeout và circuit breaker được cấu hình theo provider operation.
- Không retry mù quáng operation charge/refund khi chưa biết provider có idempotent hay không; ưu tiên query/reconciliation.

### 2.2 Inbound webhook

- Endpoint: `POST /integrations/payments/{provider}/webhooks`.
- Verify raw-body signature, timestamp/replay window, merchant/account và event ID.
- Persist webhook receipt và state transition trước khi trả 2xx.
- Duplicate webhook trả kết quả idempotent, không tạo event/ticket lần hai.
- Redirect/callback ở browser chỉ dùng UX, không xác nhận payment.

### 2.3 Failure modes

| Tình huống | Xử lý |
|---|---|
| Create intent timeout, chưa rõ kết quả | Đánh dấu `UNKNOWN/PROCESSING`, query provider; không tạo charge mới ngay |
| Webhook đến trễ | Process idempotent; Booking saga kiểm tra hold/seat và bù trừ nếu cần |
| Chữ ký/amount sai | Reject, security metric/alert; không phát `PaymentSucceeded` |
| Provider unavailable khi refund | Retry/reconciliation; Ticket vẫn cancelled, mở manual case khi quá ngưỡng |
| Payment success sau hold expiry | `PaymentCompensationRequested`; refund hoặc manual reconciliation, không phát ticket trùng |

Provider adapter chuẩn hóa lỗi nội bộ để business layer không phụ thuộc mã lỗi riêng của vendor.

## 3. Email/Push Provider integration

- Notification consume command/event sau khi business transaction đã commit.
- Delivery attempt có provider message ID, status, attempt count và sanitized error code.
- Timeout/429/5xx là transient theo provider policy; invalid token/address là permanent.
- Retry có backoff và tôn trọng provider quota/`Retry-After`; hết ngưỡng vào DLQ/manual review.
- Push token invalid được disable; email bounce/complaint cập nhật preference khi provider hỗ trợ.
- Notification failure không rollback Booking, Payment hoặc Ticket.

Không đưa secret, full payment detail hoặc identity document vào template/message. Link nhạy cảm phải có token ngắn hạn, one-time semantics khi phù hợp và không lộ ID đoán được.

## 4. Object Storage integration

- Export worker ghi file private; API chỉ trả signed URL ngắn hạn sau authorization.
- Object key không chứa PII; metadata và download được audit.
- File có checksum, content type, size limit và lifecycle/retention policy.
- Upload/download lỗi không làm thay đổi transaction nguồn; export job có `PENDING/RUNNING/SUCCEEDED/FAILED/EXPIRED`.

## 5. Anti-corruption layer

Mỗi external system có adapter nội bộ ánh xạ vendor DTO/error/status sang model ổn định:

```text
Domain/Application Port
    ↓
Provider Adapter
    ├── authentication/signature
    ├── request/response mapping
    ├── timeout/retry/circuit breaker
    └── sanitized telemetry
```

Thay provider chỉ thay adapter, config, migration/reconciliation plan và contract test; không làm vendor status lan vào Booking aggregate.

## 6. Contract testing và sandbox

- Có provider sandbox hoặc stub có khả năng mô phỏng timeout, duplicate, out-of-order và invalid signature.
- Contract test pin các field/signature rule đang dùng, không pin toàn SDK response không liên quan.
- Provider API/version deprecation có owner và deadline alert.
- Secret/key rotation được kiểm thử trước production.
- E2E staging dùng credential/provider environment riêng.

## 7. Vendor chưa khóa

Tên vendor payment, email/push, object storage và cloud chưa được khóa trong baseline. Việc chọn vendor cần ADR riêng dựa trên coverage Việt Nam, phí, sandbox/webhook, SLA, data residency, SDK quality và khả năng reconciliation.
