# Checklist chức năng admin — 18/11/2026

Nhánh: `fix/general-fixes`. Môi trường: Docker local, admin `http://localhost:5175`.
Kiểm tra bằng Chromium headless và API thật; không điều khiển màn hình người dùng.
Chỉ tạo/sửa/xóa bản ghi thử có dấu nhận diện riêng. Các trường hợp lỗi mạng được
giả lập trong context trình duyệt kiểm thử, không làm lỗi backend thật.

## Quy ước

- `[ ]` Chờ chạy/đối chiếu trong lượt này.
- `[x]` Đạt, có bằng chứng kiểm tra.
- `LỖI` Đã tái hiện, chưa sửa xong.
- `GIỚI HẠN` Không thuộc giao diện hiện có hoặc chưa kiểm chứng được.

## A. Phiên đăng nhập và điều hướng

- [x] A01. Truy cập trực tiếp admin khi chưa đăng nhập chuyển về login.
- [x] A02. Form login bắt buộc email/mật khẩu; bật/tắt hiện mật khẩu.
- [x] A03. Sai thông tin đăng nhập hiển thị lỗi; thông tin đúng vào admin.
- [x] A04. Năm liên kết điều hướng desktop, trạng thái đang chọn và logo.
- [x] A05. Menu mobile mở/đóng, chọn cả 5 khu, đóng bằng Escape.
- [x] A06. Hộp tài khoản mở/đóng, liên kết trang đặt vé phản hồi được.
- [x] A07. Khôi phục phiên sau tải lại; hết hạn tự refresh và xoay token.
- [x] A08. Tài khoản khách bị chặn giao diện admin; API trả 403.
- [x] A09. API giao dịch/audit từ chối người chưa đăng nhập bằng 401.
- [x] A10. Đăng xuất gọi API, xóa phiên, chặn quay lại URL admin.

## B. Tổ chức

- [x] B01. Danh sách lấy dữ liệu API; mở đúng hồ sơ chi tiết.
- [x] B02. Tìm kiếm, không có kết quả, xóa lọc và giữ lọc sau tải lại.
- [x] B03. Bộ lọc trạng thái không trả nhầm tổ chức đang hoạt động.
- [x] B04. Các nút đầu/trước/sau/cuối phân trang hoạt động đúng.
- [x] B05. Form tạo chặn trường bắt buộc và số điện thoại sai trước khi ghi API.
- [x] B06. Tạo qua UI lưu đủ tên, pháp lý, thuế, địa chỉ, email, điện thoại đúng một lần.
- [x] B07. Sửa hồ sơ/điện thoại quốc tế lưu đúng API; hủy sửa không lưu.
- [x] B08. Hiển thị danh sách thành viên thật; tổ chức mới không có thành viên giả.
- [x] B09. Thêm thành viên từ trang tổ chức; bắt buộc nhân viên/vai trò/lý do.
- [x] B10. Sửa vai trò, tạm ngưng, lọc trạng thái thành viên và giữ sau reload.
- [x] B11. Liên kết thành viên mở đúng hồ sơ nhân viên.
- [x] B12. API 500 có thông báo và thử lại thành công; hồ sơ không tồn tại không crash.
- [x] B13. Số đếm tổ chức hoạt động/tạm ngưng tính toàn bộ kết quả, không chỉ trang hiện tại.

## C. Nhân viên và phân quyền

- [x] C01. Danh sách API, tìm kiếm email, không có kết quả, xóa lọc và reload.
- [x] C02. Bộ lọc trạng thái tài khoản và tổ chức đúng dữ liệu.
- [x] C03. Các nút phân trang đầu/trước/sau/cuối.
- [x] C04. Tạo/sửa hồ sơ qua UI được lưu vào API; validation bắt buộc/hủy form.
- [x] C05. Thêm thành viên từ trang nhân viên vào tổ chức thứ hai.
- [x] C06. Hiển thị đủ nhiều membership; lọc được theo tổ chức thứ hai.
- [x] C07. Sửa đúng membership được chọn, giữ vai trò/trạng thái đúng tổ chức.
- [x] C08. Khóa/mở tài khoản không ghi đè quyền/trạng thái membership.
- [x] C09. Gán PLATFORM_SUPPORT không cần tổ chức, giữ sau reload.
- [x] C10. Hộp vai trò nền tảng bắt buộc lý do và lưu qua API.
- [x] C11. API 500 có thông báo và thử lại thành công; hồ sơ không tồn tại không crash.

## C bổ sung. Vai trò hỗ trợ cùng tổ chức

- [x] C12. Tài khoản có cả membership và vai trò nền tảng giữ đúng phạm vi quyền.

## D. Đơn đặt vé / thanh toán / hoàn tiền

Mỗi mục dưới đây áp dụng riêng cho cả 3 khu, trừ khi ghi khác.

- [x] D01. Danh sách lấy API thật, không có footer/thao tác tra cứu mẫu.
- [x] D02. Tra cứu bằng mã đơn/ID thực tế tìm đúng bản ghi.
- [x] D03. Bộ lọc tổ chức kết hợp trạng thái cho đúng số lượng.
- [x] D04. Đối chiếu toàn bộ trạng thái đang có trong DB với nhãn, bộ lọc và chi tiết.
- [x] D05. Không có kết quả, xóa lọc và reset trang khi tìm kiếm.
- [x] D06. Các nút phân trang đầu/trước/sau/cuối; trang vượt giới hạn tự điều chỉnh.
- [x] D07. Trang 2 không trùng trang 1, giữ nguyên sau reload khi có đủ dữ liệu.
- [x] D08. Chi tiết có ngày tạo/cập nhật, số tiền, nhà xe và thông tin nghiệp vụ API.
- [x] D09. Lịch sử có sự kiện từ thời điểm đã lưu trong DB.
- [x] D10. Liên kết đơn/thanh toán/hoàn tiền mở đúng hồ sơ; nút trở lại danh sách.
- [x] D11. Tải lại chi tiết giữ nguyên dữ liệu.
- [x] D12. Lỗi 500/thử lại và hồ sơ không tồn tại được phân biệt, không crash.
- [x] D13. Mã ghế booking khớp booking_items đã lưu, kể cả đơn chưa phát hành vé.

## E. Kỹ thuật và bố cục

- [x] E01. Cả 5 danh sách ở 390px không tràn ngang toàn trang.
- [x] E02. Không có exception trình duyệt trong các luồng kiểm tra.
- [x] E03. Proxy tự theo gateway khi container đổi IP, giữ đường dẫn/query.
- [x] E04. Kiểm thử admin, TypeScript, ESLint phần bổ sung và diff whitespace đạt.
- [x] E05. Container cần thiết healthy; bản ghi tổ chức/nhân viên và network thử được dọn.

## Giới hạn cần phân biệt với lỗi

- GIỚI HẠN: admin hiện cung cấp tra cứu giao dịch; không có nút thu tiền, duyệt hay
  thực hiện hoàn tiền trong các trang này, nên không ghi nhận các chức năng đó là đã có.
- GIỚI HẠN: không giao dịch tiền thật với ngân hàng/SePay, không kiểm thử tải lớn,
  không cam kết mọi tổ hợp dữ liệu/thiết bị đều đã được thử.
- GIỚI HẠN: trạng thái không có trong DB chỉ có thể kiểm chứng bằng kiểm thử tự động
  lớp ánh xạ, không gọi đó là đã kiểm chứng live.

## Bằng chứng

Các script: `verify-admin-live.mjs`, `verify-admin-resilience.mjs`,
`verify-admin-forms.mjs`, `verify-admin-proxy.mjs`, `verify-admin-gaps.mjs`
trong `workspace/src/apps/web/scripts`. Kết quả lượt này sẽ được cập nhật sau khi chạy.

## Kết quả xác minh cuối

**53/53 mục checklist đạt trong các luồng đã kiểm tra.** Có 96 kiểm tra live/headless
trong 5 bộ script; 168 kiểm thử admin ở 21 file đạt. TypeScript, ESLint toàn bộ admin
và các script bổ sung, kiểm tra whitespace đều đạt. Container cần thiết healthy.
Bản ghi tổ chức/nhân viên và network thử còn lại: 0.

| Bộ kiểm tra | Kết quả |
| --- | --- |
| live | 9 đạt ở lượt chạy lại |
| resilience | 44 đạt |
| forms | 6 đạt |
| gaps | 36 đạt |
| proxy | 1 đạt |
| unit | 168 đạt |
| types | Đạt |
| lint | Đạt |

Đã thử đăng nhập trên **5 context mới độc lập**, đều nhận API 200, mở dữ liệu và
đăng xuất được.

### Lỗi phát hiện và đã sửa trong lượt checklist

1. Thống kê tổ chức đếm trạng thái trong trang hiện tại, gây sai tổng khi phân trang.
   Repository hiện tính toàn bộ kết quả lọc; đã kiểm tra chuyển trang giữ số đếm đúng.
2. Chi tiết booking bỏ trống mã ghế vì API booking trả `seatId`, giao diện đọc
   `seatCode`. API audit admin hiện trả mã ghế từ `booking_items`, frontend ánh xạ
   đúng; đã đối chiếu trên đơn hết hạn chưa phát hành vé. Không sửa dữ liệu booking.

Hai bản sửa đã được build và triển khai lên Docker local.

### Ghi nhận cần theo dõi

Một lần chạy bộ live đầu tiên hết thời gian chờ ở login và không thấy request login
tương ứng trong log proxy. Chưa xác định chắc nguyên nhân. Lượt chạy lại toàn bộ bộ live đạt 9/9
và thử thêm 5 phiên mới đạt 5/5. Chưa tái hiện được ở các lượt xác minh sau.

Đối chiếu máy đọc: [final-results.json](admin-checklist-20261118/final-results.json).
Mục C12 kiểm tra API giữ riêng vai trò nền tảng và membership, chưa kiểm thử mọi
quyền nghiệp vụ của từng vai trò.

Chạy lại từ `workspace/src/apps/web`: `npm run test:admin-checklist`.

## Bổ sung sau phản hồi về cột mã tổ chức

Checklist trước chưa phân biệt giá trị mã nghiệp vụ với ID nội bộ ở B01.
Đã sửa danh sách và chi tiết dùng `organizations.code`, bổ sung trường `code` vào
API profile và giữ UUID trong đường dẫn nội bộ. Không đổi ID hoặc mã trong DB.

- [x] Hiển thị đúng mã nghiệp vụ như `AN-NHIEN-TRAVEL` ở cột mã, chi tiết và tiêu đề.
- [x] Tìm được tổ chức theo mã; UUID vẫn mở đúng hồ sơ nhưng không hiện thành mã.

Kiểm tra trực tiếp bằng `scripts/verify-admin-organization-code.mjs`: 2 kiểm tra đạt.
15 kiểm thử liên quan đạt; TypeScript và ESLint phần sửa đạt. Bản Docker admin và
transport đã cập nhật. Bộ chạy checklist đã được bổ sung script kiểm tra này.

### Bổ sung sau phản hồi về mã đơn đặt vé

Cột mã đơn và tiêu đề chi tiết đang hiển thị ID thay vì `bookingCode`; đã sửa cả
hai, giữ ID trong URL nội bộ. Đã đối chiếu trực tiếp với API thật: hiển thị mã,
tìm theo mã và mở đúng hồ sơ đều đạt. 17 kiểm thử trang giao dịch đạt. Đã bổ sung
assertion phân biệt mã đơn với ID vào `verify-admin-live.mjs` và cập nhật Docker.

### Bổ sung sau phản hồi về thanh toán và hoàn tiền

Đã sửa mã thanh toán dùng `payments.logical_reference` qua trường API
`paymentReference`; mã hoàn dùng `refund_reference`. Mã giao dịch đối tác tiếp tục
hiển thị riêng. Các cột đơn đặt vé/thanh toán gốc và liên kết liên quan dùng mã
nghiệp vụ, còn UUID dùng cho đường dẫn. Không sửa hoặc tự tạo lại mã trong DB.

31 kiểm thử trang giao dịch/repository đạt. Script
`verify-admin-transaction-codes.mjs` chạy headless với API thật đạt cả 6 kiểm tra:
danh sách/tìm kiếm và chi tiết/liên kết/reload cho cả booking, payment, refund.
Đã build và triển khai Payment API và admin; bổ sung script vào bộ checklist.

### Bổ sung sau phản hồi về hồ sơ nhân viên

Ẩn ID tài khoản khỏi thông tin hiển thị; hệ thống hiện chưa có mã nhân viên chung
riêng để thay thế, không tự gán mã giả. Vai trò được hiển thị tiếng Việt thống nhất
giữa danh sách, chi tiết và hộp vai trò nền tảng; giá trị gửi API không đổi.

11 kiểm thử danh sách/chi tiết nhân viên đạt. Đã mở hồ sơ trong ảnh bằng trình
duyệt headless tại 1440px và 390px: không hiện UUID/DRIVER trong nội dung, hiện
“Tài xế”, không tràn ngang. Bản Docker admin đã cập nhật.

### Dropdown bộ lọc có tìm kiếm

Dropdown nhà xe/tổ chức từ 8 lựa chọn trở lên có ô tìm bên trong, áp dụng ở Nhân
viên, Đặt vé, Thanh toán và Hoàn tiền. Tìm tên không dấu hoặc mã tổ chức; gõ tìm
không đổi URL cho đến khi chọn. Danh sách ngắn và bộ lọc trạng thái giữ select.

Đã kiểm tra chọn bằng chuột/Enter, phím mũi tên/Escape, không có kết quả, xóa lựa
chọn, reset phân trang và giữ lựa chọn sau tải lại. Bộ kiểm thử admin đạt 177 test;
`verify-admin-filter-search.mjs` đạt 6 kiểm tra trực tiếp, gồm 4 trang và 2 kích
thước màn hình. Đã xem ảnh headless 1440px/390px, không tràn ngang; Docker đã cập nhật.

### Popup thành viên: mã tổ chức cố định

Đã thay phần UUID ghép sau tên nhà xe bằng mã tổ chức trong popup thêm/sửa thành
viên, bỏ nhánh hiển thị ID riêng cho dữ liệu prototype. Khi thiếu mã chỉ hiện tên;
khi thiếu nhà xe hiện thông báo thay vì UUID. Payload gửi API vẫn giữ ID đúng.

18 kiểm thử liên quan đạt. Kiểm tra headless đúng popup trong ảnh ở 1440px/390px
đạt; script organization-code xác minh thêm popup tạo từ tổ chức, sửa từ tổ chức
và sửa từ hồ sơ nhân viên. TypeScript/ESLint đạt, Docker admin đã cập nhật.
