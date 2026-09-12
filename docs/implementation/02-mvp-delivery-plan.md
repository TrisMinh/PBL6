# Kế hoạch triển khai MVP theo vertical slice

Không xây xong từng “layer ngang” rồi mới tích hợp. Mỗi slice phải đi qua UI/API/domain/database/message/test và tạo evidence truy vết.

## Slice 0 — Foundation và contract gate

**Mục tiêu:** repository build được, hạ tầng local khởi động được và contract trở thành nguồn sinh client/test.

- Tạo solution, app/service skeleton theo cấu trúc chuẩn.
- Docker Compose: PostgreSQL, RabbitMQ, Redis, Mailpit và payment simulator.
- Correlation/error envelope, health/readiness, structured log và secret/config convention.
- OpenAPI/JSON Schema lint, database migration từ empty, unit/integration test trong CI.
- Seed permission/role và synthetic tenant/user/trip data; không commit secret.

**Exit:** một API health qua Gateway, một migration/service, một event publish/consume test và generated TypeScript client compile.

## Slice 1 — Identity và tenant foundation

Phạm vi: `FR-IAM-001..009`, trừ capability không phải MUST nếu có.

- Register + email verification, login, refresh rotation, logout, reset password, profile.
- Admin quản lý User/Organization membership/role.
- Token claim, permission/tenant context, revoke và security audit.
- Email verification qua Notification/SMTP adapter.

**Critical tests:** enumeration-safe response, lockout/rate limit, refresh reuse, self-escalation và cross-tenant denial.

## Slice 2 — Transport search và Trip publishing

Phạm vi: `FR-SEARCH-001..006`, `FR-OPS-001..010` phần Transport.

- Organization, Bus/Seat, Driver, Route/Stop, Trip draft/publish/operate.
- Schedule conflict bằng PostgreSQL exclusion constraint.
- `TripPublished → Booking inventory → TripInventoryReady → sellable=true`.
- Public search/detail/stops và operator/driver assignments.

**Critical tests:** tenant isolation, sold snapshot bất biến, route precedence, version conflict và Trip không mở bán trước inventory ready.

## Slice 3 — SeatHold và Booking

Phạm vi: `FR-BOOK-001..008`, `FR-BOOK-011`.

- Trip snapshot/TripSeat, transaction window 10 phút, atomic multi-seat hold.
- Booking contact, Passenger/item mapping, server price calculation và expiry.
- Idempotency record và release/expiry worker.

**Critical tests:** 2–50 client giữ cùng ghế, all-or-nothing nhiều ghế, same-key/same-body, same-key/different-body và expiry không gia hạn.

## Slice 4 — Payment và Ticket

Phạm vi: `FR-PAY-001..009`, `FR-TICKET-001..003`.

- VNPay Sandbox adapter và deterministic simulator.
- Payment intent, raw webhook signature/replay/dedupe, Outbox/Inbox.
- `PaymentSucceeded` saga tạo Booking PAID, TripSeat BOOKED và đúng một Ticket/item.
- UI presentation state `CONFIRMING`; convergence theo `NFR-CONS-007`.

**Critical tests:** wrong amount/currency/signature, duplicate webhook 100 lần, late success/seat lost, broker down và crash-after-commit-before-ACK.

## Slice 5 — Cancellation, Refund và Notification

Phạm vi: `FR-BOOK-009`, `FR-PAY-008`, `FR-NOTIF-001..002`.

- Cancellation preview/confirm theo policy snapshot 24h/6h/2h.
- Refund request/provider lifecycle/cap/idempotency.
- In-app + SMTP email cho các sự kiện giao dịch bắt buộc.
- Retry/DLQ và trạng thái manual reconciliation có thể tra cứu/audit.

**Critical tests:** preview stale, refund cap concurrency, provider timeout, notification failure không rollback giao dịch và Trip cancellation hoàn 100%.

## Slice 6 — Operator/Driver hoàn chỉnh

Phạm vi: manifest, Trip transition, QR/manual-code check-in và Trip cancellation có vé.

- Manifest tối thiểu theo tenant/assignment.
- Ticket validate/check-in idempotent và audit.
- Trip cancellation batch có checkpoint/resume, refund và notification.

**Critical tests:** sai Trip, không assignment, Ticket cancelled/used, duplicate check-in và worker crash giữa batch.

## Slice 7 — Admin và Reporting MUST

Phạm vi: `FR-ADMIN-001..002`, `FR-REPORT-001..002`.

- Tra cứu Booking/Payment/Refund/audit theo permission/scope.
- Revenue, Booking và occupancy projection có `dataAsOf`, timezone và metric definition.
- Không có CSV export/SupportCase API trong MVP vì là `SHOULD`.

## Slice 8 — Web, Mobile và acceptance hardening

- Customer Web và React Native hoàn tất toàn bộ Customer MUST.
- Back-office hoàn tất Admin/Operator/Driver MUST và responsive cho Driver.
- Accessibility, error/loading/empty/retry, localization tiếng Việt.
- E2E, load, failure, security, backup/restore và trace evidence.

## Backlog sau MVP

- Ticket change.
- Promotion/voucher.
- Review/moderation.
- Push/SMS và Notification preference.
- Automated reconciliation job/API.
- SupportCase.
- CSV export/Object Storage.
- GPS, AI recommendation, loyalty và dynamic pricing.

## Definition of Ready cho một slice

- Requirement/AC/Business Rule/state được link bằng ID.
- OpenAPI/message schema và migration draft đã review.
- UI screen/state/error contract có trong screen map.
- Test cases gồm happy, validation, permission, concurrency/idempotency/failure phù hợp.
- Không còn decision “TBD” làm thay đổi schema/contract.

## Definition of Done

- Code, migration, contract, docs và generated client đồng bộ.
- Unit/component/integration/contract/E2E phù hợp pass.
- Authorization/tenant negative test pass.
- Log/metric/trace/audit không chứa secret/PII cấm.
- Image build non-root, health/readiness hoạt động và Compose smoke pass.
- Requirement coverage có test run/evidence, không chỉ tên suite.
