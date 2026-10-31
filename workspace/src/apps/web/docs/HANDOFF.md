# Bàn giao frontend BLUE

Đây là bản xuất source hiện tại ngày 2026-10-29, dùng React Router/Vite/TypeScript và MSW. Chạy theo README.md, dùng đúng Node/pnpm trong package.json. Tài khoản trong README là tài khoản mock công khai, không phải thông tin đăng nhập thật.

## Đọc để nối API

Đọc docs/technical/FRONTEND_ARCHITECTURE.md, FRONTEND_CONVENTIONS.md, ROUTES.md, API_CONTRACT.md, FE_BE_FIELD_MAPPING.md và TESTING_STRATEGY.md. Repository/schema/query là boundary tích hợp; thay MSW bằng API qua repository, giữ validation và state ownership. Không triển khai backend trong repo này.

## Trạng thái bàn giao

Customer header và hai trang Khám phá đã được Supervisor chấp nhận trong TASK-014: /explore và /explore/:provinceSlug; /trips thuộc Điểm đến. Dữ liệu điểm đón/trả là mô phỏng, tọa độ chưa xác minh giữ null. Chi tiết tại docs/technical/EXPLORE.md.

Admin transaction/filter/state thuộc Task 9 của Plan 07 đang triển khai, chưa được Supervisor chấp nhận. Bản xuất giữ code đang làm dở để bàn giao, không tuyên bố toàn dự án hoàn tất. Xem docs/quality/TASK9_ADMIN_TRANSACTION_FIDELITY_LEDGER.md. Các kiểm tra gần nhất TASK-014: 1239 unit/integration test và 15 E2E đạt; format toàn repo còn bốn file Task 9 cần xử lý. Người nhận cần chạy lại các gate trên bản clone của mình.

## File riêng được giữ local

Không xuất lịch sử Git local, .claude, skill, rule, cấu hình MCP/agent, task điều phối nội bộ, credential/env, log CLI, dependency và build output. Các liên kết cũ tới tài liệu điều phối riêng có thể không tồn tại trong bản bàn giao; dùng tài liệu kỹ thuật ở trên làm hướng dẫn tích hợp.
