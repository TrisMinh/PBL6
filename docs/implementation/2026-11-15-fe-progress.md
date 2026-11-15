# Tiến độ FE Travel v3 — 15/11/2026

> Đánh giá sơ bộ này đã được thay thế bằng [báo cáo audit chi tiết sau khi kết nối Figma và chạy kiểm tra](2026-11-15-fe-detailed-audit.md). Các giới hạn thiếu dependencies/Figma bên dưới chỉ mô tả thời điểm rà soát ban đầu.

Nhánh kiểm tra: `codex/fe-be-integration`, nền FE `0bae8172`.
Thiết kế: https://www.figma.com/design/OCkWSOZQ8Pq8AejXccajpO/Travel-v3
Source chính: `workspace/src/apps/web`.

## Kết luận

FE đã dựng phần lớn màn hình và luồng mock, đồng thời đã tích hợp API thật cho nhiều nghiệp vụ. Chưa thể coi là hoàn tất Travel v3 ở chế độ live: admin và một số màn operator vẫn chuyển sang bảng/form tích hợp chung. Không có cơ sở để đưa ra phần trăm hoàn thành hoặc khẳng định khớp Figma 100%.

Đây là rà soát source/route và bằng chứng lưu trong repo. Công cụ Figma trả lỗi khi truy cập file nên chưa đối chiếu được thiết kế online hiện tại. Chưa chạy kiểm thử giao dịch với backend/database/cổng thanh toán thật trong đợt rà soát này.

## Phạm vi hiện có

| Nhóm | Bằng chứng hiện tại | Phần cần hoàn thiện/xác minh |
|---|---|---|
| Nền tảng giao diện | Shell customer/admin/operator, tokens, assets, routing, responsive; có bộ unit/E2E và mapping Figma | Cần chạy lại quality gate ở commit hiện tại |
| Auth | Login/register/verify/reset, session, refresh/logout đã có lớp gọi BE | Google/Facebook vẫn báo chưa hỗ trợ ở live |
| Home/tìm chuyến | Có trang chủ, search/filter, danh sách chuyến, popular routes | Chưa đối chiếu trực quan bản Figma online mới nhất |
| Booking | Chọn ghế, hành khách, review; tạo hold/đơn, pay-later; deep link chọn ghế sau login | Kiểm thử end-to-end với BE thật, đồng thời giữ ghế/xung đột/hết hạn |
| Thanh toán/vé/hủy/hoàn | Có live checkout/recovery, return, tài khoản, chi tiết vé, preview hủy, gửi hủy và trang theo dõi hoàn | Chưa xác nhận VNPay/webhook/hoàn tiền thực tế; tra vé live giới hạn tài khoản đăng nhập |
| Explore | Có code gọi `/api/v1/explore/routes` và UI tuyến theo điểm xuất phát | Không có canonical Figma frame theo mapping trong repo |
| Operator: chuyến | Live schedule, tạo/sửa draft, review/publish; chỉ xác nhận mở bán khi inventory sẵn sàng | Chi tiết chuyến còn dùng `BackendTripDetailPage` |
| Operator: tài nguyên/báo cáo | Live vehicles, drivers và tạo/sửa tài xế; quản lý/tạo/sửa tuyến/điểm dừng; báo cáo và biểu đồ | Form xe `?new`/`?edit`, editor điểm dừng riêng còn dùng form tích hợp chung |
| Operator: vận hành | Booking, danh sách hành khách, manifest/check-in, refund, settlement có code BE | Các route này còn dùng `BackendOperatorPage`/các detail chung, chưa thay toàn bộ bằng presentation Figma |
| Admin | Có màn Figma cho mock: organizations, staff, bookings, payments, refunds, detail/filter/state; live có endpoint và mutation | Toàn bộ các family route này còn chuyển sang `BackendAdminPage`/`BackendAdminDetailPage` ở live; cần nối API vào màn Figma và rà lại form/quyền/filter |

## Tài liệu và nghiệm thu

`TODO.md` ghi task 000–012 và 014 hoàn thành ở phạm vi mock; task 013 kiểm duyệt Figma còn in progress, Task 9 Admin Transactions/Filters/State Families chưa hoàn tất. Đây là trạng thái ghi trong repo, không phải kết quả nghiệm thu mới.

README FE vẫn ghi mock-only, mâu thuẫn code `shared/api/config.ts` (mặc định live). `BACKEND_INTEGRATION.md` cũng có thông tin đã cũ: Explore và tổ chức đã có code API bổ sung. Vì vậy không dùng các tài liệu này để suy ra toàn bộ trạng thái hiện tại.

Ưu tiên tiếp theo: (1) nối API thật vào presentation admin Travel v3; (2) hoàn thiện các trang vận hành/operator còn chung; (3) chạy kiểm thử live với stack BE và kiểm duyệt trực quan responsive theo Figma.

## Gỡ backoffice tạm

Đã xóa app `workspace/src/apps/backoffice-web`, workspace lock entries, lệnh dev riêng, service Docker/production, COPY Docker và biến môi trường/CORS backoffice riêng. `dev:customer` và `build:web` nay trỏ vào BLUE `src/apps/web`. Customer/operator/admin dùng chung app BLUE ở cổng 5173. Không xóa API backend hay các màn Travel v3 trong BLUE.

Các tài liệu kiến trúc/lịch sử cũ có thể còn nhắc backoffice như cấu trúc trước đây; chúng không còn là cấu hình chạy hiện hành.

## Kiểm tra đã chạy

- Docker Compose infra + apps `config --quiet`: đạt.
- `git diff --check`: đạt.
- FE typecheck: không chạy được vì thiếu executable `react-router` (dependencies chưa được cài).
- Máy hiện có Node 24.18.0, pnpm 11.25.0; FE khai báo Node 24.22.0, pnpm 10.34.7.
- Chưa chạy build, unit/E2E hoặc smoke test giao dịch thật. Chưa commit/push thay đổi.
