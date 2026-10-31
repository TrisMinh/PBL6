# BLUE Frontend Backlog

> Nguồn yêu cầu: `PRD.md`, đặc tả Superpowers đã duyệt và Figma Travel v3. Mỗi mục liên kết tới file chi tiết trong `.tasks/`.

Implementation plan: [`docs/superpowers/plans/2026-10-18-travel-v3-frontend-master-plan.md`](./docs/superpowers/plans/2026-10-18-travel-v3-frontend-master-plan.md).

## Work in Progress

- [ ] [#013 — Kiểm duyệt và sửa toàn bộ frontend theo Figma](./.tasks/013-figma-fidelity-audit-remediation.md) — Plan 07 đang `in_progress`; Supervisor đã accept Task 1–8; Task 9 Admin Transactions, Filters and State Families đang `in_progress` với cùng Worker Sol 6.1 medium.

## Backlog

Không có task frontend mock nào đang chờ.

## Blocked

Không có task frontend mock nào đang bị chặn.

## Completed

- [x] [#014 — Khám phá tỉnh thành và điểm đón trả](./.tasks/014-customer-explore.md) — Supervisor ACCEPT `28a5e62`; focused64/64, browser15/15 đủ5width và không còn Critical/Important.

- [x] [#012 — E2E, visual review và nghiệm thu frontend](./.tasks/012-e2e-frontend-acceptance.md) — Final quality gate đạt trên năm viewport; chờ Supervisor whole-branch review.
- [x] [#011 — Hoàn thiện responsive, accessibility và SEO](./.tasks/011-quality-responsive-seo.md) — Responsive/a11y/SEO/visual/static build acceptance đạt.
- [x] [#010 — Xây admin shell và các module quản trị](./.tasks/010-admin-portal.md) — Plan 05 hoàn tất với E2E admin responsive 1440/360 và final quality gate.
- [x] [#000 — Initial project setup](./.tasks/000-initial-project-setup.md)
- [x] [#001 — Khởi tạo React/Vite/TypeScript và công cụ nền](./.tasks/001-scaffold-frontend.md)
- [x] [#002 — Trích xuất design token, asset và UI primitives](./.tasks/002-design-system-foundation.md)
- [x] [#003 — Xây contract, fixture và MSW cho tìm chuyến](./.tasks/003-mock-api-foundation.md)
- [x] [#004 — Dựng app shell, route và responsive navigation](./.tasks/004-routing-app-shell.md)
- [x] [#005 — Xây trang chủ, tìm kiếm và kết quả chuyến](./.tasks/005-customer-search.md)
- [x] [#006 — Xây chọn ghế và booking session](./.tasks/006-seat-booking-session.md)
- [x] [#007 — Xây thông tin hành khách và review đơn](./.tasks/007-passenger-review.md)
- [x] [#008 — Mô phỏng VNPay và phát hành vé](./.tasks/008-vnpay-ticket.md)
- [x] [#009 — Xây auth mock, lịch sử vé và hủy/hoàn](./.tasks/009-auth-ticket-aftersales.md)

## Thứ tự phụ thuộc

```text
001 ─┬─> 002 ─┬─> 004 ─> 005 ─> 006 ─> 007 ─> 008 ─> 009
     └─> 003 ─┘                         │
                         004 ─> 010 ────┤
                              005..010 ─> 011 ─> 012
                                               └─> 013
```
