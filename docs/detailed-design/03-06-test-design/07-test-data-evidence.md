# 3.6.7 Test Data, Execution và Evidence

## Minimum synthetic dataset

- Tenant A/B có Bus, Driver, Route, Stop, Trip và role/membership tách biệt.
- Customer A/B, active/locked/unverified users và session/challenge fixtures.
- Trip ở mọi state, TripSeat AVAILABLE/HELD/BOOKED/DISABLED, SeatHold active/expired.
- Booking/Payment/Ticket/Refund ở mọi state hợp lệ; provider signed/invalid/duplicate/late fixtures.
- Promotion near quota boundary, Ticket USED/reviewed, Notification retry, stale Reporting projection.
- Performance dataset ≥100,000 Trip với phân bố ngày/route/operator/price/seat gần thực tế, không chỉ dữ liệu đồng đều.

Clock-dependent test dùng controllable clock, không sleep dài. ID/time/random/provider keys deterministic theo test seed nhưng không dùng production secret.

## Test case record

Mỗi test case có: ID/version, requirement/AC links, risk/priority, precondition/data, steps/input, expected result ở API + durable state + message/audit/metric, cleanup và automation status.

## Run evidence

| Evidence | Required metadata |
|---|---|
| Test report | commit/artifact digest, environment/config, start/end, pass/fail/skipped |
| API/contract | spec/schema version, compatibility diff |
| Concurrency | worker count/barrier, DB invariant queries, duplicate count |
| Load | scenario, dataset, topology, percentiles/errors/resource graphs |
| Security scan | tool/ruleset/database timestamp, findings/risk approvals |
| Fault/restore | injected fault timeline, backlog/convergence, RPO/RTO/checksum |
| Trace/audit | redacted correlation chain and required audit fields |

## Defect and exception policy

- Critical invariant/security/payment/tenant defect blocks release.
- Skipped/flaky critical test counts as not passed.
- Requirement exception cần owner, rationale, risk, mitigation, expiry và approval; trace matrix giữ liên kết.
- Evidence immutable/read-only theo project capability và không chứa production PII/secret.

## Final acceptance checklist

- 28/28 UC mapped; 66 FR and every NFR MUST covered by suite/query.
- MUST acceptance criteria pass; SHOULD scope decision recorded.
- Migration upgrade/rollback compatibility and backup restore evidence present.
- Error code/OpenAPI/event catalog versions match deployed artifact.
- No unresolved trace gap, secret leak or unowned DLQ/manual case.

