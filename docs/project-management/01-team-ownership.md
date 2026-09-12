# Nhóm và ownership

## 1. Danh sách thành viên

Điền tên thật một lần trước Sprint 0. Nếu đổi người, giữ nguyên mã vai trò và ghi thay đổi trong progress log.

| Mã | Tên thành viên | Vai trò chính | Ownership chính | Backup |
|---|---|---|---|---|
| `BE-1` | _Chưa điền_ | Backend — Platform & Operations | Gateway, Identity, authorization, Transport, Admin/Reporting | `BE-2` |
| `BE-2` | _Chưa điền_ | Backend — Transaction & Integration | Booking, Payment, Ticket, Refund, Notification, RabbitMQ | `BE-1` |
| `FE` | _Chưa điền_ | Frontend Web | Customer Web, Back-office Web, web design system, web E2E | `MOBILE` review UX |
| `MOBILE` | _Chưa điền_ | Mobile | Customer/Driver mobile, QR check-in UX, mobile E2E | `FE` review TypeScript |

Không hiểu ownership là “chỉ người đó được sửa”. Owner chịu trách nhiệm đưa việc tới Done, giữ contract ổn định, tìm reviewer và xử lý blocker.

## 2. Trách nhiệm chi tiết

### BE-1 — Platform & Operations

- Solution/build baseline, Gateway, shared error/correlation/authorization primitives.
- Identity: register, verify, login, refresh, logout, reset password, profile, membership/role.
- Transport: Organization, Bus/Seat, Driver, Route/Stop, Trip, assignment, public search.
- Tenant isolation, permission matrix và security negative tests.
- Admin lookup và Reporting projection/query ở giai đoạn cuối.
- Review migration, event contract và failure handling do `BE-2` sở hữu.

### BE-2 — Transaction & Integration

- Local infrastructure, PostgreSQL/RabbitMQ/Redis/Mailpit/payment simulator và integration harness.
- Booking: TripSeat, SeatHold, Booking, Passenger, idempotency và expiry worker.
- Payment/Ticket: intent, VNPay adapter, webhook, Inbox/Outbox, saga và ticket issuance.
- Cancellation/Refund/Notification, retry/DLQ và reconciliation state.
- Concurrency, idempotency, crash/retry và event compatibility tests.
- Review API authorization/tenant boundary do `BE-1` sở hữu.

### FE — Web

- `customer-web` và `backoffice-web`; routing, session, state/query layer và accessibility.
- Web design system, token/component states và responsive behavior.
- Customer flow: auth → search → seat → booking → payment → ticket/cancel.
- Operator/Admin flow: fleet/trip/manifest/user/audit/reporting.
- Generated OpenAPI client; không viết DTO API bằng tay.
- Component, integration và Playwright E2E cho web.

### MOBILE — Customer & Driver

- React Native app, navigation, environment, secure session storage và deep link.
- Customer flow tối thiểu: auth, search, booking/payment status, ticket.
- Driver flow: assignment/manifest, QR/manual check-in và Trip transition.
- Mobile offline/loading/error/retry state; không xác nhận giao dịch chỉ từ local state.
- Generated OpenAPI client dùng chung contract; platform permission và Android build.
- Component/integration/E2E quan trọng cho mobile.

## 3. Ma trận ownership và review

`A` chịu trách nhiệm cuối, `R` thực hiện, `C` phải được review/tham vấn, `I` được thông báo.

| Workstream | BE-1 | BE-2 | FE | MOBILE |
|---|:---:|:---:|:---:|:---:|
| Repository, Gateway, CI baseline | A/R | C/R | C | C |
| Local infra, messaging, integration harness | C | A/R | I | I |
| Identity, tenant, permission | A/R | C | R | R |
| Transport, Trip, public search | A/R | C | R | R |
| SeatHold, Booking | C | A/R | R | R |
| Payment, Ticket, Refund | C | A/R | R | R |
| Notification | C | A/R | R | R |
| Operator/Admin/Reporting | A/R | R | R | C/R |
| Web design system và web E2E | C | C | A/R | C |
| Mobile/QR và mobile E2E | C | C | C | A/R |
| Security/concurrency/recovery acceptance | A/R | A/R | R | R |
| SRS/contract compatibility | A | A | C | C |

## 4. Cặp tích hợp bắt buộc

| Cặp | Đồng bộ về | Tần suất tối thiểu |
|---|---|---|
| `BE-1 ↔ BE-2` | Service boundary, event, transaction, tenant/security | Mỗi ngày khi có contract change |
| `BE-1 ↔ FE` | Identity/Transport/Admin API và error states | Trước khi route chuyển `REVIEW` |
| `BE-2 ↔ FE` | Booking/Payment/Refund API, webhook convergence | Trước demo vertical slice |
| `BE-1 ↔ MOBILE` | Auth, Trip assignment, manifest | Trước mobile integration |
| `BE-2 ↔ MOBILE` | Booking, payment status, Ticket/check-in | Trước mobile E2E |
| `FE ↔ MOBILE` | Token, generated client, validation và UX states | Ít nhất 2 lần/sprint |

## 5. Quy tắc backup

- Mỗi PR backend có người backend còn lại hiểu migration, event và rollback path.
- FE và Mobile review chéo TypeScript contract/auth; không review thay kiểm thử nền tảng.
- Tài liệu chạy local, seed và test command phải đủ để backup tiếp quản trong 30 phút.
- Card bị kẹt quá 1 ngày làm việc phải báo cả backup và đưa vào risk/dependency register.

## 6. Capacity

- Sprint dài 2 tuần, mỗi người có tối đa 10 PD; mục tiêu thường là 8 PD card cá nhân và 2 PD cho planning, review, integration, demo/phát sinh.
- P0 toàn nhóm không vượt 32 PD. Một người chỉ được lên 9–10 PD khi TEAM/review work đã gán cho thành viên còn capacity; không vượt 10 PD.
- P1 là stretch, không được tính vào committed capacity đầu sprint.
- WIP tối đa 1 card `IN PROGRESS` mỗi người. Không mở card mới khi card hiện tại chưa sang `REVIEW` hoặc `BLOCKED` có lý do rõ.
- Estimate dùng person-day (`PD`): `0.5`, `1`, `2`, tối đa `3`. Card lớn hơn `3 PD` phải tách.
