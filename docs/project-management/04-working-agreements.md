# Quy trình làm việc

## 1. Git workflow

### Branch

- `main`: bản ổn định/release; cấm push trực tiếp.
- `develop`: nhánh tích hợp của sprint; chỉ merge qua PR.
- `feature/<card-id>-<slug>`: chức năng mới, ví dụ `feature/s1-be1-03-refresh-token`.
- `fix/<card-id>-<slug>`: sửa lỗi.
- `docs/<card-id>-<slug>`: tài liệu/contract không kèm code runtime.

Mỗi feature branch tách từ `develop`, sống ngắn và chỉ chứa một card hoặc một nhóm subtask cùng acceptance. Không đưa `SHOULD` vào chung PR của `MUST`.

### Commit

Định dạng:

```text
<type>(<scope>): <mô tả ngắn> [<CARD-ID>]
```

Ví dụ: `feat(identity): rotate refresh tokens [S1-BE1-03]`.

Type cho phép: `feat`, `fix`, `test`, `docs`, `refactor`, `build`, `ci`, `chore`. Commit không chứa secret, file build sinh ra hoặc thay đổi ngoài scope card.

### Pull request gate

- Tiêu đề có card ID; mô tả link FR/AC/contract liên quan.
- Nêu migration/contract/event thay đổi và backward-compatibility impact.
- Có test command + kết quả; UI có ảnh/video ngắn cho state chính.
- Có ít nhất 1 reviewer; contract cross-client cần consumer liên quan review.
- Author tự review diff và cập nhật với `develop` mới nhất trước merge.
- Không merge khi CI đỏ, review unresolved hoặc card chưa đạt checklist.

## 2. Cách dùng Kanban Markdown

Board nằm tại [board/README.md](./board/README.md). Di chuyển nguyên dòng card giữa các section; không copy để tránh một card xuất hiện hai nơi.

| Cột | Điều kiện vào | Điều kiện ra |
|---|---|---|
| `BACKLOG` | Card đã có trong product backlog | Scope sprint được chốt và đạt DoR |
| `READY` | Owner, estimate, dependency, acceptance rõ | Owner bắt đầu làm |
| `IN PROGRESS` | Đã ghi Started; WIP còn chỗ | Có PR hoặc có blocker thật |
| `REVIEW` | Checklist xong, PR/evidence có link | Reviewer chấp nhận và merge |
| `BLOCKED` | Không thể tiến tiếp do dependency/quyết định/tool | Blocker được xử lý và có next action |
| `DONE` | Merge + test + docs + evidence đạt DoD | Không quay lại; lỗi mới tạo card `fix` |

### WIP và SLA

- `IN PROGRESS`: tối đa 1 card/người, toàn nhóm tối đa 4.
- `REVIEW`: toàn nhóm tối đa 4; review card cũ trước khi bắt đầu card mới.
- PR nhỏ: reviewer phản hồi trong 1 ngày làm việc.
- Blocker > 4 giờ: chuyển `BLOCKED`, ghi `RISK/DEP-ID`, owner và next action.
- Card ở `IN PROGRESS` > 3 ngày: bắt buộc tách nhỏ hoặc ghi lý do trong daily log.

## 3. Definition of Ready

Một card chỉ sang `READY` khi:

- [ ] Có một owner và một reviewer dự kiến.
- [ ] Có mục tiêu/outcome, không chỉ mô tả thao tác code.
- [ ] Có link FR/AC/Business Rule hoặc foundation artifact liên quan.
- [ ] API/event/database/UI contract đã rõ; không còn TBD ảnh hưởng schema.
- [ ] Dependency đã Done hoặc có mock/adapter cho phép làm độc lập.
- [ ] Có happy path, validation, permission và failure case phù hợp.
- [ ] Estimate không quá `3 PD`; lớn hơn phải tách.
- [ ] Không chứa scope `SHOULD/COULD` khi card thuộc MVP.

## 4. Definition of Done cho card

- [ ] Code đúng dependency rule và build/lint sạch.
- [ ] Unit/component test cho rule cục bộ; integration/contract test khi chạm I/O.
- [ ] Authorization/tenant negative test khi có protected resource.
- [ ] Concurrency/idempotency/retry test khi card có duplicate hoặc eventual flow.
- [ ] Migration chạy từ empty và upgrade path pass nếu schema đổi.
- [ ] OpenAPI/AsyncAPI/JSON Schema + generated client đồng bộ nếu contract đổi.
- [ ] Loading/empty/error/retry/accessibility state xong nếu card có UI.
- [ ] Log/metric/trace/audit đủ và không lộ secret/PII cấm.
- [ ] PR được review, CI pass và merge vào nhánh tích hợp.
- [ ] Board, progress log và evidence link được cập nhật.

## 5. Definition of Done cho sprint

- [ ] Tất cả card P0 committed Done hoặc có carry-over/waiver ghi rõ.
- [ ] Vertical slice demo bằng service thật; mock chỉ dùng cho phần ngoài scope sprint.
- [ ] Contract/client/migration compatibility gates pass.
- [ ] Regression của các sprint trước pass.
- [ ] Risk/dependency register được cập nhật.
- [ ] Velocity: committed PD, Done PD, unplanned PD và defect count được ghi.
- [ ] Sprint review có kết quả demo, evidence, tồn đọng và quyết định scope tiếp theo.

## 6. Nhịp làm việc

| Hoạt động | Thời lượng | Nội dung |
|---|---:|---|
| Sprint Planning | 60–90 phút đầu sprint | Chọn P0/P1, check DoR/dependency, cân capacity, commit scope |
| Daily async | 5 phút/người/ngày | Done / Next / Blocker / ETA trong progress log |
| Sync kỹ thuật | 15 phút khi cần | Contract, event, migration, security hoặc integration blocker |
| Backlog refinement | 45 phút giữa sprint | Tách card sprint kế, estimate và làm rõ acceptance |
| Demo/Review | 60 phút cuối sprint | Chạy vertical slice, xem evidence và chốt Done/carry-over |
| Retrospective | 30 phút | Keep / Stop / Start và tối đa 2 action có owner |

## 7. Bug và scope change

- Severity `S0`: mất dữ liệu/security/double-book/payment sai — dừng feature, xử lý ngay.
- `S1`: chặn critical flow — vào sprint hiện tại, gắn `UNPLANNED`.
- `S2`: có workaround — ưu tiên sprint kế.
- `S3`: cosmetic — backlog.
- Requirement thay đổi phải cập nhật SRS/baseline/traceability trong cùng PR hoặc trước code.
- Không xóa card đã cam kết; chuyển carry-over/cancelled và ghi lý do để giữ lịch sử.

## 8. Evidence convention

Mỗi card Done ghi tối thiểu:

```text
PR: <link hoặc commit>
Tests: <command> — PASS — <run/link>
Contract/Migration: <artifact hoặc N/A>
Demo: <ảnh/video/log hoặc N/A>
Trace: <FR/AC/NFR IDs>
```
