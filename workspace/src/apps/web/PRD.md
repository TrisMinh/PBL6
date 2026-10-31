# Product Requirements Document — BLUE Travel v3

> [!WARNING]
> **CẦN CHỈ DẪN RÕ CỦA CON NGƯỜI ĐỂ SỬA TÀI LIỆU NÀY.** Đây là nguồn yêu cầu sản phẩm. Trong phiên ngày 2026-10-18, chủ dự án đã yêu cầu chạy `START_HERE.md`, đồng nghĩa cho phép tạo bản PRD ban đầu này.

**Version**: 1.0  
**Status**: Approved for mock frontend implementation  
**Last updated**: 2026-10-18  
**Product owner**: Chủ dự án BLUE

## 1. Tóm tắt

BLUE là nền tảng web giúp khách hàng tìm và đặt vé xe theo hành trình. Phạm vi dự án là frontend React bám sát Figma Travel v3, bao phủ toàn bộ luồng khách hàng và quản trị bằng dữ liệu mock. Sản phẩm phải hoạt động tốt trên desktop và thích ứng với màn hình điện thoại.

## 2. Vấn đề

Khách cần một luồng thống nhất để tìm chuyến, chọn ghế, cung cấp thông tin, thanh toán và quản lý vé. Người quản trị cần theo dõi dữ liệu và giao dịch trong một giao diện tập trung. Thiết kế Figma đã hoàn thiện nhưng chưa có frontend, kiến trúc code, route, dữ liệu mock và quy tắc triển khai thống nhất.

## 3. Mục tiêu và tiêu chí thành công

### Mục tiêu

- Chuyển toàn bộ màn hình Customer Desktop và Admin Desktop trong phạm vi đã duyệt thành SPA React có thể thao tác.
- Mô phỏng trọn vẹn các trạng thái thành công, rỗng, tải, lỗi, xung đột ghế, hết hạn giữ chỗ và thanh toán.
- Giữ ranh giới dữ liệu rõ ràng giữa component, query hook, service mock và fixture.
- Đảm bảo responsive, accessibility cơ bản và code dễ bảo trì.

### Chỉ số nghiệm thu frontend

| Chỉ số | Mục tiêu | Cách đo |
|---|---:|---|
| Màn hình Figma thuộc phạm vi được mapping | 100% | `FIGMA_SCREEN_MAP.md` và review trực quan |
| Luồng E2E quan trọng chạy được bằng mock | 100% | Playwright: tìm chuyến → đặt vé → VNPay → vé; hủy/hoàn; admin |
| Route không gây trang trắng hoặc lỗi runtime | 100% | kiểm tra route và build production |
| Breakpoint 360/768/1024/1440/1920 | Không tràn ngang ngoài chủ đích | visual/responsive review |
| Accessibility | Không có lỗi nghiêm trọng trong luồng chính | semantic HTML, keyboard và automated audit |
| Chất lượng code mới | lint, typecheck, unit/integration test đạt | CI/local checks |

Chỉ số kinh doanh như tỷ lệ chuyển đổi và doanh thu sẽ được xác lập khi có analytics và môi trường thật.

## 4. Người dùng

### Khách đặt vé

- Muốn tìm chuyến phù hợp, biết rõ giờ đi, giá và ghế còn trống.
- Có thể đặt vé với tư cách khách hoặc tài khoản đã đăng nhập.
- Cần xem lại vé và yêu cầu hủy/hoàn một phần theo chính sách mô phỏng.
- Trình độ kỹ thuật phổ thông; sử dụng desktop hoặc trình duyệt điện thoại.

### Super admin

- Một tài khoản quản trị duy nhất trong phạm vi v1.
- Theo dõi và thao tác dữ liệu quản trị, giao dịch, vé và các trạng thái liên quan.
- Chủ yếu dùng desktop; giao diện vẫn phải responsive để truy cập khi cần.

## 5. Yêu cầu chức năng

### Tìm kiếm và chọn chuyến

- **FR-001**: Khách tìm chuyến theo điểm đi, điểm đến, ngày đi và số hành khách.
- **FR-002**: Hệ thống hiển thị kết quả, bộ lọc, sắp xếp, trạng thái rỗng, tải và lỗi.
- **FR-003**: Khách xem chi tiết chuyến, chính sách và thông tin nhà xe mô phỏng.
- **FR-004**: Khách chọn/bỏ chọn ghế; tối đa 6 ghế mỗi đơn.
- **FR-005**: Khi ghế bị xung đột, trạng thái phải rollback nguyên tử và giải thích rõ cho khách.

### Đặt vé và thanh toán

- **FR-010**: Booking draft được lưu trong `sessionStorage` để chịu được refresh trong cùng phiên.
- **FR-011**: Thời gian giữ chỗ là 10 phút và được tính từ `expiresAt`, không phụ thuộc bộ đếm cục bộ.
- **FR-012**: Khách nhập và xác nhận thông tin hành khách/người liên hệ bằng form có validation.
- **FR-013**: Khách có thể tiếp tục đặt vé mà không đăng nhập.
- **FR-014**: VNPay là phương thức thanh toán duy nhất trong v1 và được mô phỏng đủ success, failed, cancelled, pending.
- **FR-015**: Sau thanh toán thành công, hệ thống hiển thị vé/chi tiết đặt chỗ và mã tham chiếu.

### Tài khoản và hậu mãi

- **FR-020**: Đăng ký, đăng nhập, quên mật khẩu và đăng nhập Google/Facebook được mô phỏng.
- **FR-021**: Người dùng xem lịch sử và chi tiết vé theo trạng thái.
- **FR-022**: Người dùng có thể yêu cầu hủy/hoàn một phần theo kịch bản mock.
- **FR-023**: Các trạng thái không hợp lệ, hết hạn hoặc không tìm thấy phải có hướng phục hồi.

### Quản trị

- **FR-030**: Chỉ role `admin` truy cập được `/admin/*`; khách bị chuyển tới trang phù hợp.
- **FR-031**: Admin có shell riêng gồm điều hướng, tiêu đề trang và khu vực nội dung responsive.
- **FR-032**: Admin xem và thao tác các danh sách/chi tiết được mapping từ Figma bằng dữ liệu mock.
- **FR-033**: Admin theo dõi giao dịch, vé và trạng thái thanh toán/hủy/hoàn.
- **FR-034**: Bảng dữ liệu hỗ trợ loading, empty, error, phân trang/lọc theo thiết kế tương ứng.

### Nội dung và SEO

- **FR-040**: Route công khai ổn định được prerender khi cấu hình cho phép; route động vẫn chạy theo SPA fallback.
- **FR-041**: Các trang công khai có title, description, canonical và metadata chia sẻ phù hợp.
- **FR-042**: Nội dung giao diện v1 dùng tiếng Việt, ngoại trừ tên thương hiệu/copy tiếng Anh đã có chủ đích trong Figma.

## 6. Yêu cầu phi chức năng

- TypeScript strict; không `any`, không non-null assertion trong code ứng dụng.
- Feature-based architecture; page chỉ điều phối, logic nghiệp vụ đặt trong feature/domain hooks/services.
- TanStack Query quản lý server/mock state; Zustand chỉ quản lý booking draft liên màn hình.
- Tailwind cho utility/responsive; mọi class CSS tự viết theo BEM.
- Hỗ trợ Chrome, Edge, Firefox và Safari hiện đại; chiều rộng tối thiểu 360px.
- Keyboard navigation, focus rõ ràng, semantic HTML, label và thông báo lỗi có thể truy cập.
- Không dùng logo, testimonial hoặc số liệu nhà xe giả như dữ liệu thật.
- Dữ liệu tiền dùng số nguyên VND; thời gian API dùng ISO 8601 UTC; JSON dùng camelCase.

## 7. Ngoài phạm vi v1

- Native mobile app.
- Cổng riêng cho nhà xe, tài xế hoặc nhân viên vận hành.
- Backend, API production, database, ORM và đồng bộ thời gian thực thật.
- OAuth Google/Facebook thật; VNPay production và xử lý tiền thật.
- Đa ngôn ngữ.
- Thuật toán giá động, loyalty hoặc promotion engine thật.

## 8. Câu hỏi mở của frontend

| Câu hỏi | Trạng thái |
|---|---|
| Domain public và nền tảng host frontend | Chưa chốt |
| Chính sách hủy/hoàn dùng để viết nội dung UI cuối | Chưa chốt; dùng scenario mock |
| Canonical domain và dữ liệu SEO thực tế | Chưa chốt; dùng metadata dự thảo |

## 9. Lịch sử

| Ngày | Tác giả | Thay đổi |
|---|---|---|
| 2026-10-18 | Chủ dự án và Codex | Khởi tạo PRD từ brainstorming đã duyệt và quy trình `START_HERE.md` |
