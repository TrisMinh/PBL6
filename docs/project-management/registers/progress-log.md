# Progress Log

File này là log append-only. Không sửa lịch sử để làm số liệu “đẹp”; nếu ghi sai, thêm dòng correction. Board thể hiện hiện tại, log giải thích vì sao trạng thái thay đổi.

## 1. Snapshot sprint

| Sprint | Committed PD | Done PD | Carry-over PD | Unplanned PD | Defect S0/S1 | Result |
|---|---:|---:|---:|---:|---:|---|
| `S0` | 26 | 0 | — | 0 | 0 | PLANNED |
| `S1` | — | — | — | — | — | NOT STARTED |
| `S2` | — | — | — | — | — | NOT STARTED |
| `S3` | — | — | — | — | — | NOT STARTED |
| `S4` | — | — | — | — | — | NOT STARTED |
| `S5` | — | — | — | — | — | NOT STARTED |
| `S6` | — | — | — | — | — | NOT STARTED |
| `S7` | — | — | — | — | — | NOT STARTED |
| `S8` | — | — | — | — | — | NOT STARTED |

## 2. Daily log

### 2026-09-12 — Project setup

- Done: tạo roadmap, ownership, backlog, Kanban, Sprint 0 checklist và risk/dependency baseline.
- Next: điền tên 4 thành viên; xác nhận ngày kickoff; nhận các card READY.
- Blocked: `DEP-003/RISK-001` — Docker CLI/Compose đã cài nhưng Docker Desktop engine chưa chạy.
- Decision: tracking dùng Markdown trong repository; trạng thái chỉ được tính Done sau merge + evidence.

## 3. Mẫu daily update

Sao chép block này xuống cuối mục Daily log:

```markdown
### YYYY-MM-DD — <Tên/mã vai trò>

- Done: `<CARD-ID>` — kết quả cụ thể, không ghi “đã làm tiếp”.
- Next: `<CARD-ID>` — việc sẽ hoàn tất tiếp theo và ETA.
- Blocked: `None` hoặc `<RISK/DEP-ID>` — cần ai làm gì trước khi nào.
- PR/Evidence: link hoặc commit/test run.
```

## 4. Mẫu checkpoint giữa sprint

```markdown
### S<n> midpoint — YYYY-MM-DD

- Done PD / Committed PD:
- WIP / Review / Blocked:
- P0 có nguy cơ trễ:
- Scope thêm `UNPLANNED`:
- Quyết định rebalance owner:
- Risk cần cập nhật:
```

## 5. Mẫu sprint closeout

```markdown
### S<n> closeout — YYYY-MM-DD

- Sprint goal: MET / PARTIAL / MISSED
- Committed / Done / Carry-over / Unplanned PD:
- Demo đã chạy:
- Acceptance/evidence:
- Defect S0/S1 còn mở:
- Carry-over (ID + lý do + owner mới):
- Keep / Stop / Start:
- Tối đa 2 action cải tiến (owner + due):
- Scope S<n+1> được chấp nhận:
```
