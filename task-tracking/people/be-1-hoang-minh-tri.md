# Hoàng Minh Trí — Roadmap `BE-1`

## 1. Vai trò

- Primary: .NET solution, Gateway, shared primitives, Identity/security, Transport/Trip, Operator/Admin/Reporting query.
- Backup/reviewer: reliability, event/migration và transaction flow do Ngô Quang Sinh sở hữu.
- File ownership ban đầu: .NET files trong `workspace/`, `workspace/src/gateway/`, `workspace/src/building-blocks/`, `workspace/src/services/identity/`, `workspace/src/services/transport/`.
- Không tự sửa npm workspace hoặc Mobile project trong `workspace/` nếu chưa đồng bộ với Sỹ/Đạt.

## 2. Bắt đầu ngay — Sprint 0

Card đầu tiên: `S0-BE1-01` — 2 PD — `READY`.

1. Tạo branch `feature/s0-be1-01-dotnet-baseline` từ nhánh tích hợp.
2. Tạo solution/build baseline, pin `net8.0`, bật nullable/analyzer.
3. Scaffold boundary và architecture test tối thiểu; chưa code business flow.
4. Chạy restore/build/test từ `workspace/`.
5. Mở PR, gắn Ngô Quang Sinh review; bàn giao lệnh build và dependency rule.
6. Sau merge mới nhận `S0-BE1-02` hoặc `S0-BE1-03`; không mở cả hai cùng lúc.

Checklist kỹ thuật đầy đủ: [Sprint 0 — Hoàng Minh Trí](../board/sprint-00-foundation.md#3-hoàng-minh-trí-be-1-checklist).

## 3. Roadmap theo sprint

| Sprint | Thời gian | P0 cards / PD | P1 stretch / PD | Kết quả phải bàn giao | Phụ thuộc chính |
|---|---|---|---|---|---|
| `S0` | 14/09–27/09/2026 | `S0-BE1-01..03` / 5 | `S0-BE1-04` / 1.5 | Build baseline, Gateway health, primitives; Identity skeleton nếu còn capacity | Toolchain; phối hợp Sinh về event primitives |
| `S1` | 28/09–11/10/2026 | `S1-BE1-01,03,05` / 8 | — | Identity schema, session rotation, RBAC/tenant/audit | Sinh làm register/reset; Sỹ/Đạt consume auth API |
| `S2` | 12/10–25/10/2026 | `S2-BE1-01,02,04` / 8 | `S2-BE1-06` / 2 | Organization, Bus/Seat, Trip publish/conflict/version | Sinh bàn giao Driver/Route; inventory event contract |
| `S3` | 26/10–08/11/2026 | `S3-BE1-02..04` / 7 | `S3-BE1-01` / 2 | Booking authorization, expiry worker và concurrency evidence | Booking API/lock từ Sinh |
| `S4` | 09/11–22/11/2026 | `S4-BE1-01,03,04` / 7 | `S4-BE1-02` / 2 | Ticket ownership, compensation và webhook reliability tests | Payment saga từ Sinh |
| `S5` | 23/11–06/12/2026 | `S5-BE1-01..02` / 4 | — | Cancellation authorization/audit và DLQ/replay review | Refund/Notification từ Sinh |
| `S6` | 07/12–20/12/2026 | `S6-BE1-01..03` / 7 | — | Manifest, check-in, Trip cancellation batch | Assignment S2, Refund S5 |
| `S7` | 21/12/2026–03/01/2027 | `S7-BE1-01..03` / 8 | — | Admin role/lookup và Reporting query có `dataAsOf` | Reporting projection từ Sinh |
| `S8` | 04/01–17/01/2027 | `S8-BE1-01` / 3 | — | Đóng security/tenant/performance/observability defect | Full regression/evidence |

## 4. Exit checklist theo giai đoạn

### Foundation → Identity

- [ ] Clean build trên máy khác/CI.
- [ ] Gateway trả đúng correlation/error envelope.
- [ ] Domain/Application không tham chiếu Infrastructure.
- [ ] Sinh có thể dùng primitives mà không project-reference service khác.

### Identity → Transport

- [ ] Refresh reuse, logout revoke và reset enumeration-safe pass.
- [ ] Role/membership không self-escalate hoặc xóa admin cuối.
- [ ] Cross-tenant negative test có evidence.
- [ ] Sỹ/Đạt có generated client và seed account ổn định.

### Transport → Booking

- [ ] Trip publish kiểm tra Bus/Driver conflict và optimistic version.
- [ ] Snapshot không đổi sau publish.
- [ ] Trip chỉ sellable sau `TripInventoryReady`.
- [ ] Bàn giao Trip/seat fixture cho Sinh, Sỹ và Đạt.

### Payment/Operations → Acceptance

- [ ] Ticket chỉ trả cho đúng owner/assignment/tenant.
- [ ] Wrong Trip và duplicate check-in không đổi trạng thái sai.
- [ ] Trip cancellation resume được sau worker crash.
- [ ] Admin/Reporting query có scope, timezone, metric definition và `dataAsOf`.

## 5. Handoff bắt buộc

| Bàn giao cho | Khi nào | Artifact |
|---|---|---|
| Ngô Quang Sinh | S0 primitives, S2 Trip publish, S6 cancellation | Interface/event/schema, migration note và integration test |
| Đinh Công Trung Sỹ | Mỗi route Identity/Transport/Admin đạt review | OpenAPI diff, seed, error/permission cases |
| Ngô Thành Đạt | Auth, assignment, manifest, check-in | API contract, test account/trip và wrong-assignment cases |

## 6. Checklist cho mọi card backend

- [ ] Link FR/AC/BR/contract.
- [ ] Domain rule không nằm trong controller.
- [ ] Authorization resource/tenant kiểm tra server-side.
- [ ] Migration/upgrade/rollback note nếu đổi dữ liệu.
- [ ] Unit + integration + negative test phù hợp.
- [ ] Log/audit không lộ token/PII.
- [ ] PR có test command/evidence và Ngô Quang Sinh review.
- [ ] Chuyển Kanban/ghi progress log sau merge.
