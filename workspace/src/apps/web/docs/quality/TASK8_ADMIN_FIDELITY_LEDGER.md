# Task 8 — Admin Organization and Staff fidelity ledger

Status: `accepted` by Supervisor on 2026-10-28 at commit `93a54f6`.

Ảnh BEFORE đã được chụp lại ngày 2026-10-28 sau khi chờ nội dung hoặc trạng thái lỗi và chờ loading biến mất: 62/62 lượt Playwright đạt. Các lượt chụp cũ chỉ hiện nền trống không được dùng. Kiểm tra trực tiếp ảnh chi tiết nhân viên và modal thêm thành viên xác nhận nội dung đã render; các ảnh chưa phải verdict fidelity. RED: logo thiếu ảnh chính thức, modal tạo tổ chức rộng 640px thay vì 720px, thiếu BlueLine/ORG-001, thiếu trường mã số thuế và URL chỉnh sửa USR-0018 không mở modal. Các mismatch lịch sử đã được remediation theo RED→GREEN; evidence/verdict hiện hành được ghi ở phần sau, mọi acceptance vẫn chờ Supervisor.

Figma session: `c65ca369-95ff-4cd8-b90e-a673c9343e50`. Each listed frame was fetched independently with `get_design_context`, `resource:figma-design-to-code`, and a screenshot. No listed frame is named `Legacy`, so none is excluded.

Worker tiếp tục mở session `c065e6ce-4f63-404a-be04-67066d381305` và đọc lại đủ 31 node bằng `get_design_context` có screenshot. Các frame modal nhân viên là chỉnh membership (nhà xe và nhân viên cố định, vai trò, trạng thái, lý do), không phải form chỉnh thông tin liên hệ hiện có. `USR-0024` là tài khoản hỗ trợ nền tảng đã khóa, không phải nhân viên nhà xe; dữ liệu hiển thị email/điện thoại ở Figma đã được che một phần.

## Before-edit summary (lịch sử trước remediation)

- Admin shell is structurally different: current desktop uses a 72px header plus left sidebar, text `BLUE`, and generic context copy; Figma uses an 88px white top navigation with official 110×40 logo inside a 126×48 wrapper, five horizontal destinations, and account action.
- Organization fixtures contain 3 unrelated demo records; Figma requires 10 specific records. Organization list/table, detail hierarchy, legal/contact fields, member table and create dialog all differ.
- Staff fixtures contain 4 unrelated demo records; Figma requires 10 specific visible list records and 10 independent detail/edit personas. Current detail cards and generic create/edit dialog do not reproduce Figma hierarchy, role/member fields or modal state.
- Missing persona routes correctly render not-found in BEFORE evidence; no unrelated record is reused as proof.
- Current feature CSS contains direct color/effect primitives, which violates the semantic-token rule and must be removed during GREEN implementation.

## Case matrix

| Node | Exact Figma frame | Canonical reproduction | Deterministic fixture/setup | BEFORE mismatch | Focused assertion | Worker verdict |
| --- | --- | --- | --- | --- | --- | --- |
| `1185:61` | Admin / Quản trị nền tảng / Tổ chức / White Topnav / 1440 | `/admin/organizations` | 10 exact organization fixtures | shell/logo/banner/list/filter/table/data differ | shell + 10 exact rows | pending Supervisor |
| `1185:760` | Admin / Quản trị nền tảng / Chi tiết tổ chức / White Topnav / 1440 | `/admin/organizations/ORG-001` | BlueLine Co. | current record missing; profile/member hierarchy absent | exact profile + 3 members | pending Supervisor |
| `1185:834` | Admin / Tổ chức / Thêm tổ chức trên danh sách / Modal | `/admin/organizations?dialog=create` | list + URL-owned create dialog | fields/copy/geometry differ | exact six fields + actions | pending Supervisor |
| `1186:764` | Admin / Quản trị nền tảng / Nhân viên / White Topnav / 1440 | `/admin/staff` | 10 exact staff fixtures | shell/list/roles/masked data differ | exact 10 rows | pending Supervisor |
| `1186:778` | Admin / Quản trị nền tảng / Chi tiết nhân viên / White Topnav / 1440 | `/admin/staff/USR-0018` | Nguyễn Hoàng Long | missing fixture and hierarchy | exact account + membership | pending Supervisor |
| `1215:162` | Admin / Nhân viên / Trần Thu Hà / 1440 | `/admin/staff/USR-0019` | Trần Thu Hà | missing fixture | exact persona | pending Supervisor |
| `1215:241` | Admin / Nhân viên / Hoàng Nam / 1440 | `/admin/staff/USR-0021` | Hoàng Nam | missing fixture | exact persona | pending Supervisor |
| `1215:320` | Admin / Nhân viên / Lê Minh Anh / 1440 | `/admin/staff/USR-0024` | Lê Minh Anh, locked platform support | missing fixture/state | exact locked persona | pending Supervisor |
| `1230:847` | Admin / Nhân viên nhà xe / Phạm Ngọc Mai / 1440 | `/admin/staff/USR-0031` | Phạm Ngọc Mai | missing fixture | exact persona | pending Supervisor |
| `1230:926` | Admin / Nhân viên nhà xe / Lê Minh Khang / 1440 | `/admin/staff/USR-0032` | Lê Minh Khang | missing fixture | exact persona | pending Supervisor |
| `1230:1005` | Admin / Nhân viên nhà xe / Võ Thành Đạt / 1440 | `/admin/staff/USR-0033` | Võ Thành Đạt | missing fixture | exact persona | pending Supervisor |
| `1230:1084` | Admin / Nhân viên nhà xe / Bùi Khánh Linh / 1440 | `/admin/staff/USR-0034` | Bùi Khánh Linh | missing fixture | exact persona | pending Supervisor |
| `1230:1163` | Admin / Nhân viên nhà xe / Đỗ Minh Anh / 1440 | `/admin/staff/USR-0035` | Đỗ Minh Anh | missing fixture | exact persona | pending Supervisor |
| `1230:1242` | Admin / Nhân viên nhà xe / Hoàng Quốc Bảo / 1440 | `/admin/staff/USR-0036` | Hoàng Quốc Bảo | missing fixture | exact persona | pending Supervisor |
| `1230:1321` | Admin / Nhân viên nhà xe / Ngô Lan Chi / 1440 | `/admin/staff/USR-0037` | Ngô Lan Chi | missing fixture | exact persona | pending Supervisor |
| `1234:272` | Admin / Thêm thành viên / Tổ chức cố định / Modal | `/admin/organizations/ORG-001?dialog=create-member` | BlueLine fixed | URL state unsupported | fixed-org add-member modal | pending Supervisor |
| `1236:312` | Admin / Thêm thành viên / Chọn nhà xe / Modal | `/admin/staff?dialog=create` | selectable organization/member | fields/data differ | selectable-org modal | pending Supervisor |
| `1237:340` | Admin / Thành viên tổ chức / Thêm thành viên / Overlay | `/admin/organizations/ORG-001?view=members&dialog=create-member` | BlueLine member view | view/dialog unsupported | member table + modal | pending Supervisor |
| `1237:1218` | Admin / Thành viên tổ chức / Chỉnh sửa thông tin / Nguyễn Hoàng Long | `/admin/organizations/ORG-001?view=members&dialog=edit-member&staffId=USR-0018` | Nguyễn Hoàng Long | URL state unsupported | exact edit modal | pending Supervisor |
| `1238:414` | Admin / Thành viên tổ chức / Chỉnh sửa thông tin / Trần Thu Hà | `/admin/organizations/ORG-001?view=members&dialog=edit-member&staffId=USR-0019` | Trần Thu Hà | URL state unsupported | exact edit modal | pending Supervisor |
| `1238:545` | Admin / Thành viên tổ chức / Chỉnh sửa thông tin / Hoàng Nam | `/admin/organizations/ORG-001?view=members&dialog=edit-member&staffId=USR-0021` | Hoàng Nam | URL state unsupported | exact edit modal | pending Supervisor |
| `1238:676` | Admin / Chi tiết nhân viên / Chỉnh sửa thông tin / Nguyễn Hoàng Long | `/admin/staff/USR-0018?dialog=edit` | Nguyễn Hoàng Long | missing fixture | exact edit modal | pending Supervisor |
| `1239:520` | Admin / Chi tiết nhân viên / Chỉnh sửa thông tin / Trần Thu Hà | `/admin/staff/USR-0019?dialog=edit` | Trần Thu Hà | missing fixture | exact edit modal | pending Supervisor |
| `1239:735` | Admin / Chi tiết nhân viên / Chỉnh sửa thông tin / Hoàng Nam | `/admin/staff/USR-0021?dialog=edit` | Hoàng Nam | missing fixture | exact edit modal | pending Supervisor |
| `1239:950` | Admin / Chi tiết nhân viên / Chỉnh sửa thông tin / Phạm Ngọc Mai | `/admin/staff/USR-0031?dialog=edit` | Phạm Ngọc Mai | missing fixture | exact edit modal | pending Supervisor |
| `1239:1762` | Admin / Chi tiết nhân viên / Chỉnh sửa thông tin / Lê Minh Khang | `/admin/staff/USR-0032?dialog=edit` | Lê Minh Khang | missing fixture | exact edit modal | pending Supervisor |
| `1239:1977` | Admin / Chi tiết nhân viên / Chỉnh sửa thông tin / Võ Thành Đạt | `/admin/staff/USR-0033?dialog=edit` | Võ Thành Đạt | missing fixture | exact edit modal | pending Supervisor |
| `1239:2192` | Admin / Chi tiết nhân viên / Chỉnh sửa thông tin / Bùi Khánh Linh | `/admin/staff/USR-0034?dialog=edit` | Bùi Khánh Linh | missing fixture | exact edit modal | pending Supervisor |
| `1239:2407` | Admin / Chi tiết nhân viên / Chỉnh sửa thông tin / Đỗ Minh Anh | `/admin/staff/USR-0035?dialog=edit` | Đỗ Minh Anh | missing fixture | exact edit modal | pending Supervisor |
| `1239:2622` | Admin / Chi tiết nhân viên / Chỉnh sửa thông tin / Hoàng Quốc Bảo | `/admin/staff/USR-0036?dialog=edit` | Hoàng Quốc Bảo | missing fixture | exact edit modal | pending Supervisor |
| `1239:2837` | Admin / Chi tiết nhân viên / Chỉnh sửa thông tin / Ngô Lan Chi | `/admin/staff/USR-0037?dialog=edit` | Ngô Lan Chi | missing fixture | exact edit modal | pending Supervisor |

Evidence paths follow `docs/quality/evidence/task-8/{before,final}/<slug>-{w1440,w360}.png`. Final paths and per-row outcomes will be appended after GREEN verification.


## Liên kết BEFORE theo từng node

| Node | Figma | 1440 | 360 |
| --- | --- | --- | --- |
| `1185:61` | [Frame Figma](https://www.figma.com/design/OCkWSOZQ8Pq8AejXccajpO?node-id=1185-61) | [1440](evidence/task-8/before/organizations-list-w1440.png) | [360](evidence/task-8/before/organizations-list-w360.png) |
| `1185:760` | [Frame Figma](https://www.figma.com/design/OCkWSOZQ8Pq8AejXccajpO?node-id=1185-760) | [1440](evidence/task-8/before/organization-detail-blue-line-w1440.png) | [360](evidence/task-8/before/organization-detail-blue-line-w360.png) |
| `1185:834` | [Frame Figma](https://www.figma.com/design/OCkWSOZQ8Pq8AejXccajpO?node-id=1185-834) | [1440](evidence/task-8/before/organization-create-w1440.png) | [360](evidence/task-8/before/organization-create-w360.png) |
| `1186:764` | [Frame Figma](https://www.figma.com/design/OCkWSOZQ8Pq8AejXccajpO?node-id=1186-764) | [1440](evidence/task-8/before/staff-list-w1440.png) | [360](evidence/task-8/before/staff-list-w360.png) |
| `1186:778` | [Frame Figma](https://www.figma.com/design/OCkWSOZQ8Pq8AejXccajpO?node-id=1186-778) | [1440](evidence/task-8/before/staff-detail-nguyen-hoang-long-w1440.png) | [360](evidence/task-8/before/staff-detail-nguyen-hoang-long-w360.png) |
| `1215:162` | [Frame Figma](https://www.figma.com/design/OCkWSOZQ8Pq8AejXccajpO?node-id=1215-162) | [1440](evidence/task-8/before/staff-detail-tran-thu-ha-w1440.png) | [360](evidence/task-8/before/staff-detail-tran-thu-ha-w360.png) |
| `1215:241` | [Frame Figma](https://www.figma.com/design/OCkWSOZQ8Pq8AejXccajpO?node-id=1215-241) | [1440](evidence/task-8/before/staff-detail-hoang-nam-w1440.png) | [360](evidence/task-8/before/staff-detail-hoang-nam-w360.png) |
| `1215:320` | [Frame Figma](https://www.figma.com/design/OCkWSOZQ8Pq8AejXccajpO?node-id=1215-320) | [1440](evidence/task-8/before/staff-detail-le-minh-anh-w1440.png) | [360](evidence/task-8/before/staff-detail-le-minh-anh-w360.png) |
| `1230:847` | [Frame Figma](https://www.figma.com/design/OCkWSOZQ8Pq8AejXccajpO?node-id=1230-847) | [1440](evidence/task-8/before/staff-detail-pham-ngoc-mai-w1440.png) | [360](evidence/task-8/before/staff-detail-pham-ngoc-mai-w360.png) |
| `1230:926` | [Frame Figma](https://www.figma.com/design/OCkWSOZQ8Pq8AejXccajpO?node-id=1230-926) | [1440](evidence/task-8/before/staff-detail-le-minh-khang-w1440.png) | [360](evidence/task-8/before/staff-detail-le-minh-khang-w360.png) |
| `1230:1005` | [Frame Figma](https://www.figma.com/design/OCkWSOZQ8Pq8AejXccajpO?node-id=1230-1005) | [1440](evidence/task-8/before/staff-detail-vo-thanh-dat-w1440.png) | [360](evidence/task-8/before/staff-detail-vo-thanh-dat-w360.png) |
| `1230:1084` | [Frame Figma](https://www.figma.com/design/OCkWSOZQ8Pq8AejXccajpO?node-id=1230-1084) | [1440](evidence/task-8/before/staff-detail-bui-khanh-linh-w1440.png) | [360](evidence/task-8/before/staff-detail-bui-khanh-linh-w360.png) |
| `1230:1163` | [Frame Figma](https://www.figma.com/design/OCkWSOZQ8Pq8AejXccajpO?node-id=1230-1163) | [1440](evidence/task-8/before/staff-detail-do-minh-anh-w1440.png) | [360](evidence/task-8/before/staff-detail-do-minh-anh-w360.png) |
| `1230:1242` | [Frame Figma](https://www.figma.com/design/OCkWSOZQ8Pq8AejXccajpO?node-id=1230-1242) | [1440](evidence/task-8/before/staff-detail-hoang-quoc-bao-w1440.png) | [360](evidence/task-8/before/staff-detail-hoang-quoc-bao-w360.png) |
| `1230:1321` | [Frame Figma](https://www.figma.com/design/OCkWSOZQ8Pq8AejXccajpO?node-id=1230-1321) | [1440](evidence/task-8/before/staff-detail-ngo-lan-chi-w1440.png) | [360](evidence/task-8/before/staff-detail-ngo-lan-chi-w360.png) |
| `1234:272` | [Frame Figma](https://www.figma.com/design/OCkWSOZQ8Pq8AejXccajpO?node-id=1234-272) | [1440](evidence/task-8/before/organization-member-create-fixed-w1440.png) | [360](evidence/task-8/before/organization-member-create-fixed-w360.png) |
| `1236:312` | [Frame Figma](https://www.figma.com/design/OCkWSOZQ8Pq8AejXccajpO?node-id=1236-312) | [1440](evidence/task-8/before/staff-member-create-w1440.png) | [360](evidence/task-8/before/staff-member-create-w360.png) |
| `1237:340` | [Frame Figma](https://www.figma.com/design/OCkWSOZQ8Pq8AejXccajpO?node-id=1237-340) | [1440](evidence/task-8/before/organization-members-create-w1440.png) | [360](evidence/task-8/before/organization-members-create-w360.png) |
| `1237:1218` | [Frame Figma](https://www.figma.com/design/OCkWSOZQ8Pq8AejXccajpO?node-id=1237-1218) | [1440](evidence/task-8/before/organization-member-edit-nguyen-hoang-long-w1440.png) | [360](evidence/task-8/before/organization-member-edit-nguyen-hoang-long-w360.png) |
| `1238:414` | [Frame Figma](https://www.figma.com/design/OCkWSOZQ8Pq8AejXccajpO?node-id=1238-414) | [1440](evidence/task-8/before/organization-member-edit-tran-thu-ha-w1440.png) | [360](evidence/task-8/before/organization-member-edit-tran-thu-ha-w360.png) |
| `1238:545` | [Frame Figma](https://www.figma.com/design/OCkWSOZQ8Pq8AejXccajpO?node-id=1238-545) | [1440](evidence/task-8/before/organization-member-edit-hoang-nam-w1440.png) | [360](evidence/task-8/before/organization-member-edit-hoang-nam-w360.png) |
| `1238:676` | [Frame Figma](https://www.figma.com/design/OCkWSOZQ8Pq8AejXccajpO?node-id=1238-676) | [1440](evidence/task-8/before/staff-edit-nguyen-hoang-long-w1440.png) | [360](evidence/task-8/before/staff-edit-nguyen-hoang-long-w360.png) |
| `1239:520` | [Frame Figma](https://www.figma.com/design/OCkWSOZQ8Pq8AejXccajpO?node-id=1239-520) | [1440](evidence/task-8/before/staff-edit-tran-thu-ha-w1440.png) | [360](evidence/task-8/before/staff-edit-tran-thu-ha-w360.png) |
| `1239:735` | [Frame Figma](https://www.figma.com/design/OCkWSOZQ8Pq8AejXccajpO?node-id=1239-735) | [1440](evidence/task-8/before/staff-edit-hoang-nam-w1440.png) | [360](evidence/task-8/before/staff-edit-hoang-nam-w360.png) |
| `1239:950` | [Frame Figma](https://www.figma.com/design/OCkWSOZQ8Pq8AejXccajpO?node-id=1239-950) | [1440](evidence/task-8/before/staff-edit-pham-ngoc-mai-w1440.png) | [360](evidence/task-8/before/staff-edit-pham-ngoc-mai-w360.png) |
| `1239:1762` | [Frame Figma](https://www.figma.com/design/OCkWSOZQ8Pq8AejXccajpO?node-id=1239-1762) | [1440](evidence/task-8/before/staff-edit-le-minh-khang-w1440.png) | [360](evidence/task-8/before/staff-edit-le-minh-khang-w360.png) |
| `1239:1977` | [Frame Figma](https://www.figma.com/design/OCkWSOZQ8Pq8AejXccajpO?node-id=1239-1977) | [1440](evidence/task-8/before/staff-edit-vo-thanh-dat-w1440.png) | [360](evidence/task-8/before/staff-edit-vo-thanh-dat-w360.png) |
| `1239:2192` | [Frame Figma](https://www.figma.com/design/OCkWSOZQ8Pq8AejXccajpO?node-id=1239-2192) | [1440](evidence/task-8/before/staff-edit-bui-khanh-linh-w1440.png) | [360](evidence/task-8/before/staff-edit-bui-khanh-linh-w360.png) |
| `1239:2407` | [Frame Figma](https://www.figma.com/design/OCkWSOZQ8Pq8AejXccajpO?node-id=1239-2407) | [1440](evidence/task-8/before/staff-edit-do-minh-anh-w1440.png) | [360](evidence/task-8/before/staff-edit-do-minh-anh-w360.png) |
| `1239:2622` | [Frame Figma](https://www.figma.com/design/OCkWSOZQ8Pq8AejXccajpO?node-id=1239-2622) | [1440](evidence/task-8/before/staff-edit-hoang-quoc-bao-w1440.png) | [360](evidence/task-8/before/staff-edit-hoang-quoc-bao-w360.png) |
| `1239:2837` | [Frame Figma](https://www.figma.com/design/OCkWSOZQ8Pq8AejXccajpO?node-id=1239-2837) | [1440](evidence/task-8/before/staff-edit-ngo-lan-chi-w1440.png) | [360](evidence/task-8/before/staff-edit-ngo-lan-chi-w360.png) |

## Dữ liệu đã đối chiếu trực tiếp

- Organization `1185:760`: BlueLine Co., ORG-001, tên pháp lý Công ty TNHH Vận tải BlueLine, mã số thuế 0312345678, email contact@blueline.vn, điện thoại 028 3822 4567, địa chỉ 12 Nguyễn Huệ, TP. Hồ Chí Minh; ba thành viên Nguyễn Hoàng Long, Trần Thu Hà, Hoàng Nam.
- Staff list `1186:764`: Nguyễn Hoàng Long, Trần Thu Hà, Hoàng Nam, Phạm Ngọc Mai, Lê Minh Khang, Võ Thành Đạt, Bùi Khánh Linh, Đỗ Minh Anh, Hoàng Quốc Bảo, Ngô Lan Chi; danh sách chỉ hiển thị email đã mask.
- Modal `1185:834`: Tên pháp lý, Tên hiển thị, Mã số thuế, Địa chỉ, Email liên hệ, Số điện thoại; khung desktop 720px.
- Các modal membership cố định danh tính khi chỉnh sửa; vai trò của Long là Quản trị nhà xe, Hà là Lập lịch, Nam là Tài xế; bảy nhân viên còn lại là Lập lịch. Không suy diễn thông tin liên hệ đầy đủ từ dữ liệu đã mask.

## Rulings của Supervisor trong continuation

- Ngày membership dùng authority Organization-member: Hà02/08/2026, Nam04/08/2026. Staff detail/backdrop ghi01/08 là conflict prototype; giữ một truth, không fork theo route. Cost: khác literal ngày trên1215:162/241 và1239:520/735.
- Staff URL giữ active Nhân viên ở1239:1977/2192/2407/2622/2837, dù Figma backdrop underline Đơn đặt vé. Cost: khác underline ở năm frame sai ngữ cảnh.
- Riêng1238:676 giữ suffixORG-001 và CTA backdropGán vai trò; query/business meaning vẫn edit membership.
- Verifier test infrastructure: port40401 không phải pathname404. Regression RED4/5→GREEN5/5; verify:build/prerender2/deep-link3 PASS sau narrow pathname-only fix được Supervisor cho phép.

## Evidence theo từng node sau remediation

Session continuation `c38e208f-2685-4613-8451-076a1f5322ea`:31context+screenshot và31metadata độc lập. Figma PNG được tool scale1024; implementation1440 dùng native frame height1154/1098/1069/818/645, mobile360×800 là adaptation. Modal mobile chụp viewport thật để tránh stitched full-page làm overlay trông bị ngắt; list/detail chụp full page. Mỗi case còn có asset geometry JSON cạnh ảnh.

| Node | Figma local | Final1440 | Final360 | So ảnh độc lập / recommendation |
| --- | --- | --- | --- | --- |
| `1185:61` | [Figma](evidence/task-8/figma/1185-61.png) | [1440](evidence/task-8/final/organizations-list-w1440.png) | [360](evidence/task-8/final/organizations-list-w360.png) | Đã xem cặp ảnh riêng; đề xuất review, verdict pending Supervisor |
| `1185:760` | [Figma](evidence/task-8/figma/1185-760.png) | [1440](evidence/task-8/final/organization-detail-blue-line-w1440.png) | [360](evidence/task-8/final/organization-detail-blue-line-w360.png) | Đã xem cặp ảnh riêng; đề xuất review, verdict pending Supervisor |
| `1185:834` | [Figma](evidence/task-8/figma/1185-834.png) | [1440](evidence/task-8/final/organization-create-w1440.png) | [360](evidence/task-8/final/organization-create-w360.png) | Đã xem cặp ảnh riêng; đề xuất review, verdict pending Supervisor |
| `1186:764` | [Figma](evidence/task-8/figma/1186-764.png) | [1440](evidence/task-8/final/staff-list-w1440.png) | [360](evidence/task-8/final/staff-list-w360.png) | Đã xem cặp ảnh riêng; đề xuất review, verdict pending Supervisor |
| `1186:778` | [Figma](evidence/task-8/figma/1186-778.png) | [1440](evidence/task-8/final/staff-detail-nguyen-hoang-long-w1440.png) | [360](evidence/task-8/final/staff-detail-nguyen-hoang-long-w360.png) | Đã xem cặp ảnh riêng; đề xuất review, verdict pending Supervisor |
| `1215:162` | [Figma](evidence/task-8/figma/1215-162.png) | [1440](evidence/task-8/final/staff-detail-tran-thu-ha-w1440.png) | [360](evidence/task-8/final/staff-detail-tran-thu-ha-w360.png) | Đã xem cặp ảnh riêng; đề xuất review, verdict pending Supervisor; ngày theo ruling canonical |
| `1215:241` | [Figma](evidence/task-8/figma/1215-241.png) | [1440](evidence/task-8/final/staff-detail-hoang-nam-w1440.png) | [360](evidence/task-8/final/staff-detail-hoang-nam-w360.png) | Đã xem cặp ảnh riêng; đề xuất review, verdict pending Supervisor; ngày theo ruling canonical |
| `1215:320` | [Figma](evidence/task-8/figma/1215-320.png) | [1440](evidence/task-8/final/staff-detail-le-minh-anh-w1440.png) | [360](evidence/task-8/final/staff-detail-le-minh-anh-w360.png) | Đã xem cặp ảnh riêng; đề xuất review, verdict pending Supervisor |
| `1230:847` | [Figma](evidence/task-8/figma/1230-847.png) | [1440](evidence/task-8/final/staff-detail-pham-ngoc-mai-w1440.png) | [360](evidence/task-8/final/staff-detail-pham-ngoc-mai-w360.png) | Đã xem cặp ảnh riêng; đề xuất review, verdict pending Supervisor |
| `1230:926` | [Figma](evidence/task-8/figma/1230-926.png) | [1440](evidence/task-8/final/staff-detail-le-minh-khang-w1440.png) | [360](evidence/task-8/final/staff-detail-le-minh-khang-w360.png) | Đã xem cặp ảnh riêng; đề xuất review, verdict pending Supervisor |
| `1230:1005` | [Figma](evidence/task-8/figma/1230-1005.png) | [1440](evidence/task-8/final/staff-detail-vo-thanh-dat-w1440.png) | [360](evidence/task-8/final/staff-detail-vo-thanh-dat-w360.png) | Đã xem cặp ảnh riêng; đề xuất review, verdict pending Supervisor |
| `1230:1084` | [Figma](evidence/task-8/figma/1230-1084.png) | [1440](evidence/task-8/final/staff-detail-bui-khanh-linh-w1440.png) | [360](evidence/task-8/final/staff-detail-bui-khanh-linh-w360.png) | Đã xem cặp ảnh riêng; đề xuất review, verdict pending Supervisor |
| `1230:1163` | [Figma](evidence/task-8/figma/1230-1163.png) | [1440](evidence/task-8/final/staff-detail-do-minh-anh-w1440.png) | [360](evidence/task-8/final/staff-detail-do-minh-anh-w360.png) | Đã xem cặp ảnh riêng; đề xuất review, verdict pending Supervisor |
| `1230:1242` | [Figma](evidence/task-8/figma/1230-1242.png) | [1440](evidence/task-8/final/staff-detail-hoang-quoc-bao-w1440.png) | [360](evidence/task-8/final/staff-detail-hoang-quoc-bao-w360.png) | Đã xem cặp ảnh riêng; đề xuất review, verdict pending Supervisor |
| `1230:1321` | [Figma](evidence/task-8/figma/1230-1321.png) | [1440](evidence/task-8/final/staff-detail-ngo-lan-chi-w1440.png) | [360](evidence/task-8/final/staff-detail-ngo-lan-chi-w360.png) | Đã xem cặp ảnh riêng; đề xuất review, verdict pending Supervisor |
| `1234:272` | [Figma](evidence/task-8/figma/1234-272.png) | [1440](evidence/task-8/final/organization-member-create-fixed-w1440.png) | [360](evidence/task-8/final/organization-member-create-fixed-w360.png) | Đã xem cặp ảnh riêng; đề xuất review, verdict pending Supervisor |
| `1236:312` | [Figma](evidence/task-8/figma/1236-312.png) | [1440](evidence/task-8/final/staff-member-create-w1440.png) | [360](evidence/task-8/final/staff-member-create-w360.png) | Đã xem cặp ảnh riêng; đề xuất review, verdict pending Supervisor |
| `1237:340` | [Figma](evidence/task-8/figma/1237-340.png) | [1440](evidence/task-8/final/organization-members-create-w1440.png) | [360](evidence/task-8/final/organization-members-create-w360.png) | Đã xem cặp ảnh riêng; đề xuất review, verdict pending Supervisor |
| `1237:1218` | [Figma](evidence/task-8/figma/1237-1218.png) | [1440](evidence/task-8/final/organization-member-edit-nguyen-hoang-long-w1440.png) | [360](evidence/task-8/final/organization-member-edit-nguyen-hoang-long-w360.png) | Đã xem cặp ảnh riêng; đề xuất review, verdict pending Supervisor |
| `1238:414` | [Figma](evidence/task-8/figma/1238-414.png) | [1440](evidence/task-8/final/organization-member-edit-tran-thu-ha-w1440.png) | [360](evidence/task-8/final/organization-member-edit-tran-thu-ha-w360.png) | Đã xem cặp ảnh riêng; đề xuất review, verdict pending Supervisor |
| `1238:545` | [Figma](evidence/task-8/figma/1238-545.png) | [1440](evidence/task-8/final/organization-member-edit-hoang-nam-w1440.png) | [360](evidence/task-8/final/organization-member-edit-hoang-nam-w360.png) | Đã xem cặp ảnh riêng; đề xuất review, verdict pending Supervisor |
| `1238:676` | [Figma](evidence/task-8/figma/1238-676.png) | [1440](evidence/task-8/final/staff-edit-nguyen-hoang-long-w1440.png) | [360](evidence/task-8/final/staff-edit-nguyen-hoang-long-w360.png) | Đã xem cặp ảnh riêng; đề xuất review, verdict pending Supervisor |
| `1239:520` | [Figma](evidence/task-8/figma/1239-520.png) | [1440](evidence/task-8/final/staff-edit-tran-thu-ha-w1440.png) | [360](evidence/task-8/final/staff-edit-tran-thu-ha-w360.png) | Đã xem cặp ảnh riêng; đề xuất review, verdict pending Supervisor; ngày theo ruling canonical |
| `1239:735` | [Figma](evidence/task-8/figma/1239-735.png) | [1440](evidence/task-8/final/staff-edit-hoang-nam-w1440.png) | [360](evidence/task-8/final/staff-edit-hoang-nam-w360.png) | Đã xem cặp ảnh riêng; đề xuất review, verdict pending Supervisor; ngày theo ruling canonical |
| `1239:950` | [Figma](evidence/task-8/figma/1239-950.png) | [1440](evidence/task-8/final/staff-edit-pham-ngoc-mai-w1440.png) | [360](evidence/task-8/final/staff-edit-pham-ngoc-mai-w360.png) | Đã xem cặp ảnh riêng; đề xuất review, verdict pending Supervisor |
| `1239:1762` | [Figma](evidence/task-8/figma/1239-1762.png) | [1440](evidence/task-8/final/staff-edit-le-minh-khang-w1440.png) | [360](evidence/task-8/final/staff-edit-le-minh-khang-w360.png) | Đã xem cặp ảnh riêng; đề xuất review, verdict pending Supervisor |
| `1239:1977` | [Figma](evidence/task-8/figma/1239-1977.png) | [1440](evidence/task-8/final/staff-edit-vo-thanh-dat-w1440.png) | [360](evidence/task-8/final/staff-edit-vo-thanh-dat-w360.png) | Đã xem cặp ảnh riêng; đề xuất review, verdict pending Supervisor; active nav theo ruling route |
| `1239:2192` | [Figma](evidence/task-8/figma/1239-2192.png) | [1440](evidence/task-8/final/staff-edit-bui-khanh-linh-w1440.png) | [360](evidence/task-8/final/staff-edit-bui-khanh-linh-w360.png) | Đã xem cặp ảnh riêng; đề xuất review, verdict pending Supervisor; active nav theo ruling route |
| `1239:2407` | [Figma](evidence/task-8/figma/1239-2407.png) | [1440](evidence/task-8/final/staff-edit-do-minh-anh-w1440.png) | [360](evidence/task-8/final/staff-edit-do-minh-anh-w360.png) | Đã xem cặp ảnh riêng; đề xuất review, verdict pending Supervisor; active nav theo ruling route |
| `1239:2622` | [Figma](evidence/task-8/figma/1239-2622.png) | [1440](evidence/task-8/final/staff-edit-hoang-quoc-bao-w1440.png) | [360](evidence/task-8/final/staff-edit-hoang-quoc-bao-w360.png) | Đã xem cặp ảnh riêng; đề xuất review, verdict pending Supervisor; active nav theo ruling route |
| `1239:2837` | [Figma](evidence/task-8/figma/1239-2837.png) | [1440](evidence/task-8/final/staff-edit-ngo-lan-chi-w1440.png) | [360](evidence/task-8/final/staff-edit-ngo-lan-chi-w360.png) | Đã xem cặp ảnh riêng; đề xuất review, verdict pending Supervisor; active nav theo ruling route |

## Supervisor verdicts — 2026-10-28

Supervisor independently created Figma session `a62d7650-d22e-4f8d-bde4-22082983d83a`, reopened all 31 exact nodes with screenshot, inspected all 31 dedicated comparison pairs and reran the owned gates. The three documented rulings remain explicit deviations; no Critical/Important finding remains.

| Node | Verdict | Independent basis |
| --- | --- | --- |
| `1185:61` | ACCEPT | Supervisor independently reopened exact Figma context/screenshot, inspected the dedicated comparison pair and verified the owned route/evidence gate. |
| `1185:760` | ACCEPT | Supervisor independently reopened exact Figma context/screenshot, inspected the dedicated comparison pair and verified the owned route/evidence gate. |
| `1185:834` | ACCEPT | Supervisor independently reopened exact Figma context/screenshot, inspected the dedicated comparison pair and verified the owned route/evidence gate. |
| `1186:764` | ACCEPT | Supervisor independently reopened exact Figma context/screenshot, inspected the dedicated comparison pair and verified the owned route/evidence gate. |
| `1186:778` | ACCEPT | Supervisor independently reopened exact Figma context/screenshot, inspected the dedicated comparison pair and verified the owned route/evidence gate. |
| `1215:162` | ACCEPT | Supervisor independently reopened exact Figma context/screenshot, inspected the dedicated comparison pair and verified the owned route/evidence gate. |
| `1215:241` | ACCEPT | Supervisor independently reopened exact Figma context/screenshot, inspected the dedicated comparison pair and verified the owned route/evidence gate. |
| `1215:320` | ACCEPT | Supervisor independently reopened exact Figma context/screenshot, inspected the dedicated comparison pair and verified the owned route/evidence gate. |
| `1230:847` | ACCEPT | Supervisor independently reopened exact Figma context/screenshot, inspected the dedicated comparison pair and verified the owned route/evidence gate. |
| `1230:926` | ACCEPT | Supervisor independently reopened exact Figma context/screenshot, inspected the dedicated comparison pair and verified the owned route/evidence gate. |
| `1230:1005` | ACCEPT | Supervisor independently reopened exact Figma context/screenshot, inspected the dedicated comparison pair and verified the owned route/evidence gate. |
| `1230:1084` | ACCEPT | Supervisor independently reopened exact Figma context/screenshot, inspected the dedicated comparison pair and verified the owned route/evidence gate. |
| `1230:1163` | ACCEPT | Supervisor independently reopened exact Figma context/screenshot, inspected the dedicated comparison pair and verified the owned route/evidence gate. |
| `1230:1242` | ACCEPT | Supervisor independently reopened exact Figma context/screenshot, inspected the dedicated comparison pair and verified the owned route/evidence gate. |
| `1230:1321` | ACCEPT | Supervisor independently reopened exact Figma context/screenshot, inspected the dedicated comparison pair and verified the owned route/evidence gate. |
| `1234:272` | ACCEPT | Supervisor independently reopened exact Figma context/screenshot, inspected the dedicated comparison pair and verified the owned route/evidence gate. |
| `1236:312` | ACCEPT | Supervisor independently reopened exact Figma context/screenshot, inspected the dedicated comparison pair and verified the owned route/evidence gate. |
| `1237:340` | ACCEPT | Supervisor independently reopened exact Figma context/screenshot, inspected the dedicated comparison pair and verified the owned route/evidence gate. |
| `1237:1218` | ACCEPT | Supervisor independently reopened exact Figma context/screenshot, inspected the dedicated comparison pair and verified the owned route/evidence gate. |
| `1238:414` | ACCEPT | Supervisor independently reopened exact Figma context/screenshot, inspected the dedicated comparison pair and verified the owned route/evidence gate. |
| `1238:545` | ACCEPT | Supervisor independently reopened exact Figma context/screenshot, inspected the dedicated comparison pair and verified the owned route/evidence gate. |
| `1238:676` | ACCEPT | Supervisor independently reopened exact Figma context/screenshot, inspected the dedicated comparison pair and verified the owned route/evidence gate. |
| `1239:520` | ACCEPT | Supervisor independently reopened exact Figma context/screenshot, inspected the dedicated comparison pair and verified the owned route/evidence gate. |
| `1239:735` | ACCEPT | Supervisor independently reopened exact Figma context/screenshot, inspected the dedicated comparison pair and verified the owned route/evidence gate. |
| `1239:950` | ACCEPT | Supervisor independently reopened exact Figma context/screenshot, inspected the dedicated comparison pair and verified the owned route/evidence gate. |
| `1239:1762` | ACCEPT | Supervisor independently reopened exact Figma context/screenshot, inspected the dedicated comparison pair and verified the owned route/evidence gate. |
| `1239:1977` | ACCEPT | Supervisor independently reopened exact Figma context/screenshot, inspected the dedicated comparison pair and verified the owned route/evidence gate. |
| `1239:2192` | ACCEPT | Supervisor independently reopened exact Figma context/screenshot, inspected the dedicated comparison pair and verified the owned route/evidence gate. |
| `1239:2407` | ACCEPT | Supervisor independently reopened exact Figma context/screenshot, inspected the dedicated comparison pair and verified the owned route/evidence gate. |
| `1239:2622` | ACCEPT | Supervisor independently reopened exact Figma context/screenshot, inspected the dedicated comparison pair and verified the owned route/evidence gate. |
| `1239:2837` | ACCEPT | Supervisor independently reopened exact Figma context/screenshot, inspected the dedicated comparison pair and verified the owned route/evidence gate. |

## Asset provenance và geometry

23/23file hash-match với chính asset URL của exact Figma context; fullSHA256/intrinsic roots tại [asset-verification.json](evidence/task-8/asset-verification.json). Không dùng ảnh screenshot làm implementation asset.

| Exact node | Local file | Callsite | Intrinsic → rendered |
| --- | --- | --- | --- |
| `I1185:63;163:11` | `src/assets/brand/blue-official-logo.png` | AdminLayout → BrandLogo(header) | 1021×406 → 110×40; wrapper126×48 |
| `1208:168` | `src/assets/admin/transport-banner.png` | OrganizationPageHeader | 1536×1024 → 1152×184 desktop; object-cover |
| `1198:169` | `src/assets/admin/org-active.svg` | AdminLayout / AdminNavigation | 20×20 → 20×20 |
| `1198:172` | `src/assets/admin/staff.svg` | AdminLayout / AdminNavigation | 20×20 → 20×20 |
| `1245:753` | `src/assets/admin/booking.svg` | AdminLayout / AdminNavigation | 20×20 → 20×20 |
| `1245:756` | `src/assets/admin/payment.svg` | AdminLayout / AdminNavigation | 20×20 → 20×20 |
| `1245:760` | `src/assets/admin/refund.svg` | AdminLayout / AdminNavigation | 20×20 → 20×20 |
| `1211:169` | `src/assets/admin/plus.svg` | OrganizationListPage / AdminFilters / AdminDataTable | 20×20 → 20×20 |
| `1221:252` | `src/assets/admin/search.svg` | OrganizationListPage / AdminFilters / AdminDataTable | 18×18 → 18×18 |
| `1221:193` | `src/assets/admin/organization.svg` | OrganizationListPage / AdminFilters / AdminDataTable | 16×16 → 16×16 |
| `1224:194` | `src/assets/admin/view.svg` | OrganizationListPage / AdminFilters / AdminDataTable | 16×16 → 16×16 |
| `1246:815` | `src/assets/admin/org.svg` | AdminLayout / AdminNavigation | 20×20 → 20×20 |
| `1246:819` | `src/assets/admin/staff-active.svg` | AdminLayout / AdminNavigation | 20×20 → 20×20 |
| `1208:771` | `src/assets/admin/staff-section.svg` | StaffPageHeader | 32×32 → 32×32 |
| `1212:169` | `src/assets/admin/close-organization.svg` | OrganizationDialog / MembershipDialog | 24×24 → 24×24; hit target44×44 |
| `1234:439` | `src/assets/admin/close-member.svg` | OrganizationDialog / MembershipDialog | 24×24 → 24×24; hit target44×44 |
| `1226:199` | `src/assets/admin/back.svg` | OrganizationDetailPage | 18×18 → 18×18 |
| `1226:204` | `src/assets/admin/legal.svg` | OrganizationDetailPage | 22×22 → 22×22 |
| `1226:209` | `src/assets/admin/contact.svg` | OrganizationDetailPage | 22×22 → 22×22 |
| `1226:215` | `src/assets/admin/updated.svg` | OrganizationDetailPage | 22×22 → 22×22 |
| `1227:189` | `src/assets/admin/members.svg` | OrganizationDetailPage | 20×20 → 20×20 |
| `1237:1248` | `src/assets/admin/members-section.svg` | OrganizationDetailPage | 32×32 → 32×32 |
| `1237:1300` | `src/assets/admin/member-chevron.svg` | MembershipDialog.css native select background | 16×16 → 16×16 |

## Legacy visual ownership — ruling Supervisor

Legacy Organization visual test được tách riêng và dùng BlueLine Co./ORG-001; chỉ sáu snapshot Organization (list/detail/dialog ởw360/w1440) được Task8 cập nhật sau xem ảnh. Transaction/state-family baselines giữ nguyên tuyệt đối, carry-forward cho Task9: `admin-transactions-list`, `admin-state-loading`, `admin-state-empty`, `admin-state-error`, `admin-state-forbidden`, `admin-state-not-found` ởcảw360/w1440. Shell mới làm các ảnh cũ khác pixel; không claim whole legacy Admin visual suite xanh, không waive hoặc cập nhật chúng trongTask8. Customer/Auth/Cancellation baselines giữ nguyên, chạy non-update riêng.

## Admin account action — ruling Supervisor

Header Tài khoản không còn dẫn tới Customer-only `/account/tickets`/403. Control mở Admin-owned Radix dialog, dùng existing `clearMockSession`, xóa Query cache prefixadmin rồi vềlogin; không tạo profile field hoặc route mới. Desktop closed state giữ124×44, mobile icon44×44 là adaptation để thao tác logout được. Direct unit RED2→GREEN9/9, browser open/Tab trap/Escape/focus return/logout5/5 và exactfidelity8/8 đạt. Open account dialog không có exact Figma frame; chỉ claim consistency/a11y, không claim canonical fidelity.

## Kiểm tra ảnh cuối và regression responsive bổ sung

Đã xem riêng đủ31cặp Figma–desktop và31ảnh mobile, không dùng representative. So ảnh mobile phát hiện modal membership có overflow nội bộ41px dù trang không overflow; regression `scrollWidth-clientWidth <=1` RED41→GREEN, grid mobile đổi `minmax(0,1fr)` và action min-width0. Các control trong form phải nằm trong dialog. Close icon có hit target44px mở rộng chủ ý, được kiểm tra keyboard riêng thay vì ép hit box vào padding.

Members-view mobile còn bị rule60px thắng ruleauto làm cell bottom628 vượt row bottom581; regression cell containment RED→GREEN bằng override đúng specificity, không đổi desktop. Hai regression cùng đạt2/2. Platform support CTA riêng exact node1215:320 có width148.968px: RED200→GREEN149; operator CTA vẫn200px. Không cập nhật baseline để che các mismatch này.

Các lượt matrix/fidelity trong lúc sửa CSS gặp Vite hot reload (navigation/context destroyed), đã giữ log lịch sử và chạy lại trên source đóng băng. Chỉ kết quả cuối trên source ổn định được dùng làm gate. Các process dừng đều là PID Playwright của chính Worker, đã xác nhận command line/output path trước khi dừng.

Organization create mobile action containment bổ sung RED left14px < dialog16px; mobile min-width149 của hai nút được bỏ để flex vừa innerwidth, không thay desktop149px. Legacy Organization modal test từng chụp backdrop loading: đã thêm đợi10rows trước snapshot, chỉ2dialog baselines thuộc6Organization snapshots được tạo lại sau inspection; không phê duyệt loading backdrop.

Root cause reload được xác nhận từ server log: mỗi lần ghi evidence JSON dưới project có SSR program reload. Spec Task8 đã tách export chủ ý (`TASK8_CAPTURE_ONLY=1` hoặc BEFORE) khỏi regression mặc định chỉ đọc baseline. Không đổi Vite/app route hoặc nới assertion. Final gate sẽ xác minh62non-update và không thay mtime của evidence; capture export vẫn dùng một writer.

## Final gate and carry-forward evidence

Task8 non-update visual:62/62 PASS với2workers,124/124 PNG/JSON final giữ nguyên mtime. Final combined gate:189 PASS +36skip có lý do (chỉ fidelity1440), gồm31case×5width=155 responsive/axe/keyboard,20AdminCRUD/downstream,5account,9fidelity. Customer/Auth/Payment/Cancellation functional bổ sung24/24 PASS. Không claim các legacy visual command dưới đây xanh toàn bộ.

Legacy Customer/Auth/Cancellation/Organization non-update:34 PASS /2pre-existing RED ở1440. `customer-seats-sleeper` khác16479pixels và `customer-seat-limit` khác16085pixels; cả2 tái hiện isolated. Expected summary15:00/full date, actual08:00/compact date và card height khác. Last owning Summary commit `a2761151a58dc4c20a2f766883c7f8e56310e1dc`; baseline commit `da240d5ad73c6940bfaa43bd2677501dd889df07`. Summary blob tại BASE và current cùng `5966334ac4074a1b98eb0c25150e6462f23e1982`; diffBooking/Auth/Trips và Customer baselines bằng0. Supervisor cho phép carry-forward, cấm sửa Customer code/baseline trongTask8. Các Customer functional24/24 và full coverage là gate bảo vệ hành vi.

Task9 legacy command có4RED thực: `admin-transactions-list` và `admin-state-loading` ở360/1440. State-family test dừng ởloading, nên `admin-state-empty/error/forbidden/not-found` chưa được visual-reach trong lượt này; vẫn giữ baseline, carry-forward choTask9, không suy diễn đã chạy/đỏ. Organization-only test2/2 PASS sau readiness10rows; chỉ6Organization baseline thay đổi. Legacy full-page dialog capture giữ convention cũ (phần ngoài viewport có giới hạn stitched overlay); canonical Task8 modal evidence dùng viewport360×800/native frame1440 và không dựa vào stitched legacy capture để kết luận fidelity.

Exact expected/actual/diff cùng SHA256 và owner: [carry-forward manifest](evidence/task-8/carry-forward/manifest.json).

| Case | Expected | Actual | Diff | Recommendation |
| --- | --- | --- | --- | --- |
| `customer-seats-sleeper` w1440 | [expected](evidence/task-8/carry-forward/customer-seats-sleeper-w1440-expected.png) | [actual](evidence/task-8/carry-forward/customer-seats-sleeper-w1440-actual.png) | [diff](evidence/task-8/carry-forward/customer-seats-sleeper-w1440-diff.png) | Carry-forward theo ruling Supervisor, baseline gốc giữ nguyên |
| `customer-seat-limit` w1440 | [expected](evidence/task-8/carry-forward/customer-seat-limit-w1440-expected.png) | [actual](evidence/task-8/carry-forward/customer-seat-limit-w1440-actual.png) | [diff](evidence/task-8/carry-forward/customer-seat-limit-w1440-diff.png) | Carry-forward theo ruling Supervisor, baseline gốc giữ nguyên |
| `admin-transactions-list` w360 | [expected](evidence/task-8/carry-forward/admin-transactions-list-w360-expected.png) | [actual](evidence/task-8/carry-forward/admin-transactions-list-w360-actual.png) | [diff](evidence/task-8/carry-forward/admin-transactions-list-w360-diff.png) | Carry-forward theo ruling Supervisor, baseline gốc giữ nguyên |
| `admin-transactions-list` w1440 | [expected](evidence/task-8/carry-forward/admin-transactions-list-w1440-expected.png) | [actual](evidence/task-8/carry-forward/admin-transactions-list-w1440-actual.png) | [diff](evidence/task-8/carry-forward/admin-transactions-list-w1440-diff.png) | Carry-forward theo ruling Supervisor, baseline gốc giữ nguyên |
| `admin-state-loading` w360 | [expected](evidence/task-8/carry-forward/admin-state-loading-w360-expected.png) | [actual](evidence/task-8/carry-forward/admin-state-loading-w360-actual.png) | [diff](evidence/task-8/carry-forward/admin-state-loading-w360-diff.png) | Carry-forward theo ruling Supervisor, baseline gốc giữ nguyên |
| `admin-state-loading` w1440 | [expected](evidence/task-8/carry-forward/admin-state-loading-w1440-expected.png) | [actual](evidence/task-8/carry-forward/admin-state-loading-w1440-actual.png) | [diff](evidence/task-8/carry-forward/admin-state-loading-w1440-diff.png) | Carry-forward theo ruling Supervisor, baseline gốc giữ nguyên |

## Intermediate-width direct visual inspection

Đã xem thêm18ảnh thật ở768/1024/1920 cho sáu family dưới đây. Các screenshot này bổ sung visual breakpoint review; không thay thế evidence riêng31case tại1440/360 hoặc matrix31×5.

| Family | 768 | 1024 | 1920 |
| --- | --- | --- | --- |
| organization-list | [768](evidence/task-8/responsive/organization-list-w768.png) | [1024](evidence/task-8/responsive/organization-list-w1024.png) | [1920](evidence/task-8/responsive/organization-list-w1920.png) |
| organization-detail | [768](evidence/task-8/responsive/organization-detail-w768.png) | [1024](evidence/task-8/responsive/organization-detail-w1024.png) | [1920](evidence/task-8/responsive/organization-detail-w1920.png) |
| organization-create | [768](evidence/task-8/responsive/organization-create-w768.png) | [1024](evidence/task-8/responsive/organization-create-w1024.png) | [1920](evidence/task-8/responsive/organization-create-w1920.png) |
| staff-list | [768](evidence/task-8/responsive/staff-list-w768.png) | [1024](evidence/task-8/responsive/staff-list-w1024.png) | [1920](evidence/task-8/responsive/staff-list-w1920.png) |
| staff-detail | [768](evidence/task-8/responsive/staff-detail-w768.png) | [1024](evidence/task-8/responsive/staff-detail-w1024.png) | [1920](evidence/task-8/responsive/staff-detail-w1920.png) |
| membership-edit | [768](evidence/task-8/responsive/membership-edit-w768.png) | [1024](evidence/task-8/responsive/membership-edit-w1024.png) | [1920](evidence/task-8/responsive/membership-edit-w1920.png) |

Final static gates: coverage119files/1174tests PASS at95.25/91.02/95.54/96.23; format, zero-warning lint, Node24 typecheck, verifier5/5, production build/prerender2/2/deep-links3/3 PASS. Worker implementation/evidence complete; all31verdicts pending Supervisor, noTask9/push/merge.
