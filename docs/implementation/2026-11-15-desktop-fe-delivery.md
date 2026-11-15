# Bàn giao FE desktop mock Travel v3 — 15/11/2026

> Đính chính sau phản hồi trực quan của người dùng: các kết quả chức năng bên dưới không chứng minh toàn bộ FE giống Figma. Kiểm thử geometry trước đây chỉ bắt được khung ngoài, bỏ sót layout trong card, font nhà xe, legend bộ lọc, thanh điều hướng và icon. Đã sửa riêng Results desktop node 28:30 và bổ sung kiểm tra nội dung bên trong cùng ảnh render. Xem `desktop-fidelity-correction/report.md`. Chưa nghiệm thu độ giống của toàn bộ các trang.

## Phạm vi

Customer, Operator và Admin là ba web desktop riêng. Không triển khai native mobile; `workspace/src/apps/mobile` không thay đổi. Nhánh làm việc `codex/fe-be-integration`, không sửa hai nhánh gốc. Chưa commit/push/deploy.

## Chạy và tài khoản

Tại `workspace/`, mở ba terminal chạy lần lượt `npm run dev:customer`, `npm run dev:operator`, `npm run dev:admin`.

| Web | URL | Email demo | Mật khẩu |
|---|---|---|---|
| Customer | http://127.0.0.1:5173 | test+review@example.invalid | BlueDemo2026 |
| Operator | http://127.0.0.1:5174 | operator@blue.example.invalid | BlueDemo2026 |
| Admin | http://127.0.0.1:5175 | admin@blue.example.invalid | BlueDemo2026 |

Node 24.22.0 / pnpm 10.34.7; dependencies nằm trong `workspace/src/apps/web`. Có thể dùng `npm exec --yes --package=node@24.22.0 --package=pnpm@10.34.7 -- ...` để dùng đúng phiên bản mà không thay toàn máy.

`npm run build:web` build cả ba web. Artifact: `customer-web/dist/client`, `operator-web/dist/client`, `admin-web/dist/client`. Tại từng app có `dev`, `build`, `preview`, `typecheck`. Ba package có build/route riêng, chia sẻ source BLUE trong `web` để tránh nhân ba code. Manifest tổng hợp chỉ dùng trong regression harness cũ.

## Thay đổi

- Tách route manifest và trang đăng nhập staff riêng. Customer không có route operator/admin; các cổng staff không có checkout khách hàng. Phiên tách theo origin và có guard của từng portal.
- Mock mặc định cả development và production demo; MSW khởi động trước render, lưu archive mock khi tải lại. Live chỉ opt-in, không nghiệm thu BE trong đợt này.
- Customer: nút Google/Facebook có tên hiển thị, success/error mock; đăng ký có đồng ý điều khoản bắt buộc, xác minh/reset dùng mã `123456`, tài khoản mới đăng nhập được sau reload. Mật khẩu demo mới lưu digest, không lưu plaintext.
- VNPay: giữ checkout Travel v3, bổ sung cổng mô phỏng QR/ATM/thẻ quốc tế, 6 ngân hàng, kết quả success/pending/failed/cancel. Không thu tiền hoặc nhận dữ liệu ngân hàng thật.
- 630 chuyến đa dạng trong 7 ngày, 12 cặp điểm đi/đến có chiều. Lịch sử khách được seed qua mutation thật của mock: 4 booking/payment, 6 vé, một vé hủy và hoàn tiền đang xử lý; chỉ 5 vé thuộc tài khoản demo, vé khách khác không bị lộ.
- Operator: hoàn thiện navigation tổ chức/thành viên và đối soát, invite/edit/status/profile, lọc/detail/CSV và dữ liệu lưu theo phiên. Bổ sung handler mock cho editor/review/publish vốn trước đó còn gọi endpoint live, kiểm tra xung đột/version, phản ánh chuyến đã tạo/phát hành lên lịch.
- Admin: dùng giao diện mock Travel v3 cho tổ chức/staff/booking/payment/refund, filter URL, modal và state. Tạo/sửa tổ chức, nhân viên và membership/idempotency lưu sau reload, archive được validate và loại bỏ khi hỏng.
- Hỗ trợ, điều khoản, bảo mật, giới thiệu, ưu đãi, đối tác có trang thực thay liên kết trỏ nhầm; form hỗ trợ có reference lưu local và ghi rõ không gửi tới nhân viên thật.
- Sửa card tìm chuyến về khung desktop 300px; thêm chi tiết điểm dừng dạng disclosure nổi, giữ layout card. Sửa scrollbar-gutter căn giữa, focus, contrast và các test lỗi thời; không tắt rule lint hoặc xóa assertion nghiệp vụ.
- Gỡ app backoffice tạm và frontend customer tạm cũ; Docker hỗ trợ chọn APP_TARGET và ba service riêng.
- Sửa preview GET `/` bị 403 do root có dấu phân cách cuối đường dẫn; thêm kiểm thử HTTP 200/trang chủ trên production preview.

## Kết quả xác nhận cuối

| Kiểm tra | Kết quả | Bằng chứng |
|---|---|---|
| Full unit/integration | **1.443/1.443**, 178 file qua | `fe-audit-2026-11-15/unit-acceptance.log` |
| ESLint | Qua, không lỗi | `lint-acceptance.log` |
| TypeScript/typegen | Qua | `typecheck-acceptance.log` |
| Build Customer/Operator/Admin | Cả ba qua, có HTML prerender và SPA fallback | `build-{customer,operator,admin}-acceptance.log` |
| Desktop Figma/booking/cancellation/axe/keyboard | **21/21** | `desktop-regression-acceptance.log` |
| Ba production web độc lập | **6/6** | `desktop-portals-acceptance.log` |
| Operator production workflow | Qua login/resources/org/settlement/create-review-publish/reload/logout, không pageerror | `operator-production-acceptance.log`, `../fe-operator-completion/results.json` |
| Admin CRUD/URL/filter/state/focus 360/1440 | **12/12** trong đợt tích hợp | `admin-keyboard-final.log` |
| Docker Compose infra+apps | `config --quiet` qua | Kiểm tra cấu hình; không phải Docker image smoke test |
| Whitespace và mobile app diff | `git diff --check` qua; không đổi native app | Git working tree |
| Rà soát độc lập cuối | Không còn phát hiện P1/P2 trong phần được review | Portal separation, guards, mock lifecycle, persistence, preview containment và Docker |

Log nằm trong `docs/implementation/fe-audit-2026-11-15`. Các log audit ban đầu và các lần test thất bại vẫn giữ để truy vết; dùng các file acceptance bên trên cho trạng thái cuối.

## Giới hạn của kết luận

Đây là bản FE desktop mô phỏng đã qua các bộ kiểm tra nêu trên. Không dùng kết quả này để tuyên bố Google/Facebook/VNPay thật, backend integration hoặc native app đã hoàn tất. Figma được dùng trực tiếp làm nguồn đối chiếu; browser fidelity xác nhận các vùng/state được kiểm tra, không phải pixel-diff từng node trong toàn file. Các trang hỗ trợ và staff login mới dùng hệ thiết kế BLUE vì không có canonical frame tương ứng trong phạm vi audit. Không có bảo đảm “100% không còn lỗi” ngoài phạm vi kiểm thử đã ghi.

Tài liệu chạy đầy đủ: `workspace/src/apps/web/README.md`. Xóa dữ liệu trang/sessionStorage để reset demo.
