# Kanban Board — Sprint 0

- Sprint: `S0 — Foundation & Contract Gate`
- Thời gian: 2026-09-14 → 2026-09-27
- Sprint goal: monorepo build được, local stack chạy được và contract sinh client/test được.
- Committed estimate: `26 PD`
- Done estimate: `0 PD`
- Progress: `0%`
- Cập nhật gần nhất: 2026-09-12

Chi tiết checklist: [Sprint 0 Foundation](./sprint-00-foundation.md). Nguồn card: [Product Backlog — EP-00](../03-product-backlog.md#ep-00--foundation--contract-gate-s0). Mỗi người xem đường dài tại [roadmap cá nhân](../people/README.md).

## BLOCKED

| ID | Owner | PD | Blocker | Next action | Since |
|---|---|---:|---|---|---|
| `S0-TEAM-03` | TEAM | 2 | `RISK-001`: Docker CLI/Compose có sẵn nhưng engine chưa chạy; còn phụ thuộc các P0 S0 | Khởi động/xác nhận Docker engine, sau đó chạy full smoke | 2026-09-12 |

## IN PROGRESS — WIP 0/4

_Chưa có card nào. Owner chuyển card từ READY khi thực sự bắt đầu và ghi ngày Started._

## REVIEW — WIP 0/4

_Chưa có card nào._

## READY

| ID | P | Owner | PD | Outcome | Reviewer | Started |
|---|---|---|---:|---|---|---|
| `S0-TEAM-01` | P0 | TEAM | 0.5 | Tên đã điền; còn chốt Git flow, reviewer và WIP | TEAM | — |
| `S0-TEAM-02` | P0 | TEAM | 0.5 | Kiểm tra toolchain của cả 4 thành viên | TEAM | — |
| `S0-BE1-01` | P0 | Hoàng Minh Trí (`BE-1`) | 2 | Solution/build baseline | Ngô Quang Sinh | — |
| `S0-BE2-01` | P0 | Ngô Quang Sinh (`BE-2`) | 2 | Compose local stack | Hoàng Minh Trí | — |
| `S0-BE2-04` | P0 | Ngô Quang Sinh (`BE-2`) | 1 | Contract/SQL validation gates | Đinh Công Trung Sỹ | — |
| `S0-FE-01` | P0 | Đinh Công Trung Sỹ (`FE`) | 1 | npm/TypeScript/Vite workspace baseline | Ngô Thành Đạt | — |
| `S0-MOB-01` | P0 | Ngô Thành Đạt (`MOBILE`) | 2 | React Native Android app baseline | Đinh Công Trung Sỹ | — |

## BACKLOG — đã commit, chờ dependency

| ID | P | Owner | PD | Depends | Outcome |
|---|---|---|---:|---|---|
| `S0-BE1-02` | P0 | Hoàng Minh Trí | 1 | `S0-BE1-01` | Gateway health + error/correlation |
| `S0-BE1-03` | P0 | Hoàng Minh Trí | 2 | `S0-BE1-01` | Shared technical primitives |
| `S0-BE1-04` | P1 | Hoàng Minh Trí | 1.5 | `S0-BE1-03` | Identity service skeleton/migration |
| `S0-BE2-02` | P0 | Ngô Quang Sinh | 1.5 | `S0-BE2-01` | Database bootstrap/migration smoke |
| `S0-BE2-03` | P0 | Ngô Quang Sinh | 2 | `S0-BE1-03`, `S0-BE2-01` | Event + Inbox/Outbox smoke |
| `S0-FE-02` | P1 | Đinh Công Trung Sỹ | 1.5 | `S0-FE-01` | Customer/Back-office shells |
| `S0-FE-03` | P0 | Đinh Công Trung Sỹ | 1 | `S0-FE-01`, `S0-BE2-04` | Generated client compile/health |
| `S0-FE-04` | P1 | Đinh Công Trung Sỹ | 1 | `S0-FE-02` | Web base UI states |
| `S0-MOB-02` | P1 | Ngô Thành Đạt | 1.5 | `S0-MOB-01` | Navigation/env/session/error boundary |
| `S0-MOB-03` | P0 | Ngô Thành Đạt | 1 | `S0-MOB-01`, `S0-BE2-04` | Generated client compile/health |
| `S0-MOB-04` | P1 | Ngô Thành Đạt | 1 | `S0-MOB-02` | Mobile base UI states |

## DONE

_Chưa có card nào._

## Cách cập nhật board trong một PR

1. Chuyển đúng một dòng card sang cột mới.
2. Cập nhật `Started` hoặc thêm PR/evidence khi vào `REVIEW/DONE`.
3. Cập nhật `Done estimate`, phần trăm và ngày cập nhật.
4. Ghi một dòng ngắn vào [progress log](../registers/progress-log.md).
5. Khi sprint đóng, copy snapshot board sang file archive trước khi reset board sprint mới.
