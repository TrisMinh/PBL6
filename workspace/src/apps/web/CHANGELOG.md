# Lịch sử thay đổi

## [Unreleased]

### Added

- Hướng dẫn chạy frontend trên Windows trong README: chuẩn bị Node/pnpm, cài dependency, khởi động mock, tài khoản demo, quality commands và xử lý lỗi thường gặp.

- Quality acceptance cho năm viewport 360/768/1024/1440/1920: overflow, axe serious/critical, keyboard/focus, reduced motion, metadata/noindex, 54 visual baselines, full E2E và static deep-link fallback verification.

- Cổng quản trị mock responsive hoàn chỉnh cho tổ chức, nhân viên, đơn đặt vé, thanh toán và hoàn tiền; URL filters, dialog create/edit, desktop table/mobile cards, guarded states và E2E tại1440/360.

- Hủy một phần một hoặc nhiều vé tại `/bookings/:bookingCode/cancel` với guest/account authority, xác nhận exact code, idempotent atomic mutation và refund processing mô phỏng100%; ticket detail/history phản ánh issued/cancelled sau refresh.

- Auth mock theo Figma cho email/password, Google/Facebook dev/test, đăng ký và quên mật khẩu phản hồi trung tính; session opaque một giờ không lưu credentials, redirect nội bộ an toàn, guard customer/admin và lịch sử vé đã phát hành tại `/account/tickets`.

- Guest ticket lookup bằng mã/proof body-only, scoped opaque header access15 phút, SSR-safe refresh/expiry/cache revocation và TicketDetail không có private verification. Vé điện tử một ghế/hành khách theo Figma30:489, QR marker-only; chưa auth/history/cancel/PDF/share.

- VNPay mock với typed repository, bốn trạng thái dev/test, persisted idempotency, public noindex callback IDs-only, retry/refresh và phát hành vé một lần; chỉ xóa draft sau exact validated success. Bounded mock receipt/private ticket continuity, không kết nối ngân hàng thật hoặc triển khai Task9 lookup/detail.

- Review đặt vé với hành trình/ghế/hành khách/liên hệ/chính sách mock, POST idempotent một đơn mỗi phiên và key bền qua refresh/retry; khóa chỉnh sửa sau tạo đơn, lưu bookingId trước guarded payment route; payment/ticket issuance được bổ sung ở entry Task8 phía trên.

- Form hành khách theo seatId và người liên hệ với RHF/Zod, lưu qua typed PUT, khóa double submit, lỗi/retry an toàn và khôi phục dữ liệu đã lưu qua back/refresh; điều hướng tới review route; booking creation được bổ sung ở Task7.

- Seat selection cho hai loại xe với atomic optimistic rollback, conflict Radix recovery, count/total/countdown và expiry search recovery; persisted passengerCount1..6 xuyên create-session/refresh.

- Countdown utility/hook tính từ expiry gốc, đồng bộ khi tab focus/visibility và cleanup timer an toàn; đã tích hợp SeatMap.

- Results CTA bắt đầu booking session qua safe typed repository, khóa double-click/cross-card khi pending, giữ khóa retry và draft trước đó khi thất bại; success lưu draft trước guarded SPA navigation.

- Immutable seat layouts và MSW booking-session handlers với atomic selection, max6, original 10-minute expiry, idempotent creation và bounded mock-only refresh continuity.
- Booking draft domain và một Zustand store persist sessionStorage với typed actions, hydration sau mount và guard chờ draft khi refresh; malformed/expired local data bị từ chối an toàn.
- HomeHero với bus/dot từ Figma lưu local, search form validate ngày Việt Nam và điều hướng SPA bằng query params canonical.
- Trip discovery: typed readonly fixtures, MSW GET locations/trips, runtime response schemas, safe HTTP repository, query hooks/keys và Results states/retry.
- TripCard VND/ngày Việt Nam, immutable sort/filter, mobile Radix filter drawer và thông báo giới hạn mock khi chưa có booking workflow.
- Nền token semantic, Button, Input, StatusBadge, Seat và PageState; font Bricolage Grotesque/Be Vietnam Pro và icon Phosphor.
- Customer/Admin shells responsive, skip link và navigation drawer Radix Dialog.
- Khung 23 route canonical, mock admin/booking guards và 404 có metadata noindex/link phục hồi.

### Fixed

- Làm rõ nhánh cài Node khi Windows chưa có NVM để tránh tiếp tục bằng Node `22.x` và gặp `ERR_PNPM_UNSUPPORTED_ENGINE`.

- Expired recovery điều hướng trước khi destination xóa draft, tránh guard ghi đè các tiêu chí tìm chuyến đã được xác thực.

- Conflict dialog dùng Phosphor leaf imports để prerender không nạp toàn bộ icon graph; thêm regression kiểm tra SSR output, giữ nguyên timeout/retry.

- TripCard hiển thị `Dưới 1 phút` cho khoảng thời gian hợp lệ dưới một phút thay vì duration rỗng.
- Không hiển thị ghế đã bán/đang giữ/disabled như ghế được chọn khi parent giữ cờ selection cũ.
- Root ErrorBoundary phân biệt 403/404/lỗi chưa xác định bằng tiếng Việt, không hiển thị payload hoặc stack.
- Guard không dùng clock snapshot của expiry cũ khi thay session/draft.
- Prebundle dependency dùng chung cho các route lazy để tránh lỗi optimizer khi cold navigation trong development.
