# Product Backlog

Backlog này phân rã [MVP delivery plan](../docs/implementation/02-mvp-delivery-plan.md) thành card có thể giao cho một người. Chi tiết checklist cho sprint đang chạy nằm trong `board/sprint-*.md`; board chỉ chứa trạng thái hiện tại, không nhân bản toàn bộ mô tả.

## Quy ước

- Priority: `P0` chặn luồng/acceptance, `P1` cần cho milestone, `P2` cải tiến nếu còn capacity.
- Estimate dùng person-day (`PD`), đã gồm code + test + docs + review fix.
- `Depends` dùng ID card; `—` nghĩa là có thể bắt đầu khi sprint mở.
- Trace dùng phạm vi FR/AC hoặc tài liệu nguồn; owner phải bổ sung link PR/test evidence trước khi Done.

## EP-00 — Foundation & Contract Gate (`S0`)

| ID | P | Owner | PD | Depends | Deliverable / tiêu chí chấp nhận |
|---|---|---|---:|---|---|
| `S0-TEAM-01` | P0 | TEAM | 0.5 | — | Điền tên, owner, reviewer; thống nhất `main/develop/feature` và WIP |
| `S0-TEAM-02` | P0 | TEAM | 0.5 | — | Kiểm tra .NET/Node/npm/Docker/Android; ghi version và blocker |
| `S0-BE1-01` | P0 | BE-1 | 2 | — | Tạo solution, build props/package baseline và test architecture tối thiểu |
| `S0-BE1-02` | P0 | BE-1 | 1 | `S0-BE1-01` | Gateway route `/health`; error/correlation contract qua một API |
| `S0-BE1-03` | P0 | BE-1 | 2 | `S0-BE1-01` | Shared primitives cho result/error, correlation, telemetry và test fixture |
| `S0-BE1-04` | P1 | BE-1 | 1.5 | `S0-BE1-03` | Identity service skeleton + initial migration + health/readiness |
| `S0-BE2-01` | P0 | BE-2 | 2 | — | Compose cho PostgreSQL, RabbitMQ, Redis, Mailpit, payment simulator |
| `S0-BE2-02` | P0 | BE-2 | 1.5 | `S0-BE2-01` | Database bootstrap/migration smoke từ empty, healthcheck và volume convention |
| `S0-BE2-03` | P0 | BE-2 | 2 | `S0-BE1-03`, `S0-BE2-01` | Event envelope, publisher/consumer smoke, Inbox/Outbox skeleton |
| `S0-BE2-04` | P0 | BE-2 | 1 | — | Script/gate validate OpenAPI, AsyncAPI, JSON Schema và SQL baseline |
| `S0-FE-01` | P0 | FE | 1 | — | Root npm workspace + TypeScript/Vite/test/lint baseline |
| `S0-FE-02` | P1 | FE | 1.5 | `S0-FE-01` | Customer Web và Back-office Web shells có route/error boundary |
| `S0-FE-03` | P0 | FE | 1 | `S0-FE-01`, `S0-BE2-04` | Sinh OpenAPI client, compile và gọi health qua adapter |
| `S0-FE-04` | P1 | FE | 1 | `S0-FE-02` | Token, typography, form/button/loading/empty/error base states |
| `S0-MOB-01` | P0 | MOBILE | 2 | — | React Native app target Android build được theo baseline |
| `S0-MOB-02` | P1 | MOBILE | 1.5 | `S0-MOB-01` | Navigation, environment, secure-session abstraction và error boundary |
| `S0-MOB-03` | P0 | MOBILE | 1 | `S0-MOB-01`, `S0-BE2-04` | Generated API client compile và health adapter test |
| `S0-MOB-04` | P1 | MOBILE | 1 | `S0-MOB-02` | Theme + loading/empty/error/retry primitives |
| `S0-TEAM-03` | P0 | TEAM | 2 | Tất cả P0 S0 | CI restore/build/lint/test + Compose/API/event/client smoke evidence |

Trace: [repository structure](../docs/implementation/01-repository-structure.md), [configuration baseline](../docs/implementation/03-configuration-baseline.md), [prerequisites](../docs/implementation/05-development-prerequisites.md).

## EP-01 — Identity & Tenant (`S1`)

| ID | P | Owner | PD | Depends | Deliverable / trace |
|---|---|---|---:|---|---|
| `S1-BE1-01` | P0 | BE-1 | 2 | `S0-BE1-04` | User/credential/session/membership schema + migration |
| `S1-BE2-04` | P0 | BE-2 | 3 | `S1-BE1-01` | Register, email verification/resend; `FR-IAM-001..002` |
| `S1-BE1-03` | P0 | BE-1 | 3 | `S1-BE1-01` | Login, refresh rotation/reuse, logout; `FR-IAM-003..005` |
| `S1-BE2-05` | P0 | BE-2 | 2 | `S1-BE1-01` | Reset password và profile; `FR-IAM-006..007` |
| `S1-BE1-05` | P0 | BE-1 | 3 | `S1-BE1-03` | Role/membership, tenant context, revoke/audit; `FR-IAM-008..009` |
| `S1-BE2-01` | P1 | BE-2 | 2 | `S1-BE2-04` | SMTP/Mailpit adapter cho verify/reset; failure không rollback domain |
| `S1-BE2-02` | P0 | BE-2 | 2 | `S0-BE2-03`, `S1-BE2-04` | Outbox → Notification integration, dedupe và retry test |
| `S1-BE2-03` | P0 | BE-2 | 2 | `S1-BE1-05` | Integration/security fixtures: enumeration, lockout, cross-tenant |
| `S1-FE-01` | P0 | FE | 2 | `S1-BE2-04` | Register/verify/resend screens và validation states |
| `S1-FE-02` | P0 | FE | 2 | `S1-BE1-03` | Login/refresh/logout/session-expired flow |
| `S1-FE-03` | P1 | FE | 2 | `S1-BE2-05` | Reset password/profile screens |
| `S1-FE-04` | P1 | FE | 2 | `S1-BE1-05` | Back-office membership/role UI và forbidden state |
| `S1-MOB-01` | P0 | MOBILE | 2 | `S1-BE2-04` | Register/verify deep-link flow |
| `S1-MOB-02` | P0 | MOBILE | 3 | `S1-BE1-03` | Secure token lifecycle, refresh race và logout |
| `S1-MOB-03` | P1 | MOBILE | 2 | `S1-BE2-05` | Reset/profile flow, offline/error/retry state |
| `S1-TEAM-01` | P0 | TEAM | 2 | Các card S1 P0 | E2E + evidence `AC-AUTH-001..009`, `AC-PROFILE-001` |

## EP-02 — Transport, Trip & Search (`S2`)

| ID | P | Owner | PD | Depends | Deliverable / trace |
|---|---|---|---:|---|---|
| `S2-BE1-01` | P0 | BE-1 | 2 | `S1-BE1-05` | Organization + tenant-scoped authorization |
| `S2-BE1-02` | P0 | BE-1 | 3 | `S2-BE1-01` | Bus/seat template + deactivate rule |
| `S2-BE2-04` | P0 | BE-2 | 3 | `S2-BE1-01` | Driver/Route/Stop CRUD + validation |
| `S2-BE1-04` | P0 | BE-1 | 3 | `S2-BE1-02`, `S2-BE2-04` | Trip draft/publish, Bus/Driver schedule conflict, versioning |
| `S2-BE2-05` | P0 | BE-2 | 2 | `S2-BE1-04` | Public search/detail/stops, pagination/filter/sort |
| `S2-BE1-06` | P1 | BE-1 | 2 | `S2-BE1-04` | Assignment và Driver trip access boundary |
| `S2-BE2-01` | P0 | BE-2 | 3 | `S2-BE1-04` | Consume `TripPublished`, tạo snapshot/TripSeat atomically |
| `S2-BE2-02` | P0 | BE-2 | 2 | `S2-BE2-01` | `TripInventoryReady`, sellable convergence, dedupe/retry |
| `S2-BE2-03` | P1 | BE-2 | 2 | `S2-BE2-02` | Crash/broker-down integration evidence |
| `S2-FE-01` | P0 | FE | 3 | `S2-BE1-02`, `S2-BE2-04` | Back-office Bus/seat/Driver/Route screens |
| `S2-FE-02` | P0 | FE | 3 | `S2-BE1-04` | Trip create/edit/publish/conflict screens |
| `S2-FE-03` | P0 | FE | 2 | `S2-BE2-05` | Customer search/filter/sort/empty/error |
| `S2-FE-04` | P1 | FE | 2 | `S2-BE2-05`, `S2-BE2-02` | Trip detail/stops/seat snapshot |
| `S2-MOB-01` | P0 | MOBILE | 3 | `S2-BE2-05` | Search/filter/detail Mobile |
| `S2-MOB-02` | P1 | MOBILE | 2 | `S2-BE2-02` | Seat-map read-only + refresh state |
| `S2-MOB-03` | P1 | MOBILE | 2 | `S2-BE1-06` | Driver assignment/trip list shell |
| `S2-TEAM-01` | P0 | TEAM | 2 | Các card S2 P0 | Evidence `AC-SEARCH-001..003`, `AC-OPS-001..004` |

## EP-03 — SeatHold & Booking (`S3`)

| ID | P | Owner | PD | Depends | Deliverable / trace |
|---|---|---|---:|---|---|
| `S3-BE2-01` | P0 | BE-2 | 3 | `S2-BE2-02` | Atomic multi-seat hold, Trip lock, 10-minute expiry |
| `S3-BE2-02` | P0 | BE-2 | 3 | `S3-BE2-01` | Booking/contact/passenger/item mapping; server price |
| `S3-BE2-03` | P0 | BE-2 | 2 | `S3-BE2-02` | Idempotency same/different payload behavior |
| `S3-BE1-03` | P0 | BE-1 | 2 | `S3-BE2-01` | Hold expiry/release worker, retry-safe |
| `S3-BE1-04` | P0 | BE-1 | 3 | `S3-BE2-01` | Concurrency suite 2–50 clients, all-or-nothing evidence |
| `S3-BE1-01` | P1 | BE-1 | 2 | `S2-BE2-05` | Search/Trip snapshot contract stabilization + fixtures |
| `S3-BE1-02` | P0 | BE-1 | 2 | `S3-BE2-02` | Ownership/tenant/security review và negative tests |
| `S3-FE-01` | P0 | FE | 3 | `S3-BE2-01` | Interactive seat select, conflict refresh, countdown |
| `S3-FE-02` | P0 | FE | 3 | `S3-BE2-02` | Contact/passenger form + server-price summary |
| `S3-FE-03` | P0 | FE | 2 | `S3-BE2-03` | Submit/idempotency/retry và booking detail |
| `S3-MOB-01` | P0 | MOBILE | 3 | `S3-BE2-01` | Mobile seat select/countdown/conflict |
| `S3-MOB-02` | P0 | MOBILE | 3 | `S3-BE2-02` | Passenger/booking submit + resume state |
| `S3-MOB-03` | P1 | MOBILE | 2 | `S3-BE2-03` | Retry/idempotency/offline recovery tests |
| `S3-TEAM-01` | P0 | TEAM | 2 | Các card S3 P0 | Evidence `AC-SEAT-001..003`, `AC-BOOK-001..005` |

## EP-04 — Payment & Ticket (`S4`)

| ID | P | Owner | PD | Depends | Deliverable / trace |
|---|---|---|---:|---|---|
| `S4-BE2-01` | P0 | BE-2 | 3 | `S3-BE2-02` | Payment intent + deterministic simulator/VNPay adapter |
| `S4-BE2-02` | P0 | BE-2 | 3 | `S4-BE2-01` | Raw webhook signature, amount/currency, replay/dedupe |
| `S4-BE2-03` | P0 | BE-2 | 3 | `S4-BE2-02` | Success saga: Payment/Booking/TripSeat/Ticket convergence |
| `S4-BE1-03` | P0 | BE-1 | 2 | `S4-BE2-03` | Late success/seat lost compensation state |
| `S4-BE1-04` | P0 | BE-1 | 3 | `S4-BE2-03` | Duplicate webhook 100x + crash-after-commit/broker-down tests |
| `S4-BE1-01` | P0 | BE-1 | 2 | `S4-BE2-03` | Ticket ownership/detail/QR public-code authorization |
| `S4-BE1-02` | P1 | BE-1 | 2 | `S4-BE2-02` | Gateway callback security, correlation và audit review |
| `S4-FE-01` | P0 | FE | 3 | `S4-BE2-01` | Checkout/redirect/return + cancel/failure states |
| `S4-FE-02` | P0 | FE | 2 | `S4-BE2-03` | `CONFIRMING` polling/convergence; không báo success sớm |
| `S4-FE-03` | P0 | FE | 2 | `S4-BE1-01` | Booking history + Ticket detail/QR |
| `S4-MOB-01` | P0 | MOBILE | 3 | `S4-BE2-01` | Provider handoff/deep link/return validation |
| `S4-MOB-02` | P0 | MOBILE | 2 | `S4-BE2-03` | `CONFIRMING` polling + app resume recovery |
| `S4-MOB-03` | P0 | MOBILE | 2 | `S4-BE1-01` | Ticket detail/QR + screenshot/privacy behavior |
| `S4-TEAM-01` | P0 | TEAM | 2 | Các card S4 P0 | Evidence `AC-PAY-001..006`, `AC-TICKET-001..002` |

## EP-05 — Cancellation, Refund & Notification (`S5`)

| ID | P | Owner | PD | Depends | Deliverable / trace |
|---|---|---|---:|---|---|
| `S5-BE2-01` | P0 | BE-2 | 3 | `S4-BE2-03` | Cancellation preview/confirm theo policy snapshot |
| `S5-BE2-02` | P0 | BE-2 | 3 | `S5-BE2-01` | Refund lifecycle/cap/idempotency/provider retry |
| `S5-BE2-03` | P0 | BE-2 | 2 | `S5-BE2-02` | In-app/email notification + DeliveryAttempt |
| `S5-BE1-02` | P0 | BE-1 | 2 | `S5-BE2-03` | Retry/DLQ/manual state + replay audit |
| `S5-BE1-01` | P0 | BE-1 | 2 | `S5-BE2-01` | Cancellation ownership/tenant authorization và audit review |
| `S5-FE-01` | P0 | FE | 3 | `S5-BE2-01` | Cancellation preview/confirm/refund tracking |
| `S5-FE-02` | P1 | FE | 2 | `S5-BE2-03` | In-app notification list/read state |
| `S5-MOB-01` | P0 | MOBILE | 2 | `S5-BE2-01` | Customer cancellation/refund tracking |
| `S5-MOB-02` | P1 | MOBILE | 2 | `S5-BE2-03` | In-app notification state và deep link |
| `S5-TEAM-01` | P0 | TEAM | 2 | Các card S5 P0 | Evidence `AC-CANCEL-001..004`, `AC-NOTIF-001` |

## EP-06 — Operator, Driver & Trip Cancellation (`S6`)

| ID | P | Owner | PD | Depends | Deliverable / trace |
|---|---|---|---:|---|---|
| `S6-BE1-01` | P0 | BE-1 | 2 | `S2-BE1-06` | Manifest tối thiểu theo tenant/assignment |
| `S6-BE1-02` | P0 | BE-1 | 2 | `S6-BE1-01` | Ticket QR/manual check-in idempotent + audit |
| `S6-BE1-03` | P0 | BE-1 | 3 | `S5-BE2-02` | Trip cancellation batch checkpoint/resume orchestration |
| `S6-BE2-02` | P0 | BE-2 | 2 | `S6-BE1-02`, `S6-BE1-03` | Assignment, wrong-Trip, duplicate và worker-crash test |
| `S6-BE2-01` | P0 | BE-2 | 2 | `S6-BE1-03` | Trip cancellation → Refund/Notification event integration |
| `S6-FE-01` | P0 | FE | 2 | `S6-BE1-01` | Operator manifest/Trip transition UI |
| `S6-FE-02` | P0 | FE | 2 | `S6-BE1-03` | Operator Trip cancellation/progress/error UI |
| `S6-MOB-01` | P0 | MOBILE | 2 | `S6-BE1-01` | Driver manifest với PII tối thiểu |
| `S6-MOB-02` | P0 | MOBILE | 3 | `S6-BE1-02` | QR/manual check-in, duplicate/wrong Trip states |
| `S6-MOB-03` | P1 | MOBILE | 2 | `S6-BE1-03` | Driver Trip transition + refresh/retry |
| `S6-TEAM-01` | P0 | TEAM | 3 | Các card S6 P0 | Evidence `AC-OPS-005..006`, `AC-TICKET-003..005`, `AC-TRIP-001..002` |

## EP-07 — Admin & Reporting (`S7`)

| ID | P | Owner | PD | Depends | Deliverable / trace |
|---|---|---|---:|---|---|
| `S7-BE1-01` | P0 | BE-1 | 3 | `S1-BE1-05` | Admin User/membership/role hardening + last-admin guard |
| `S7-BE1-02` | P0 | BE-1 | 2 | `S4-BE2-03` | Admin Booking/Payment/Refund/audit lookup |
| `S7-BE1-03` | P0 | BE-1 | 3 | `S7-BE2-01` | Revenue/Booking/occupancy query, timezone + `dataAsOf` |
| `S7-BE2-01` | P0 | BE-2 | 3 | `S4-BE2-03` | Reporting projections, Inbox/dedupe/rebuild evidence |
| `S7-BE2-02` | P0 | BE-2 | 3 | `S7-BE2-01` | Projection lag/replay/reconciliation integration tests |
| `S7-FE-01` | P0 | FE | 2 | `S7-BE1-01` | Admin account/role/membership UI |
| `S7-FE-02` | P0 | FE | 2 | `S7-BE1-02` | Admin lookup/audit UI, permission/empty/error states |
| `S7-FE-03` | P0 | FE | 3 | `S7-BE1-03` | Reporting dashboard, timezone/metric/`dataAsOf` |
| `S7-MOB-01` | P1 | MOBILE | 2 | Toàn flow S1..S6 | Customer/Driver regression và API contract support |
| `S7-TEAM-01` | P0 | TEAM | 2 | Các card S7 P0 | Evidence `AC-ADMIN-001..002` và Reporting MUST |

## EP-08 — Acceptance Hardening (`S8`)

| ID | P | Owner | PD | Depends | Deliverable / trace |
|---|---|---|---:|---|---|
| `S8-BE1-01` | P0 | BE-1 | 3 | S1..S7 | Security/tenant/performance/observability defects được đóng |
| `S8-BE2-01` | P0 | BE-2 | 3 | S1..S7 | Recovery, retry/DLQ, reconciliation và backup/restore evidence |
| `S8-FE-01` | P0 | FE | 3 | Toàn flow Web | Accessibility/responsive/full Web E2E và defect fix |
| `S8-MOB-01` | P0 | MOBILE | 3 | Toàn flow Mobile | Customer + Driver full E2E, app-resume/offline/accessibility |
| `S8-TEAM-01` | P0 | TEAM | 3 | Tất cả P0 | Load, security, privacy, recovery và observability acceptance |
| `S8-TEAM-02` | P0 | TEAM | 3 | `S8-TEAM-01` | Trace 56 FR MUST → PR → test run → evidence; demo rehearsal |
| `S8-TEAM-03` | P1 | TEAM | 2 | `S8-TEAM-02` | Release notes, setup/runbook, known issues và rollback plan |

## Backlog sau MVP — không kéo vào S0..S8

| Scope khóa | Requirement |
|---|---|
| Search nâng cao | `FR-SEARCH-007` |
| Ticket change | `FR-BOOK-010` |
| Automated reconciliation | `FR-PAY-010` |
| Promotion | `FR-PROMO-001..002` |
| Review/moderation | `FR-REVIEW-001..002` |
| Push/SMS preference | `FR-NOTIF-003` |
| SupportCase | `FR-ADMIN-003` |
| CSV export | `FR-REPORT-003` |

Card P1 hậu MVP chỉ được đưa vào sprint khi tất cả P0 MVP của milestone hiện tại đã Done và scope change được ghi vào progress log.
