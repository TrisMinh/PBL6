# Kiểm tra accessibility frontend

**Trạng thái:** Plan 06 Task 3 đã chạy, chờ Supervisor nghiệm thu
**Ngày kiểm tra:** 2026-10-23
**Chuẩn tự động:** axe-core; fail khi có violation `serious` hoặc `critical`

## Phạm vi tự động

`tests/e2e/accessibility.spec.ts` chạy trên năm project `w360`, `w768`, `w1024`, `w1440` và `w1920`. Mỗi project dùng route, mock session và dữ liệu phát hành vé thật của E2E thay vì truy cập ID giả.

| Khu vực | Trạng thái được axe quét |
|---|---|
| Customer | Home, Trips success, Seat page, Passenger form, Ticket detail |
| Admin | Organizations list sau admin login, Organization detail |

Không có axe rule nào bị tắt hoặc exclude. Test phân tích toàn document, lọc kết quả theo impact và chỉ attach JSON chi tiết khi có violation chặn để report thành công không lưu artifact rỗng.

## RED → GREEN

Baseline `w360` phát hiện hai violation `serious` trên Organizations list:

1. `color-contrast` — badge “Tạm ngưng” đạt 4.48:1, thấp hơn ngưỡng 4.5:1 của WCAG 1.4.3. Màu chữ được đổi từ muted sang semantic secondary.
2. `label-content-name-mismatch` — nút hiển thị “Sau” nhưng accessible name là “Trang tiếp theo”, vi phạm WCAG 2.5.3. Copy hiển thị được đổi thành “Tiếp theo” để tên truy cập chứa nhãn nhìn thấy.

Keyboard RED tiếp theo chứng minh Organization dialog không trả focus về nút “+ Thêm tổ chức” khi đóng bằng Escape. Dialog nay ghi lại opener lúc mount và dùng `onCloseAutoFocus` để trả focus sau khi đóng. Ca GREEN xác nhận lại hành vi trên route thật.

## Kiểm tra keyboard tự động

| Hành vi | Bằng chứng |
|---|---|
| Skip link | Tab đầu tiên focus “Đến nội dung chính”; Enter chuyển focus tới `main` ở cả năm project. |
| Customer drawer | Tại `w360`, Enter mở drawer, focus nằm trong dialog, Escape đóng và trả focus về trigger. Từ 768px trở lên desktop navigation thay drawer theo breakpoint đã duyệt. |
| Admin drawer | Tại `w360` và `w768`, Enter mở drawer và Escape trả focus về trigger. Từ 1024px trở lên sidebar desktop thay drawer. |
| Organization dialog | Enter mở create dialog, focus nằm trong dialog; Escape đóng và trả focus về trigger ở cả năm project. |
| Seat keyboard toggle | Space trên ghế A01 đổi `aria-pressed` sang `true` ở cả năm project. |
| Passenger form error | Enter submit form trống tạo error summary `role="alert"`, focus trường lỗi đầu tiên và đặt `aria-invalid="true"`. |

## Kết quả và giới hạn

Focused unit regression cho AdminFilters và Organization pages đạt 12/12; bounded full unit đạt 113 files/1069 tests. Format check, full lint và typecheck đạt; production build, prerender `/`, SPA fallback và prerender tests2/2 đạt. Full lint/typecheck/build được chạy ngoài sandbox sau khi lượt sandbox gặp parent-linger, EPERM trên thư mục type sinh và chặn prerender loopback. Accessibility E2E có 4 tests cho mỗi project, tổng 20 tests và matrix cuối đạt 20/20.

Cold-start timing từng xuất hiện ở customer scan `w768` trong lượt Worker trước và ở `w360` trong audit thay thế, trước khi axe scan tới ticket detail. Mỗi ca exact isolated đạt1/1 và matrix cuối đạt20/20 mà không đổi timeout, rule hoặc production behavior.

Axe và keyboard automation không thay thế kiểm tra bằng screen reader thật, high-contrast mode, zoom 200–400% hoặc đánh giá ngữ nghĩa nội dung bởi người dùng công nghệ hỗ trợ. Các phần này vẫn thuộc acceptance review rộng hơn của Plan 06; Task 3 chỉ cam kết phạm vi tự động nêu trên.

## Global focus và reduced motion — Plan 06 Task 4

`src/styles/app.css` cung cấp fallback `:focus-visible` 3px bằng `--color-focus-ring`, offset2px. Component có replacement cụ thể vẫn được phép dùng độ rộng riêng; keyboard E2E xác nhận skip link có outline solid2px ở `w360` và `w1440`. Recursive style contract quét toàn bộ `src/**/*.css` và không tìm thấy `outline: none` hoặc `outline: 0`.

Khi người dùng chọn reduced motion, animation/transition toàn cục bị rút xuống0.01ms, iteration còn1 và smooth scrolling chuyển thành auto bằng declarations `!important`. Chromium chuẩn hóa0.01ms thành `1e-05s`; customer booking E2E xác nhận giá trị hiệu dụng <=0.01ms tại mobile và desktop. CSS contract test giữ exact source rule để browser normalization không làm yếu yêu cầu.
