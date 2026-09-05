# 3.6 Test Design

Test Design xác định mức kiểm thử, traceability, dữ liệu/môi trường và evidence cần để kết luận đạt. Requirement `MUST` không hoàn thành nếu chỉ có code mà thiếu test phù hợp với rủi ro.

## Danh mục

- [3.6.1 Test strategy, environment và quality gate](./01-test-strategy.md)
- [3.6.2 Use Case traceability — 28/28](./02-use-case-traceability.md)
- [3.6.3 API, event contract và integration tests](./03-contract-integration-tests.md)
- [3.6.4 Concurrency, idempotency và recovery tests](./04-concurrency-recovery-tests.md)
- [3.6.5 Security, privacy và authorization tests](./05-security-privacy-tests.md)
- [3.6.6 Performance, reliability và observability tests](./06-performance-reliability-tests.md)
- [3.6.7 Test data, execution và evidence](./07-test-data-evidence.md)
- [3.6.8 FR/NFR/AC coverage register](./08-requirement-coverage-register.md)

## Exit criteria

- 100% UC và FR/NFR `MUST` có test/evidence hoặc approved exception có owner/expiry.
- Không còn failed critical path, concurrency, tenant isolation hoặc payment verification test.
- Contract/migration/security scan pass; load/fault/restore đạt baseline đã duyệt.
- Evidence truy vết được từ requirement → test case → run → artifact/log/metric.
