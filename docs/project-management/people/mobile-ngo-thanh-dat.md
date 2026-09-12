# Ngô Thành Đạt — Roadmap `MOBILE`

## 1. Vai trò

- Primary: React Native Customer/Driver app, secure session, deep link, QR check-in, offline/app-resume và Mobile E2E.
- File ownership ban đầu: `src/apps/mobile/` và mobile-specific build/config.
- Reviewer chéo TypeScript/UX: Đinh Công Trung Sỹ.
- Root npm workspace/lockfile do Sỹ sở hữu; mọi thay đổi dependency phải phối hợp để chỉ có một lockfile.

## 2. Bắt đầu ngay — Sprint 0

Card đầu tiên: `S0-MOB-01` — 2 PD — `READY`.

1. Xác nhận JDK/Android SDK/emulator hoặc thiết bị thật.
2. Chờ/đồng bộ cấu trúc npm workspace với Sỹ, rồi tạo branch `feature/s0-mob-01-rn-baseline`.
3. Scaffold React Native app; Android debug build/install/run pass.
4. Bật TypeScript strict, lint và unit/component test; không tạo lockfile thứ hai.
5. Mở PR, gắn Sỹ review; ghi version Android/JDK và lệnh build.
6. Tiếp theo nhận `S0-MOB-03` khi contract gate có; P1 `MOB-02/04` chỉ kéo khi P0 an toàn.

Checklist kỹ thuật đầy đủ: [Sprint 0 — Ngô Thành Đạt](../board/sprint-00-foundation.md#6-ngô-thành-đạt-mobile-checklist).

## 3. Roadmap theo sprint

| Sprint | Thời gian | P0 cards / PD | P1 stretch / PD | Kết quả phải bàn giao | API/handoff cần nhận |
|---|---|---|---|---|---|
| `S0` | 14/09–27/09/2026 | `S0-MOB-01,03` / 3 | `S0-MOB-02,04` / 2.5 | RN build + generated client; navigation/theme nếu còn capacity | Workspace từ Sỹ; contract gate từ Sinh |
| `S1` | 28/09–11/10/2026 | `S1-MOB-01..02` / 5 | `S1-MOB-03` / 2 | Register/verify, secure session/refresh/logout | Auth API từ Trí/Sinh |
| `S2` | 12/10–25/10/2026 | `S2-MOB-01` / 3 | `S2-MOB-02..03` / 4 | Search/detail; seat/driver shell nếu còn capacity | Search/inventory/assignment APIs |
| `S3` | 26/10–08/11/2026 | `S3-MOB-01..02` / 6 | `S3-MOB-03` / 2 | Seat select/countdown, Booking submit/resume | SeatHold/Booking từ Sinh |
| `S4` | 09/11–22/11/2026 | `S4-MOB-01..03` / 7 | — | Payment deep link, `CONFIRMING`, Ticket QR | Payment/Ticket từ Sinh/Trí |
| `S5` | 23/11–06/12/2026 | `S5-MOB-01` / 2 | `S5-MOB-02` / 2 | Cancellation/refund; notification/deep link nếu còn capacity | Cancellation/Notification từ Sinh |
| `S6` | 07/12–20/12/2026 | `S6-MOB-01..02` / 5 | `S6-MOB-03` / 2 | Driver manifest, QR/manual check-in, Trip transition | Operations API từ Trí |
| `S7` | 21/12/2026–03/01/2027 | — | `S7-MOB-01` / 2 | Customer/Driver regression và contract support | Stable S1..S6 environment |
| `S8` | 04/01–17/01/2027 | `S8-MOB-01` / 3 | — | Full Mobile E2E, resume/offline/accessibility và defect fix | Full integration environment/device |

## 4. Mobile delivery checklist theo giai đoạn

### S0–S1 — App shell và Session

- [ ] Android build chạy trên clean environment.
- [ ] Auth/app navigation không flash protected screen.
- [ ] Token lưu secure storage; refresh race chỉ tạo một refresh request.
- [ ] Verify/payment deep link kiểm tra host/path/state trước xử lý.
- [ ] App resume và network change không làm mất session sai.

### S2–S3 — Search, Seat và Booking

- [ ] Search/detail có loading/empty/error/retry và pull-to-refresh phù hợp.
- [ ] Seat map có accessible label/touch target và refresh conflict.
- [ ] Countdown lấy `expiresAt` server; foreground/background vẫn đúng.
- [ ] Booking resume không submit duplicate; idempotency key đúng payload.
- [ ] Offline không tuyên bố hold/booking thành công.

### S4–S5 — Payment, Ticket và Cancellation

- [ ] Provider handoff/return và app resume không báo success từ deep-link query.
- [ ] Poll server và hiển thị `CONFIRMING` trong lúc hội tụ.
- [ ] Ticket QR/detail có privacy, brightness/error state phù hợp.
- [ ] Cancellation preview/confirm/refund state chính xác.
- [ ] Notification deep link mở đúng resource sau authorization check.

### S6–S8 — Driver và Acceptance

- [ ] Driver chỉ thấy Trip được assignment và PII tối thiểu.
- [ ] Camera permission denied có manual-code fallback.
- [ ] Wrong Trip, cancelled/used Ticket và duplicate scan có state rõ.
- [ ] Trip transition kiểm tra version/permission; retry không duplicate.
- [ ] Full E2E trên emulator và ít nhất một thiết bị thật nếu có.

## 5. Handoff bắt buộc

| Với ai | Nội dung | Khi nào |
|---|---|---|
| Đinh Công Trung Sỹ | Workspace/lockfile, generated client, validation/session/UI convention | Mỗi lần đổi dependency hoặc contract |
| Hoàng Minh Trí | Auth, assignment, manifest, check-in permission/error cases | Trước Driver integration |
| Ngô Quang Sinh | Booking/payment/cancel, simulator và app-resume convergence | Trước Customer flow E2E |

## 6. Checklist cho mọi card Mobile

- [ ] Có screen/state contract và task/FR link.
- [ ] Dùng generated type; không duplicate DTO hoặc business truth trong local state.
- [ ] Loading, empty, offline, validation, forbidden, network error và retry đủ.
- [ ] App background/resume, deep link và duplicate tap/request được test nếu liên quan.
- [ ] Touch target, screen-reader label, font scaling và keyboard behavior phù hợp.
- [ ] Unit/component/E2E phù hợp; Android debug build pass.
- [ ] PR có ảnh/video state chính và Sỹ review.
- [ ] Chuyển Kanban/ghi progress log sau merge.
