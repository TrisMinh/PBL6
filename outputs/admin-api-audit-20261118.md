# Kiểm tra tích hợp API admin — 18/11/2026

## Kiểm tra mở rộng lúc 09:50

Đã tiếp tục kiểm tra 5 khu admin bằng trình duyệt headless và API local thật:

- 44 kiểm tra mở rộng đạt: lỗi 500/thử lại và hồ sơ không tồn tại ở cả 5 khu;
  19 trạng thái giao dịch có trong DB được đối chiếu bộ lọc, số lượng, chi tiết và
  lịch sử; tìm kiếm rỗng/xóa lọc; phân trang vượt giới hạn; trang 2 không trùng
  trang 1; tải lại giữ dữ liệu; anonymous 401/customer 403; refresh token hết hạn.
- 6 kiểm tra biểu mẫu/mobile đạt: bắt buộc nhập, chặn số điện thoại sai, tạo tổ chức
  qua UI lưu đầy đủ hồ sơ đúng một lần, hủy sửa không lưu, validation nhân viên,
  cả 5 danh sách ở 390px không tràn ngang toàn trang.
- Chạy lại 9 nhóm luồng ghi/đọc API thật trước đó: đạt, không có lỗi trình duyệt.
- 1 kiểm tra proxy Docker trên network tạm: cố ý đổi IP gateway, Nginx tự kết nối
  lại mà không khởi động lại; giữ nguyên đường dẫn và query string. Container và
  network thử đã được dọn. Cách cấu hình dùng resolver và proxy_pass biến theo
  [tài liệu Nginx](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass).

Phát hiện và sửa thêm 2 lỗi: proxy Nginx giữ IP gateway cũ gây 502 sau khi recreate
container; lỗi 403/404 của API giao dịch bị hiển thị thành lỗi mất kết nối.
Bản sửa đã được build và triển khai lên admin Docker local.

161 kiểm thử admin hiện có và 6 kiểm thử mới cho ánh xạ lỗi đều đạt; TypeScript,
ESLint cho phần thay đổi mới và kiểm tra whitespace đạt. Bản ghi tổ chức/nhân viên
thử do các script tạo đã được dọn, không thao tác lên dữ liệu nghiệp vụ có sẵn.

Chạy lại từ `workspace/src/apps/web`:

```text
npm run test:admin-live
npm run test:admin-resilience
npm run test:admin-forms
npm run test:admin-proxy
```

Phạm vi: các chức năng hiện có của admin đã được kiểm chứng theo những luồng trên.
Không thử giao dịch tiền thật với SePay/ngân hàng, tải đồng thời lớn hay mọi tổ hợp
dữ liệu. Bộ lọc/phân trang giao dịch hiện lấy dữ liệu API rồi xử lý tại frontend;
chưa đo khả năng mở rộng khi dữ liệu lớn.

## Cập nhật sau khi hoàn thiện tích hợp

Các thiếu sót ghi nhận trong đợt kiểm tra ban đầu bên dưới đã được xử lý trên
nhánh `fix/general-fixes` và triển khai lên Docker local:

- Tạo/sửa hồ sơ nhân viên, khóa/mở tài khoản, thêm/sửa membership và lọc theo
  từng tổ chức; hỗ trợ hiển thị nhiều tổ chức trên một hồ sơ.
- Bộ lọc giao dịch dùng tổ chức thật, nhập mã tự do, lọc đúng trạng thái trước
  phân trang. Các trạng thái hết hạn, chờ hoàn, hoàn một phần và đã hoàn được giữ.
- Ngày tạo/cập nhật, cổng thanh toán, lý do hoàn và các liên kết giữa đơn,
  thanh toán, khoản hoàn lấy từ API. Lịch sử lấy từ thời điểm đã lưu trong DB.
- API lịch sử yêu cầu xác thực và vai trò quản trị: thử thực tế nhận 401 khi
  chưa đăng nhập, 403 với tài khoản khách hàng.

Xác minh: **161 kiểm thử admin đạt**, TypeScript và ESLint đạt; **9 nhóm kiểm tra
headless với API thật đạt**, bao gồm thao tác ghi trên bản ghi thử và đăng xuất.
Không có lỗi trình duyệt trong lượt xác minh; các hồ sơ/tổ chức thử đã được dọn.
Không điều khiển màn hình, chuột hoặc bàn phím của người dùng.

Chạy lại: `cd workspace/src/apps/web` rồi `npm run test:admin-live`.

**Các mục bên dưới là kết quả khảo sát trước khi sửa, được giữ để đối chiếu.**

## Kết luận

Admin ở `http://localhost:5175` đang chạy API thật. Cả 5 khu mở được danh sách
và một trang chi tiết đại diện, nhưng tích hợp chức năng và cách hiển thị dữ liệu
chưa hoàn thiện toàn bộ.

Kiểm tra bằng Playwright Chromium chạy headless và HTTP trực tiếp, không sử dụng
trình duyệt đang mở, chuột hoặc bàn phím của người dùng. Không thay đổi dữ liệu
nghiệp vụ trong lần kiểm tra này. Các phiên đăng nhập kiểm tra được tạo riêng.

## Kết quả chạy thực tế

| Khu vực | Danh sách | Chi tiết đại diện | Nhận xét |
| --- | --- | --- | --- |
| Tổ chức | API 200; 9 tổ chức | Tải được hồ sơ và thành viên | Thêm/cập nhật qua giao diện đã kiểm chứng ở lượt tích hợp trước |
| Nhân viên | API 200; danh sách người dùng trả 50 bản ghi trước khi frontend lọc vai trò | Tải được hồ sơ, vai trò | Luồng thay đổi hồ sơ chưa chạy được đầy đủ |
| Đơn đặt vé | API 200; 164 đơn | Tải được | Ngày tạo đã có, nhưng còn sai trạng thái và bộ lọc |
| Thanh toán | API 200; 85 giao dịch | Tải được | Thiếu ngày tạo và thông tin đối tác trong giao diện |
| Hoàn tiền | API 200; 13 khoản | Tải được | Thiếu ngày tạo, chưa lấy đủ lý do/lịch sử |
| Đăng nhập/đăng xuất | Đăng nhập 200; đăng xuất 204 | Chuyển về `/login` sau đăng xuất | Hoạt động với phiên riêng của kiểm tra |

Không phát hiện lỗi render hoặc request thất bại trong các luồng đọc đại diện.
Không có mock service worker đăng ký trong context kiểm tra.

## Các phần chưa hoàn thiện

1. **API tạo/sửa hồ sơ nhân viên chưa có trong container Identity đang chạy.**
   `POST /api/v1/admin/users` và `PATCH /api/v1/admin/users/{id}` trả 405.
   Các request thăm dò dùng JSON cố ý không hợp lệ để không thực thi thay đổi.
   Cùng cách kiểm tra đó, các endpoint đổi trạng thái, đổi vai trò và thêm/sửa
   membership trả 400 ở bước đọc JSON, chứng tỏ route đã tồn tại; đây không phải
   bằng chứng các thao tác ghi đã chạy thành công. `saveStaff()` luôn PATCH hồ sơ
   trước khi đổi trạng thái/vai trò, nên luồng khóa/mở khóa cũng bị chặn tại đây.

2. **Bộ lọc cả ba trang giao dịch vẫn dùng lựa chọn prototype.**
   Dialog tra cứu hiện “Tra cứu mẫu trong prototype”, chỉ có các mã cố định
   `BK-260916-018`, `PAY-260916-018`, `RF-260916-018` và mã không tồn tại.
   Lựa chọn nhà xe vẫn là BlueLine, RedLine… với ID `ORG-001`… thay vì tổ chức
   thật có ID UUID. Vì vậy chưa thể dùng các bộ lọc này như tính năng hoàn chỉnh.

3. **Hiển thị sai một số trạng thái thực tế.** Đã kiểm chứng trên trang chi tiết:
   - API booking `REFUND_PENDING` → giao diện “Chờ thanh toán”.
   - API payment `REFUNDED` → giao diện “Đang xử lý”.
   Lớp chuyển đổi dữ liệu còn làm mất các trạng thái `EXPIRED`,
   `PARTIALLY_REFUNDED`, `REQUESTED`.

4. **Nhân viên thuộc nhiều tổ chức bị bỏ sót khi lọc.** API có một người dùng
   thuộc hai tổ chức; frontend chỉ đọc membership đầu tiên. Khi lọc tổ chức thứ
   hai, người này không xuất hiện. Trang chi tiết cũng chỉ chọn tổ chức đầu.

5. **Thông tin giao dịch chưa được nối đủ trường.** Container Payment hiện tại
   không trả `createdAt` cho toàn bộ 85 payment và 13 refund đã kiểm tra.
   Provider và reason có trong API nhưng chưa được ánh xạ đầy đủ lên giao diện.
   Các khối lịch sử/giao dịch liên quan phụ thuộc vào `audit`; repository live
   chưa tạo dữ liệu tương ứng từ các API thật, nên các phần đó thiếu thông tin.

## Giới hạn kiểm tra

Không thử ghi vào nhân viên hoặc membership thật; việc tồn tại route ghi không
đồng nghĩa đã kiểm chứng nghiệp vụ ghi. Không thử mọi bản ghi hoặc mọi tổ hợp
phân quyền. Không sửa code hoặc rebuild container trong lần audit này.
