# Roadmap MVP — nhóm 4 người

## 1. Baseline thời gian

Roadmap dùng mốc kickoff dự kiến 2026-09-14. Nếu nhóm bắt đầu ngày khác, dịch toàn bộ sprint nhưng giữ thứ tự dependency. Mỗi sprint 2 tuần; tuần release cuối chỉ hardening và đóng evidence, không nhận feature mới.

Mỗi sprint có tối đa 32 PD tập trung. P0 là committed baseline; P1 chỉ kéo vào khi P0 được forecast an toàn hoặc phải dời tới sprint sớm nhất trước dependency. Không giảm Definition of Done để giữ ngày.

| Mốc | Thời gian | Scope chính | Demo/đầu ra bắt buộc |
|---|---|---|---|
| `M0 / S0` | 2026-09-14 → 2026-09-27 | Foundation & contract gate | Gateway health, local stack, migration, event smoke, Web/Mobile client compile |
| `M1 / S1` | 2026-09-28 → 2026-10-11 | Identity & tenant | Register/verify/login/profile chạy trên Web và Mobile; permission negative test |
| `M2 / S2` | 2026-10-12 → 2026-10-25 | Transport, Trip & search | Operator tạo/publish Trip; Customer tìm và xem Trip/seat snapshot |
| `M3 / S3` | 2026-10-26 → 2026-11-08 | SeatHold & Booking | Web/Mobile giữ ghế và tạo Booking atomically; concurrency evidence |
| `M4 / S4` | 2026-11-09 → 2026-11-22 | Payment & Ticket | Simulator/VNPay sandbox flow; webhook idempotent; Ticket hiển thị đúng |
| `M5 / S5` | 2026-11-23 → 2026-12-06 | Cancellation, Refund & Notification | Customer hủy/hoàn, retry/DLQ và notification không rollback giao dịch |
| `M6 / S6` | 2026-12-07 → 2026-12-20 | Operator, Driver & Trip cancellation | Manifest, QR/manual check-in, Trip transition và batch cancellation |
| `M7 / S7` | 2026-12-21 → 2027-01-03 | Admin & Reporting | Admin/audit lookup; revenue/booking/occupancy projection có `dataAsOf` |
| `M8 / S8` | 2027-01-04 → 2027-01-17 | Acceptance hardening | Full E2E, accessibility, security/performance/recovery và trace evidence |
| `Release` | 2027-01-18 → 2027-01-24 | Stabilization buffer | Release candidate, demo script, runbook, known issues và final acceptance |

### Capacity baseline

| Sprint | P0 committed | P1 stretch | Tổng backlog | Nhận xét |
|---|---:|---:|---:|---|
| `S0` | 19.5 PD | 6.5 PD | 26 PD | Có 6 PD buffer cho bootstrap/integration |
| `S1` | 28 PD | 8 PD | 36 PD | Chỉ kéo P1 sau checkpoint giữa sprint |
| `S2` | 31 PD | 10 PD | 41 PD | P1 phải refinement/carry-over; không commit cả 41 PD |
| `S3` | 31 PD | 4 PD | 35 PD | P0 gần đầy capacity vì concurrency |
| `S4` | 32 PD | 2 PD | 34 PD | Không nhận unplanned feature; giữ buffer bằng cách không kéo P1 |
| `S5` | 19 PD | 4 PD | 23 PD | Buffer cho provider/retry defects |
| `S6` | 23 PD | 2 PD | 25 PD | Buffer cho device và batch cancellation |
| `S7` | 23 PD | 2 PD | 25 PD | Buffer cho projection/rebuild defects |
| `S8` | 18 PD | 2 PD | 20 PD | Phần capacity còn lại dành cho defect phát hiện từ acceptance |

## 2. Kế hoạch theo sprint và vai trò

### S0 — Foundation & Contract Gate

| Vai trò | Kết quả chịu trách nhiệm |
|---|---|
| BE-1 | Solution/build baseline, Gateway health, error/correlation, Identity skeleton |
| BE-2 | Compose stack, database/message primitives, contract/migration smoke |
| FE | npm workspace, Customer/Back-office shells, generated client compile |
| MOBILE | React Native shell, navigation/theme/env, generated client compile |

**Exit gate:** build sạch; một request qua Gateway; migration từ database rỗng; publish/consume một event; generated TypeScript client compile trên Web/Mobile; CI chạy các gate trên môi trường hỗ trợ.

### S1 — Identity & Tenant

| Vai trò | Kết quả chịu trách nhiệm |
|---|---|
| BE-1 | `FR-IAM-001..009`, token rotation, tenant/permission, audit |
| BE-2 | SMTP notification adapter, Inbox/Outbox hỗ trợ verify/reset, integration test |
| FE | Register, verify, login, reset, profile và admin membership/role Web |
| MOBILE | Auth/profile Mobile, secure session, refresh/logout và deep-link verify |

**Exit gate:** `AC-AUTH-001..009`, `AC-PROFILE-001`, cross-tenant denial và enumeration-safe behavior có evidence.

### S2 — Transport, Trip & Search

| Vai trò | Kết quả chịu trách nhiệm |
|---|---|
| BE-1 | Organization/Bus/Seat/Driver/Route/Stop/Trip, conflict, assignment, search |
| BE-2 | `TripPublished → inventory → TripInventoryReady`, event reliability |
| FE | Back-office fleet/trip management; Customer search/detail/seat map |
| MOBILE | Customer search/detail/seat map; Driver assignment shell |

**Exit gate:** Trip chỉ sellable sau inventory ready; snapshot không đổi; tenant/conflict/version tests pass.

### S3 — SeatHold & Booking

| Vai trò | Kết quả chịu trách nhiệm |
|---|---|
| BE-1 | Search/Trip APIs ổn định, authorization review, test fixtures |
| BE-2 | `FR-BOOK-001..008,011`, atomic hold, server price, idempotency, expiry worker |
| FE | Seat selection, hold countdown, passenger/contact, booking confirmation |
| MOBILE | Cùng flow Customer trên Mobile với resume/retry an toàn |

**Exit gate:** `AC-SEAT-001..003`, `AC-BOOK-001..005`; test 2–50 client giữ cùng ghế; không trust total từ client.

### S4 — Payment & Ticket

| Vai trò | Kết quả chịu trách nhiệm |
|---|---|
| BE-1 | Gateway/security review, ticket ownership API, audit/correlation |
| BE-2 | `FR-PAY-001..009`, `FR-TICKET-001..003`, webhook, saga, Ticket issuance |
| FE | Checkout, provider redirect/return, `CONFIRMING`, booking/ticket history |
| MOBILE | Payment handoff/deep link, convergence polling, Ticket QR/detail |

**Exit gate:** `AC-PAY-001..006`, `AC-TICKET-001..002`; duplicate webhook 100 lần không tạo duplicate; broker-down recovery pass.

### S5 — Cancellation, Refund & Notification

| Vai trò | Kết quả chịu trách nhiệm |
|---|---|
| BE-1 | Ownership/tenant authorization và audit cho cancellation |
| BE-2 | Cancellation preview/confirm, Refund, Notification retry/DLQ, compensation |
| FE | Customer cancellation/refund và in-app notification |
| MOBILE | Customer cancellation/refund, notification state và deep link |

**Exit gate:** `AC-CANCEL-001..004`, `AC-NOTIF-001`; provider timeout, refund cap, notification failure và retry/DLQ có evidence.

### S6 — Operator, Driver & Trip Cancellation

| Vai trò | Kết quả chịu trách nhiệm |
|---|---|
| BE-1 | Manifest, check-in, Trip transition, assignment enforcement và cancellation batch |
| BE-2 | Trip cancellation → Refund/Notification event integration |
| FE | Operator manifest, Trip operation/cancellation và progress/error states |
| MOBILE | Driver manifest, QR/manual check-in và Trip transition |

**Exit gate:** `AC-OPS-005..006`, `AC-TICKET-003..005`, `AC-TRIP-001..002`; wrong-Trip, duplicate check-in và batch resume pass.

### S7 — Admin & Reporting

| Vai trò | Kết quả chịu trách nhiệm |
|---|---|
| BE-1 | Admin User/role/membership, lookup/audit và Reporting query |
| BE-2 | Reporting projection, dedupe/rebuild và projection-lag evidence |
| FE | Admin/audit lookup và Reporting Web có timezone/metric/`dataAsOf` |
| MOBILE | Customer/Driver regression và hỗ trợ contract acceptance |

**Exit gate:** Admin/Reporting MUST có evidence; tenant/permission, last-admin guard, projection replay và `dataAsOf` đúng.

### S8 — Acceptance Hardening

| Vai trò | Kết quả chịu trách nhiệm |
|---|---|
| BE-1 | Security/tenant/performance/observability defects |
| BE-2 | Recovery, retry/DLQ, reconciliation và backup/restore evidence |
| FE | Accessibility/responsive/full Web E2E và defect fix |
| MOBILE | Customer/Driver E2E, app-resume/offline/accessibility và defect fix |

**Exit gate:** toàn bộ 56 FR `MUST` có trace/evidence; full E2E pass; backup/restore, load, security, privacy và observability acceptance đạt.

## 3. Critical path

```text
Contract/build gate
→ Identity + tenant
→ Trip publish
→ Booking inventory ready
→ SeatHold + Booking
→ Payment success saga
→ Ticket
→ Cancellation/Refund + Check-in
→ Admin/Reporting projection
→ Acceptance
```

FE/Mobile không chờ backend hoàn tất mới làm UI: dùng generated type + mock adapter bám OpenAPI. Chỉ tích hợp thật khi contract route đạt `REVIEW` và có seed data.

## 4. Gate phát hành

- `G0 Build`: restore/build/lint/unit test sạch.
- `G1 Contract`: OpenAPI/AsyncAPI/JSON Schema compatible; generated clients compile.
- `G2 Data`: migration từ empty và upgrade test pass; không sửa migration đã phát hành tùy tiện.
- `G3 Integration`: PostgreSQL/RabbitMQ/provider failure path có test.
- `G4 Security`: permission, tenant, PII/log và session negative tests pass.
- `G5 UX`: loading/empty/error/retry, responsive/accessibility và Vietnamese copy hoàn chỉnh.
- `G6 Acceptance`: requirement → PR → test run → evidence truy vết đủ.

Không chuyển milestone chỉ vì demo happy path chạy. Exit gate của milestone hiện tại phải đạt hoặc có waiver được ghi trong risk register với owner và due date.
