# BLUE Travel v3 — Desktop frontend

Customer, Operator và Admin là **ba web desktop riêng**, dùng chung source/design primitives trong thư mục này. Không triển khai native mobile app trong đợt hoàn thiện này.

## Chuẩn bị

Dùng Node `24.22.0`, pnpm `10.34.7`. Tại thư mục này chạy `pnpm install --frozen-lockfile`.
Nếu muốn dùng đúng runtime mà không thay phiên bản toàn máy:

```powershell
npm exec --yes --package=node@24.22.0 --package=pnpm@10.34.7 -- pnpm install --frozen-lockfile
```

## Chạy từng web

Tại `workspace/`, mỗi lệnh chạy trong một terminal:

```powershell
npm run dev:customer
npm run dev:operator
npm run dev:admin
```

| Web | Địa chỉ | Tài khoản demo | Mật khẩu |
|---|---|---|---|
| Customer | http://127.0.0.1:5173 | test+review@example.invalid | BlueDemo2026 |
| Operator | http://127.0.0.1:5174 | operator@blue.example.invalid | BlueDemo2026 |
| Admin | http://127.0.0.1:5175 | admin@blue.example.invalid | BlueDemo2026 |

Staff có trang đăng nhập riêng. Customer không chứa route Operator/Admin; các web staff không chứa luồng đặt vé khách. Phiên đăng nhập tách theo origin. Các thư mục `../customer-web`, `../operator-web`, `../admin-web` có package/lệnh riêng, source dùng chung ở đây để tránh ba bản sao bị lệch nhau.

Mặc định hoàn toàn mock, không cần BE, database hoặc VNPay thật. Đăng nhập Google/Facebook, thanh toán và hỗ trợ đều là mô phỏng. Không nhập thông tin ngân hàng thật. Khi cần tích hợp sau này, đặt `VITE_API_MODE=live` tường minh rồi build lại; chưa nghiệm thu live trong đợt này.

## Dữ liệu và kịch bản

- 630 chuyến demo trên 12 cặp điểm đi/đến có chiều, trong 7 ngày; nhiều khung giờ, giá, loại xe và tồn ghế.
- Customer có lịch sử được tạo qua các mutation mock thật: 4 booking/payment, 6 vé, gồm vé hủy một phần và hoàn tiền đang xử lý. Tài khoản demo chỉ thấy 5 vé thuộc quyền; vé của tài khoản khác được lọc.
- Có thể đặt vé mới, tra cứu bằng email, chọn ghế/hành khách, thanh toán và hủy. Mock lưu theo phiên trình duyệt; tải lại vẫn giữ dữ liệu.
- Google/Facebook có thành công/lỗi thử lại. Đăng ký rồi xác minh/reset dùng mã demo `123456`; tài khoản demo mới được lưu dạng digest mật khẩu, không lưu plaintext. Chỉ dùng mật khẩu thử nghiệm.
- Checkout VNPay giữ giao diện Travel v3, thêm cổng mô phỏng QR/ATM/thẻ quốc tế, 6 ngân hàng mẫu và kết quả thành công/chờ/thất bại/hủy. Không kết nối ngân hàng.
- Operator có tuyến/điểm dừng, xe/sơ đồ ghế, tài xế, chuyến nháp/review/publish, booking/manifest, hủy/hoàn, báo cáo, tổ chức/thành viên và đối soát. Dữ liệu tổ chức/thành viên và đối soát demo được lưu theo phiên.
- Admin có tổ chức, thành viên, booking, payment, refund; bộ lọc URL, modal tạo/sửa, trạng thái tải/rỗng/lỗi/403/404. Tổ chức/nhân viên/phân quyền tạo mới được lưu qua reload.
- Xóa dữ liệu trang/sessionStorage để reset demo. Trong test thuần chức năng có thể dùng `VITE_DEMO_HISTORY=off` để không seed lịch sử Customer.

## Build và kiểm thử

Tại `workspace/`: `npm run build:web` build tuần tự cả ba web. Hoặc tại từng thư mục app chạy `npm run build`.
Artifact tương ứng ở `customer-web/dist/client`, `operator-web/dist/client`, `admin-web/dist/client`. `npm run preview` tại từng app phục vụ SPA/deep-link trên cổng riêng.

Tại thư mục `web/`:

```powershell
pnpm typecheck
pnpm lint
pnpm test --maxWorkers=2
pnpm exec playwright test --config playwright.portals.config.ts --project=desktop
pnpm exec playwright test tests/e2e/figma-fidelity.spec.ts tests/e2e/customer-booking.spec.ts tests/e2e/cancellation.spec.ts tests/e2e/accessibility.spec.ts --project=w1440 --workers=1
```

`playwright.portals.config.ts` kiểm thử ba **bản build** riêng trên 5273/5274/5275; cần build trước. Manifest `all` chỉ dùng cho regression harness cũ, không phải app triển khai mặc định. Không chạy song song typegen/build nhiều target trên cùng source.

## Thiết kế và tài liệu

[Travel v3](https://www.figma.com/design/OCkWSOZQ8Pq8AejXccajpO/Travel-v3): Customer Desktop `7:5`, Operator Desktop `7:7`, Admin Desktop `7:11`. Dùng assets local, shared UI/tokens và các state đã mapping.

Báo cáo trước triển khai: `docs/implementation/2026-11-15-fe-detailed-audit.md` tại repository root. Kết quả kiểm thử sau triển khai được lưu riêng, không dùng kết quả lịch sử để tuyên bố nghiệm thu.
