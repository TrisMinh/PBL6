# 2.1.8 Security Architecture

## 1. Security principles

- Deny by default và least privilege cho user, service, database, RabbitMQ và hạ tầng.
- Gateway là enforcement point đầu tiên, nhưng mỗi service vẫn kiểm tra authentication context, action, ownership và tenant scope.
- Không tin client state, callback query parameter hoặc payment redirect để quyết định business state.
- Secret/PII không xuất hiện trong source code, image, URL, message payload không cần thiết hoặc application log.
- Mọi hành động quản trị, payment/refund, role và DLQ replay đều có audit.

## 2. Trust zones và luồng cho phép

| Zone | Thành phần | Ingress cho phép |
|---|---|---|
| Public | Web, Mobile, Back-office, provider webhook | HTTPS tới WAF/Gateway hoặc webhook endpoint được công bố |
| Edge | WAF, reverse proxy, API Gateway | Public HTTPS; egress có kiểm soát tới Application zone |
| Application | Business service, workers | Chỉ từ Gateway, service identity hoặc RabbitMQ theo policy |
| Data | PostgreSQL, Redis, RabbitMQ management/data | Chỉ private network từ workload/operator được cấp quyền |
| Operations | CI/CD, secret store, observability, admin access | Identity quản trị mạnh, audit và network restriction |

Database, Redis, AMQP và RabbitMQ management UI không public Internet.

## 3. Authentication và session

- Password hash bằng Argon2id hoặc bcrypt với work factor được benchmark/quản lý; không dùng SHA/MD5 thuần.
- Access token ngắn hạn, mặc định không quá 15 phút; ký bất đối xứng để service verify mà không giữ signing key.
- Refresh token rotation, revoke và reuse detection; chỉ lưu dạng hash nếu thiết kế cho phép.
- Mobile dùng secure platform storage; Web ưu tiên HttpOnly, Secure, SameSite cookie khi phù hợp và có CSRF protection.
- Login/OTP/reset có rate limit, generic error message và lock/delay policy sau nhiều lần thất bại.
- Key rotation hỗ trợ overlap `kid` để không làm gián đoạn token hợp lệ.

## 4. Authorization

Mô hình kết hợp RBAC và resource/tenant check:

```text
allow = authenticated
    AND role permits action
    AND resource belongs to permitted organization/customer
    AND resource state permits transition
```

- Role baseline: Customer, Driver, Operator Staff, Admin.
- Organization membership chứa tenant scope; không nhận `organizationId` từ body làm bằng chứng quyền.
- Customer chỉ truy cập booking/ticket của mình trừ flow tra cứu có proof riêng được duyệt.
- Driver chỉ truy cập trip/manifest được phân công.
- Admin privilege được tách theo action nhạy cảm nếu triển khai thực tế yêu cầu.

## 5. Service-to-service security

- Public identity không tự động trao mọi quyền cho downstream; truyền claims tối thiểu và audience phù hợp.
- Internal call qua network không tin cậy dùng TLS; production có thể dùng mTLS/workload identity nếu hạ tầng hỗ trợ.
- Service account riêng cho mỗi workload; không dùng chung database/RabbitMQ credential.
- Egress tới provider theo allowlist DNS/network khi khả thi; timeout và certificate validation bắt buộc.

## 6. RabbitMQ security

- Vhost `/bus-ticket`, user riêng theo service và permission regex nhỏ nhất.
- Producer chỉ write exchange cần thiết; consumer chỉ read queue thuộc mình; configure topology do deployment/admin account hoặc policy được duyệt.
- AMQPS/TLS ở môi trường shared/production; management API/UI tách network và bật MFA/SSO nếu sản phẩm hỗ trợ.
- Giới hạn connection, channel, message size và queue policy để giảm DoS.
- DLQ có thể chứa dữ liệu nghiệp vụ: giới hạn quyền xem/replay và audit mọi replay/purge.

## 7. Payment và webhook security

1. Nhận raw body để verify chữ ký theo đúng provider specification.
2. Kiểm tra timestamp/replay window, event ID, merchant/account, amount và currency.
3. Persist `WebhookReceipt` trước khi acknowledge; duplicate trả response idempotent.
4. Không tin success redirect từ browser; chỉ signed server webhook hoặc reconciliation xác nhận payment.
5. Không log signature, token hoặc full payload nếu chứa PII.
6. Refund dùng server-side amount từ policy/snapshot, không dùng amount do client tự khai.

## 8. Application và API controls

- Schema/input validation và allowlist state transition.
- Parameterized query/ORM an toàn; encode output Web; CSP và security headers phù hợp.
- CORS allowlist theo môi trường; request body/file size limit.
- Idempotency key gắn với actor, endpoint và normalized request hash để ngăn reuse sai payload.
- Error response không lộ stack trace, SQL, topology hoặc account enumeration.
- Dependency/container scan trong CI; critical finding phải fix hoặc có risk acceptance.

## 9. Data, logging và audit

| Loại | Bảo vệ |
|---|---|
| Password/OTP/token/CVV | Không log; password chỉ lưu hash; CVV không lưu |
| Identity document | Mã hóa/mask; access audit |
| Passenger/contact | Least privilege, retention và redact log |
| Payment reference | Không phải card data nhưng vẫn access-controlled và audit |
| Audit log | Append-oriented, tách debug log, time-synchronized và quyền đọc hạn chế |

Audit event tối thiểu có actor/service identity, action, target, tenant, result, timestamp UTC, correlation ID và nguồn request. Audit không ghi secret hoặc full before/after nếu chứa dữ liệu nhạy cảm.

## 10. Security verification

- Unit/integration test cho authorization matrix và tenant isolation.
- Test replay/duplicate webhook, idempotency key reuse và signature invalid.
- SAST, dependency scan, container scan và secret scan trong CI.
- DAST/pentest tập trung auth, booking ownership, payment/refund và admin API trước release lớn.
- Restore/replay test không được làm lộ production data sang môi trường thấp hơn.
