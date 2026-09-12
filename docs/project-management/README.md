# Project Management — PBL6

Đây là điểm điều phối công việc của nhóm 4 người. Tài liệu dùng Markdown như một bảng Trello: mỗi việc có mã, owner, trạng thái, dependency, estimate và evidence hoàn thành. SRS quyết định **xây gì**; System/Detailed Design quyết định **xây thế nào**; thư mục này quyết định **ai làm, làm khi nào và đang ở đâu**.

## Trạng thái hiện tại

| Thuộc tính | Giá trị |
|---|---|
| Baseline | SRS 2.0 — 56 Functional Requirement `MUST` |
| Nhóm | 2 Backend, 1 Frontend Web, 1 Mobile |
| Giai đoạn | `M0 — Foundation` |
| Sprint hiện tại | `S0 — Foundation & Contract Gate` |
| Thời gian dự kiến | 2026-09-14 đến 2026-09-27 |
| Trạng thái | `READY TO START` — đã gán 4 thành viên; chưa có card code ở `IN PROGRESS` |
| Source | Chưa scaffold; `src/` đang rỗng |
| Blocker đã biết | Docker CLI/Compose đã cài nhưng Docker Desktop engine chưa chạy; integration stack chưa dùng được |
| Cập nhật gần nhất | 2026-09-12 |

## Mở nhanh

1. [Roadmap theo từng người](./people/README.md) — mỗi thành viên có một file riêng để theo dõi, không phải đọc toàn backlog.
2. [Nhóm và ownership](./01-team-ownership.md) — ai quyết định, thực hiện và review phần nào.
3. [Roadmap cấp nhóm](./02-roadmap.md) — 9 sprint + release buffer, mục tiêu và exit gate.
4. [Product backlog](./03-product-backlog.md) — nguồn task toàn dự án dành cho planning/refinement.
5. [Quy trình làm việc](./04-working-agreements.md) — Git, review, Definition of Ready/Done và cách cập nhật board.
6. [Kanban board hiện tại](./board/README.md) — bảng kéo-thả bằng cách chuyển dòng giữa các cột Markdown.
7. [Sprint 0 checklist](./board/sprint-00-foundation.md) — checklist khởi động chi tiết cho từng người.
8. [Risk và dependency](./registers/risks-and-dependencies.md) — blocker, rủi ro, owner và phương án xử lý.
9. [Nhật ký tiến độ](./registers/progress-log.md) — snapshot hằng ngày và kết quả sprint.
10. [Task card template](./templates/task-card.md) — mẫu cho card mới/bug/unplanned work.

## Phân cấp công việc

```text
Release MVP
└── Milestone (M0..M8)
    └── Sprint (S0..S8)
        └── Epic (EP-00..EP-08)
            └── Task/Card (S<n>-<ROLE>-<nn>)
                └── Checklist item
```

Ví dụ `S3-BE2-02` là card thứ 02 của Backend 2 trong Sprint 3. ID không đổi khi card chuyển trạng thái hoặc đổi owner.

## Cấu trúc theo dõi

```text
project-management/
├── people/                 Một roadmap riêng cho từng thành viên
├── board/                  Kanban sprint hiện tại + archive
├── registers/              Progress log, risk và dependency
├── templates/              Mẫu card mới
├── 01-team-ownership.md    Phân quyền và reviewer
├── 02-roadmap.md           Timeline/exit gate cấp nhóm
├── 03-product-backlog.md   Nguồn task toàn dự án
└── 04-working-agreements.md
```

Thành viên làm việc hằng ngày từ `people/<tên>.md` và `board/README.md`; không cần dò toàn bộ product backlog.

## Trạng thái card

`BACKLOG → READY → IN PROGRESS → REVIEW → DONE`

`BLOCKED` là nhánh tạm thời; khi hết blocker, card quay lại trạng thái trước đó. Chỉ `DONE` khi có evidence và đạt Definition of Done.

## Quy tắc cập nhật tối thiểu

- Trước khi code: owner nhận card từ `READY`, ghi ngày bắt đầu và chuyển sang `IN PROGRESS`.
- Trước khi mở PR: hoàn tất checklist, gắn requirement/contract/test liên quan và chuyển `REVIEW`.
- Sau khi merge vào nhánh tích hợp: reviewer xác nhận evidence, chuyển `DONE` và ghi vào progress log.
- Cuối mỗi ngày làm việc: cập nhật blocker, ngày dự kiến xong và một dòng trong [progress log](./registers/progress-log.md).
- Cuối sprint: chốt tổng task/estimate đã Done, carry-over và quyết định scope sprint kế tiếp.

## Công thức tiến độ

- Sprint progress = tổng estimate của card `DONE` / tổng estimate đã `COMMITTED`.
- Milestone progress chỉ tính card `DONE`; không tính card đang review là hoàn thành.
- Card thêm giữa sprint phải gắn `UNPLANNED`; card bị bỏ phải ghi lý do, không xóa khỏi lịch sử.

Nguồn truy vết: [SRS 2.0](../../srs/v2/README.md), [MVP delivery plan](../implementation/02-mvp-delivery-plan.md), [MVP traceability](../implementation/04-mvp-traceability.md), [API/Event contracts](../contracts/README.md) và [test design](../detailed-design/03-06-test-design/README.md).
