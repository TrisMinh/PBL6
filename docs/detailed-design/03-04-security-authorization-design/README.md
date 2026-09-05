# 3.4 Security & Authorization Design

Security được thực thi theo defense-in-depth: edge giảm abuse, Gateway xác thực sơ bộ, nhưng service owner phải tự kiểm tra token, permission, tenant, ownership, state và dữ liệu đầu vào trước business action.

## Danh mục

- [3.4.1 Authentication, token và session](./01-authentication-token-session.md)
- [3.4.2 Permission matrix](./02-permission-matrix.md)
- [3.4.3 Tenant và resource authorization](./03-tenant-resource-authorization.md)
- [3.4.4 Webhook, service identity và secrets](./04-webhook-service-identity-secrets.md)
- [3.4.5 Data protection, logging và audit](./05-data-protection-logging-audit.md)
- [3.4.6 Threat model và security verification](./06-threat-model-verification.md)

## Trust boundaries

| Boundary | Không được tin trực tiếp |
|---|---|
| Browser/Mobile → Gateway | role/tenant/price/state trong body, redirect payment result |
| Gateway → Service | Gateway authorization thay service business authorization |
| Service → Service | Admin user token dùng thay workload identity |
| Payment Provider → Webhook | source IP/body/query status nếu chưa verify signature/replay |
| RabbitMQ → Consumer | type/version/payload/ordering/uniqueness nếu chưa validate/dedupe |
| Report/export | projection scope hoặc object URL nếu chưa recheck permission |

