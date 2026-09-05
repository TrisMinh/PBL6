# 3.6.5 Security, Privacy và Authorization Tests

## Authentication/session

- Wrong issuer/audience/algorithm/signature, expired/not-yet-valid token → reject.
- Access token TTL ≤15 phút default; key rotation overlap accepts only approved keys.
- Refresh rotation concurrent/reuse test: one new session, reused token revokes family/audits per policy.
- Login failure threshold 5 and minimum 15-minute lock/delay; rate-limit headers/action safe.
- Forgot/register/resend response does not disclose identity existence.
- CSRF test if cookie auth; CORS exact-origin and credential behavior.

## Authorization negative matrix

| Actor A attempts resource B | Expected |
|---|---|
| Customer A reads/cancels Booking/Ticket of Customer B | Denied/no data leakage |
| Operator tenant A reads/mutates Bus/Route/Trip/report tenant B | Denied/no cross-tenant row |
| Driver without assignment opens manifest/transitions/checks in | Denied/no PII/state change |
| Operator without finance reads Payment/refund detail | Denied/masked |
| Admin missing explicit permission changes role/refund/replays DLQ | Denied + audit where appropriate |
| Actor changes `organizationId` body/query/header | Scope still derived from trusted context |
| User tries self privilege escalation/last-admin removal | Denied/state unchanged |

Tests assert response, DB state, audit and timing/body do not reveal cross-scope identifiers.

## Webhook/message

- Invalid/missing signature, altered raw body, stale timestamp, wrong merchant, duplicate event, wrong amount/currency/transaction.
- Malformed/oversized message, unknown type/version, event with sensitive forbidden fields.
- RabbitMQ credential cannot read/write/configure outside assigned resources.

## Privacy/log/export

- Automated scan logs/traces/errors for password, OTP, auth/cookie, token, PAN/CVV, QR secret, full document.
- Manifest contains only approved minimum fields and masking.
- Export creation/download enforces scope twice; signed URL expires; PII download audit exists.
- Backup/test fixture is synthetic/sanitized; lower environments cannot reach production secret/store.

## Security scan gate

SAST, dependency/SCA, container and secret scan. Critical finding blocks release unless approved risk has owner, mitigation and expiry; evidence stored with build artifact digest.

