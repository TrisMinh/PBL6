# Đinh Công Trung Sỹ — Roadmap `FE`

## 1. Vai trò

- Primary: Customer Web, Back-office Web, web design system, client state/security, accessibility và Web E2E.
- File ownership ban đầu: root `package.json`, `package-lock.json`, `tsconfig.base.json`, `src/apps/customer-web/`, `src/apps/backoffice-web/`.
- Reviewer chéo TypeScript/UX: Ngô Thành Đạt.
- Không viết DTO API bằng tay; dùng generated OpenAPI client và adapter riêng của Web.

## 2. Bắt đầu ngay — Sprint 0

Card đầu tiên: `S0-FE-01` — 1 PD — `READY`.

1. Tạo branch `feature/s0-fe-01-web-workspace` từ nhánh tích hợp.
2. Tạo root npm workspace, một lockfile, TypeScript strict, Vite, lint và unit test.
3. Chừa workspace `src/apps/mobile` để Đạt tham gia; không tự scaffold Mobile.
4. Chạy root build/test/lint, ghi lệnh vào README.
5. Mở PR, gắn Đạt review; sau merge thông báo để Mobile cập nhật branch.
6. Tiếp theo nhận `S0-FE-03` khi contract gate của Sinh sẵn sàng; P1 `FE-02/04` chỉ kéo khi P0 an toàn.

Checklist kỹ thuật đầy đủ: [Sprint 0 — Đinh Công Trung Sỹ](../board/sprint-00-foundation.md#5-đinh-công-trung-sỹ-fe-checklist).

## 3. Roadmap theo sprint

| Sprint | Thời gian | P0 cards / PD | P1 stretch / PD | Kết quả phải bàn giao | API/handoff cần nhận |
|---|---|---|---|---|---|
| `S0` | 14/09–27/09/2026 | `S0-FE-01,03` / 2 | `S0-FE-02,04` / 2.5 | Workspace, generated client; app shells/UI base nếu còn capacity | Contract gate từ Sinh; workspace sync với Đạt |
| `S1` | 28/09–11/10/2026 | `S1-FE-01..02` / 4 | `S1-FE-03..04` / 4 | Register/verify/login/session; reset/profile/admin nếu còn capacity | Auth API từ Trí/Sinh |
| `S2` | 12/10–25/10/2026 | `S2-FE-01..03` / 8 | `S2-FE-04` / 2 | Back-office fleet/Trip và Customer search | Transport/Search/Inventory API |
| `S3` | 26/10–08/11/2026 | `S3-FE-01..03` / 8 | — | Seat select/countdown, Passenger/Booking và idempotent submit | SeatHold/Booking từ Sinh |
| `S4` | 09/11–22/11/2026 | `S4-FE-01..03` / 7 | — | Checkout, `CONFIRMING`, history và Ticket QR | Payment/Ticket từ Sinh/Trí |
| `S5` | 23/11–06/12/2026 | `S5-FE-01` / 3 | `S5-FE-02` / 2 | Cancel/refund; notification list nếu còn capacity | Cancellation/Notification từ Sinh |
| `S6` | 07/12–20/12/2026 | `S6-FE-01..02` / 4 | — | Operator manifest, Trip operation/cancellation | Operations API từ Trí |
| `S7` | 21/12/2026–03/01/2027 | `S7-FE-01..03` / 7 | — | Admin role/lookup/audit và Reporting dashboard | Admin/Reporting từ Trí/Sinh |
| `S8` | 04/01–17/01/2027 | `S8-FE-01` / 3 | — | Full Web E2E, responsive/accessibility và defect fix | Full stable integration environment |

## 4. Screen delivery checklist theo giai đoạn

### S0–S1 — Shell và Authentication

- [ ] Public/protected routing, not-found, error boundary.
- [ ] Register/verify/login/logout/session-expired có loading/error/retry.
- [ ] Refresh token không được lưu/log sai; forbidden khác unauthenticated.
- [ ] Keyboard/focus/label/validation message hoạt động.

### S2–S3 — Search, Seat và Booking

- [ ] Search có filter/sort/pagination, empty và stale response handling.
- [ ] Seat map phân biệt available/held/booked/disabled và không dựa màu duy nhất.
- [ ] Countdown dùng `expiresAt` server; hết hạn khóa submit và refresh.
- [ ] Passenger count khớp ghế; total hiển thị từ server response.
- [ ] Retry giữ cùng idempotency key cho cùng payload.

### S4–S5 — Payment, Ticket và Cancellation

- [ ] Redirect/return không tự coi query client là payment success.
- [ ] `CONFIRMING` hiển thị tới khi server hội tụ.
- [ ] Ticket detail/QR có loading/error/privacy state.
- [ ] Cancellation luôn preview fee/refund trước confirm.
- [ ] Refund/notification failure không làm UI báo booking chưa từng thanh toán.

### S6–S8 — Back-office và Acceptance

- [ ] Operator chỉ thấy dữ liệu đúng tenant/quyền.
- [ ] Batch cancellation có progress/retry/manual state.
- [ ] Reporting ghi timezone, metric definition và `dataAsOf`.
- [ ] Customer + Back-office full E2E, responsive và WCAG baseline pass.

## 5. Handoff bắt buộc

| Với ai | Nội dung | Khi nào |
|---|---|---|
| Hoàng Minh Trí | Identity/Transport/Admin routes, permission/error matrix | Trước khi screen PR vào review |
| Ngô Quang Sinh | Booking/Payment/Refund convergence và simulator cases | Trước integration checkpoint |
| Ngô Thành Đạt | Root workspace, generated client config, validation/session conventions | Mỗi lần đổi package/contract |

## 6. Checklist cho mọi card Web

- [ ] Có screen/state contract và task/FR link.
- [ ] Generated type được dùng; không duplicate DTO.
- [ ] Loading, empty, validation, forbidden, network error và retry đủ.
- [ ] Responsive + keyboard + focus + screen-reader label.
- [ ] Component/integration/E2E phù hợp pass.
- [ ] Không log token, payment data hoặc PII cấm.
- [ ] PR có ảnh/video state chính và Đạt review.
- [ ] Chuyển Kanban/ghi progress log sau merge.
