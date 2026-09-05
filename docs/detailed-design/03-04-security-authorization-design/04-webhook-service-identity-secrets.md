# 3.4.4 Webhook, Service Identity và Secrets

## Payment webhook verification

1. Edge áp TLS, body size/rate/source control nhưng không quyết định hợp lệ nghiệp vụ.
2. Payment endpoint đọc raw body và required headers.
3. Resolve provider configuration bằng allow-list path; không chọn arbitrary callback class/URL.
4. Verify signature constant-time bằng active/overlap key.
5. Kiểm tra signed timestamp/replay window, merchant/account, external event ID.
6. Parse schema rồi match provider transaction với Payment intent, amount và currency.
7. Persist WebhookReceipt + state + Outbox atomically; duplicate hợp lệ trả idempotent 2xx.
8. Invalid/mismatch không phát success, ghi safe metric/audit/reconciliation case phù hợp.

Redirect/deep link không được gọi internal success handler.

## Service identity

| Channel | Authentication baseline |
|---|---|
| Gateway → service | Signed workload token hoặc private network + mTLS khi hạ tầng hỗ trợ |
| Service → service | Service account/workload identity, audience-scoped short token |
| Service → RabbitMQ | User/credential riêng mỗi service, TLS, vhost permission tối thiểu |
| Service → PostgreSQL | DB role riêng, chỉ schema/database owner |
| Service → provider | Secret/API key từ secret store, controlled egress |

Không forward Admin token làm service credential. Actor context và workload identity là hai bằng chứng khác nhau và phải log/audit tách.

## RabbitMQ least privilege

- Producer write đúng exchange, không read queue.
- Consumer read/ack queue của mình; write retry/DLX/outbox publisher đúng exchange cần thiết.
- Service không `configure` resource production ngoài topology deployment role.
- Management UI chỉ private/admin network, MFA/SSO nếu capability có.

## Secret lifecycle

- Secret không commit, bake vào image, log, trace, exception hoặc client bundle.
- Inject runtime qua secret manager; rotation hỗ trợ overlap với key ID/version.
- Separate secret theo environment/service/provider và audit access.
- Leak response: revoke/rotate, identify exposure window, invalidate affected sessions/messages, audit incident; không chỉ xóa Git history.

