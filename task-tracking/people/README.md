# Roadmap theo từng thành viên

Mỗi thành viên chỉ cần mở file của mình để xem việc theo sprint. [Roadmap cấp nhóm](../02-roadmap.md) dùng để xem milestone; [Product Backlog](../03-product-backlog.md) là nguồn task; [Kanban](../board/README.md) là nguồn trạng thái hiện tại.

| Thành viên | Vai trò | Roadmap riêng | Card bắt đầu ngay | Reviewer chính |
|---|---|---|---|---|
| Hoàng Minh Trí | `BE-1` — Platform & Operations | [Mở roadmap](./be-1-hoang-minh-tri.md) | `S0-BE1-01` | Ngô Quang Sinh |
| Ngô Quang Sinh | `BE-2` — Transaction & Integration | [Mở roadmap](./be-2-ngo-quang-sinh.md) | `S0-BE2-01`, sau đó `S0-BE2-04` | Hoàng Minh Trí |
| Đinh Công Trung Sỹ | `FE` — Web | [Mở roadmap](./fe-dinh-cong-trung-sy.md) | `S0-FE-01` | Ngô Thành Đạt |
| Ngô Thành Đạt | `MOBILE` — Customer & Driver | [Mở roadmap](./mobile-ngo-thanh-dat.md) | `S0-MOB-01` | Đinh Công Trung Sỹ |

## Luồng theo dõi không bị trùng

1. Roadmap cá nhân trả lời: **tôi phải làm gì và bàn giao cho ai**.
2. Product Backlog trả lời: **card có scope, estimate và dependency gì**.
3. Sprint checklist trả lời: **các bước kỹ thuật nhỏ nào phải tick**.
4. Kanban trả lời: **card hiện đang ở trạng thái nào**.
5. Progress log trả lời: **hôm nay đã đổi gì và vì sao**.

Không ghi trạng thái hằng ngày vào roadmap cá nhân. Chỉ chuyển card trên Kanban để tránh bốn nơi hiển thị bốn trạng thái khác nhau.

## Quy tắc bắt đầu

- Mỗi người nhận đúng card `READY` của mình và chuyển sang `IN PROGRESS`.
- WIP tối đa một card/người.
- P0 làm trước; P1 chỉ nhận khi P0 an toàn và còn capacity.
- Handoff contract phải có link PR/commit/test, không bàn giao chỉ bằng tin nhắn.
- Card Done phải đạt [Definition of Done](../04-working-agreements.md#4-definition-of-done-cho-card).
