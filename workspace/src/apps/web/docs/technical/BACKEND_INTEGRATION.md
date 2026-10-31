# Kết nối backend codex

Frontend mặc định gọi API thật. Không tự chuyển sang dữ liệu giả khi dịch vụ lỗi.

## Chạy local

Khởi động backend theo `workspace/README.md` và các hướng dẫn triển khai của repository. Gateway mặc định dùng `http://localhost:5080`. Cần đủ database, Redis và RabbitMQ; thanh toán cần cấu hình VNPay và webhook hoạt động.

Trong thư mục `workspace/src/apps/web`, sao chép `.env.example` thành `.env`, rồi chạy `pnpm dev` với Node/pnpm theo `package.json`. Có thể dùng `npm run dev` khi dependencies đã được cài.

```dotenv
VITE_API_MODE=live
VITE_API_BASE_URL=
API_PROXY_TARGET=http://localhost:5080
```

`API_PROXY_TARGET` chỉ dùng cho proxy Vite khi phát triển. Khi deploy, cấu hình reverse proxy `/api/v1/*` sang Gateway và SPA fallback cho các đường dẫn frontend. Nếu dùng Gateway khác origin, đặt `VITE_API_BASE_URL` trước khi build và cấu hình CORS phía Gateway. Không đặt secret trong biến `VITE_*` vì chúng được đóng gói vào trình duyệt.

Muốn xem bản demo cũ, đặt `VITE_API_MODE=mock` rồi khởi động lại dev server. Unit test mặc định dùng mock; bộ Playwright cũ bật mock tường minh. Bộ Playwright live dùng port 5174 và tắt MSW.

## Viết một lần, dùng cho các trang

- `src/shared/api/client.ts`: `apiFetch` cho Response thô; `apiJson` cho JSON đã được kiểm tra bằng schema. Có timeout 20 giây, AbortSignal, Bearer, correlation ID, và retry một lần sau 401. Các request đồng thời dùng chung một lượt refresh.
- `session.ts`: lưu session theo tab, xoay refresh token, đồng bộ trạng thái UI. Lượt refresh chưa nhận được response giữ nguyên idempotency key để thử lại. Response refresh đến sau khi đăng xuất không được khôi phục session.
- `error.ts`: chuẩn hóa error envelope của BE và giữ correlation ID cho hỗ trợ. Không đưa password/token/request body vào log.
- `contracts.ts`: DTO và schema theo code C#. Các trường nullable chấp nhận cả bị lược bỏ, phù hợp `WhenWritingNull`.
- `ResourcePage.tsx`: danh sách, trạng thái tải/lỗi/rỗng, phân trang phía server và quyền đăng nhập dùng chung. Query key gồm tài khoản để tránh lẫn dữ liệu.
- Repository theo feature chuyển DTO backend sang model UI. Component không tự thêm Bearer hay tự refresh token.

Ví dụ cho một API mới:

```ts
const result = await apiJson("/api/v1/example", responseSchema, {
  method: "POST",
  body: input,
  signal,
  idempotencyKey: attemptKey,
});
```

Tạo `attemptKey` khi bắt đầu một thao tác. Giữ nguyên key và payload khi thử lại sau lỗi mạng; thao tác mới dùng key mới. Không thêm retry tự động cho mutation ngoài lần xử lý 401. Dữ liệu trả về phải qua schema tương ứng trước khi dùng.

Token hiện lưu trong `sessionStorage` vì BE trả access/refresh token trong JSON. Đây không phải thiết kế HttpOnly cookie/BFF. Khi đổi BE sang cookie, thay transport/session chung, không sửa từng trang. Phân quyền luôn được BE quyết định; role ở UI chỉ phục vụ điều hướng.

## Phạm vi đã nối

| Chức năng | Cách sử dụng API thật |
|---|---|
| Đăng nhập | `identifier/password`, JWT, refresh và logout |
| Đăng ký / quên mật khẩu | Nhận response trung lập 202, không giả báo đã tạo tài khoản |
| Xác minh / gửi lại mã / reset | `/verify-email`, `/reset-password`; nhập mã yêu cầu và mã xác minh từ email |
| Tìm chuyến | Nhập tên thành phố; BE chưa có API danh mục địa điểm. Chuyển tham số sang `origin/destination`; sắp xếp trên tập kết quả lấy về (tối đa 100 chuyến) |
| Chọn ghế / hành khách | Dùng GUID thật; danh sách ghế theo mã vì API public không trả tọa độ vật lý. Nhập liên hệ riêng. Ghi chú chưa được BE hỗ trợ nên không hiển thị ở chế độ thật |
| Tạo đơn | Bản nháp local chưa giữ ghế. Khi xác nhận: tạo `seat-holds`, rồi gửi `holdToken/contact/passengers/expectedTotal/paymentChannel`. Giữ key ổn định khi thử lại |
| Thanh toán | Tạo payment cho booking, mở `providerAction.redirectUri`, kiểm tra trạng thái từ BE sau khi quay lại; không tin kết quả ở query string |
| Vé của tôi / chi tiết | Phân trang BE, dùng ticket GUID để mở chi tiết |
| Hủy vé | Preview phí từ BE, gửi preview ID và rowVersion, nhận 202; không giả báo hoàn tiền xong |
| Nhà xe | Xem chuyến, xe, tài xế, tuyến, manifest, doanh thu; công bố chuyến nháp |
| Admin | Xem người dùng, booking, payment, refund theo phân trang BE |

Các danh sách quản trị thật dùng bảng chung hiển thị các trường BE thực sự cung cấp. Chúng chưa giữ toàn bộ bố cục và chức năng chỉnh sửa của bản mock. Các biểu mẫu tạo/sửa nhà xe, màn hình staff/membership riêng, danh sách tổ chức, OAuth, khám phá tỉnh và tra vé khách vãng lai chưa được kết nối; các route này hiển thị chưa khả dụng thay vì gửi request giả hoặc báo thành công giả. Backend có một số API mutation cho các chức năng này, nhưng form/mock contract hiện tại khác model BE, cần adapter/form bổ sung.

Bản nháp đặt vé có thời hạn local 15 phút; chưa tạo hold trong lúc nhập liệu. Điểm đón/trả đang dùng điểm đầu/cuối hợp lệ của chuyến và được hiển thị trong phần hành trình. BE vẫn kiểm tra tồn ghế, giá và quyền tại thời điểm xác nhận. Nếu hold đã được tạo nhưng người dùng rời trang giữa chừng, BE tự hết hạn hold sau thời gian quy định.

## Kiểm tra

```sh
pnpm typecheck
pnpm test --maxWorkers=2
pnpm exec playwright test --config playwright.live.config.ts
pnpm build
```

Bộ live trong `tests/live/booking.spec.ts` chạy bằng Chrome và chặn HTTP bằng fixture contract C# để kiểm tra luồng UI thật mà không dùng MSW. Nó không thay thế smoke test với PostgreSQL/RabbitMQ/VNPay thật. Chưa xác nhận toàn bộ stack trên máy này vì không có Docker trong PATH.

Không commit file `.env`, token hay dữ liệu người dùng thật. Thay đổi kết nối nằm trong thư mục FE; không cần sửa backend để bật lớp client này.

Trong “Vé của tôi”, tab “Đơn đặt vé” tải đơn từ BE và cho phép mở lại thanh toán khi đơn còn chờ trả tiền. Checkout thật không phụ thuộc bản nháp local; BE kiểm tra JWT và quyền sở hữu đơn. Luồng Chrome có kiểm tra tải lại trang sau khi xóa bản nháp, xem chi tiết vé, preview phí hủy và gửi yêu cầu hủy với version hiện tại.
