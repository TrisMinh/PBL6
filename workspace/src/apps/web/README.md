# BLUE — Travel v3 Frontend

Frontend React cho nền tảng đặt vé xe BLUE, gồm website khách hàng và trang quản trị. Source hiện có trọn luồng mock tìm chuyến → giữ ghế → hành khách → review → VNPay → tra cứu/vé điện tử → hủy một phần, cùng đăng nhập, lịch sử vé và các module quản trị. Dữ liệu, thanh toán và hoàn tiền chỉ được mô phỏng trong development/test; ứng dụng không kết nối backend hoặc ngân hàng thật.

## Chạy nhanh

Yêu cầu Node.js `24.22.0` và pnpm `10.34.7`. Kiểm tra trước khi chạy:

```powershell
node --version
pnpm --version
```

Nếu chưa có pnpm, tải và cài đúng phiên bản bằng npm (được cài kèm Node.js):

```powershell
npm install --global pnpm@10.34.7
pnpm --version
```

Sau khi có đúng phiên bản Node.js và pnpm, mở PowerShell tại thư mục dự án:

```powershell
cd D:\HK7\Figma\FE
pnpm install --frozen-lockfile
pnpm dev
```

Nếu lưu dự án ở vị trí khác, thay đường dẫn trong lệnh `cd` tương ứng. Mở [http://localhost:5173](http://localhost:5173); dùng `Ctrl+C` để dừng. Dự án hiện không cần file `.env`, backend hay database để chạy chế độ development vì API được mô phỏng bằng MSW.

Lưu ý: `.npmrc` bật `engine-strict=true`, nên cài dependency bằng phiên bản Node khác `24.22.0` sẽ bị từ chối. Xem phần chuẩn bị môi trường bên dưới nếu cần đổi Node.

## Phạm vi sản phẩm theo kế hoạch

- Khách hàng tìm chuyến, chọn ghế, nhập thông tin, thanh toán VNPay mô phỏng, xem vé và yêu cầu hủy/hoàn một phần.
- Khách có thể đặt vé không cần đăng nhập; đăng ký, đăng nhập và đăng nhập Google/Facebook đều được mô phỏng.
- Một tài khoản super admin quản lý dữ liệu và giao dịch qua giao diện admin.
- Responsive từ 360px đến màn hình desktop lớn. Không xây native mobile app, cổng nhà xe hoặc cổng tài xế.

## Stack đã chốt

- React, Vite, TypeScript strict, pnpm.
- React Router Framework Mode với `ssr: false`; prerender các route công khai ổn định.
- Tailwind CSS cho utility/responsive; CSS tùy chỉnh bắt buộc theo BEM.
- Radix UI, Phosphor Icons, TanStack Query, Zustand, React Hook Form, Zod, MSW, date-fns.
- ESLint, Prettier, Vitest, Testing Library, Playwright, Husky và lint-staged.

Runtime nền đã được khóa ở Node `24.22.0` và pnpm `10.34.7`. Phiên bản package trực tiếp được khóa chính xác trong `package.json` và `pnpm-lock.yaml`.

## Chạy dự án trên Windows

### 1. Chuẩn bị môi trường

Cài đúng các phiên bản sau:

- Node.js `24.22.0`, được khai báo trong `.nvmrc`.
- pnpm `10.34.7`, được khai báo trong `package.json`.
- Git để Husky cài pre-commit hook khi cài dependency.

Kiểm tra máy có NVM hay không:

```powershell
Get-Command nvm -ErrorAction SilentlyContinue
```

Nếu lệnh trên hiển thị đường dẫn của `nvm`, chạy:

```powershell
nvm install 24.22.0
nvm use 24.22.0
node --version
```

Kết quả cuối phải là `v24.22.0`.

Nếu lệnh kiểm tra không hiển thị gì hoặc PowerShell báo `nvm is not recognized`, máy chưa cài NVM. Không chạy tiếp bằng Node phiên bản cũ. Hãy cài trực tiếp Node.js `24.22.0` từ trang phát hành chính thức của Node.js, đóng toàn bộ cửa sổ PowerShell, mở lại PowerShell rồi chạy:

```powershell
node --version
```

Chỉ tiếp tục khi kết quả là `v24.22.0`.

Kích hoạt đúng phiên bản pnpm:

```powershell
corepack enable
corepack prepare pnpm@10.34.7 --activate
pnpm --version
```

Kết quả cuối phải là `10.34.7`. Nếu máy không có lệnh `corepack`, chạy `npm install --global pnpm@10.34.7`.

### 2. Cài dependency

Mở PowerShell tại thư mục dự án rồi cài đúng dependency trong lockfile:

```powershell
cd D:\HK7\Figma\FE
pnpm install --frozen-lockfile
```

### 3. Khởi động frontend

```powershell
pnpm dev
```

Mở [http://localhost:5173](http://localhost:5173) trên trình duyệt. Giữ cửa sổ PowerShell đang chạy. Nhấn `Ctrl+C` khi muốn dừng server.

Frontend tự khởi động Mock Service Worker trong môi trường development. Bạn không cần chạy backend, database hoặc VNPay thật. Dữ liệu thay đổi và phiên đăng nhập mock được lưu theo tab trình duyệt bằng `sessionStorage`.

### 4. Đăng nhập tài khoản demo

| Vai trò     | Email                           | Mật khẩu       | Trang đăng nhập                         |
| ------------ | ------------------------------- | ---------------- | ------------------------------------------ |
| Khách hàng | `test+review@example.invalid` | `BlueDemo2026` | `/login`                                 |
| Super admin  | `admin@blue.example.invalid`  | `BlueDemo2026` | `/login?redirectTo=/admin/organizations` |

Đây là credential công khai chỉ dùng cho dữ liệu mock. Không nhập mật khẩu thật vào ứng dụng.

## Kiểm tra chất lượng

Chạy các lệnh sau tại `D:\HK7\Figma\FE` khi cần kiểm tra thay đổi:

| Lệnh                         | Mục đích                                                               |
| ----------------------------- | ------------------------------------------------------------------------- |
| `pnpm format:check`         | Kiểm tra định dạng Prettier.                                          |
| `pnpm lint`                 | Kiểm tra ESLint và không cho phép warning.                            |
| `pnpm typecheck`            | Sinh type cho route và kiểm tra TypeScript.                             |
| `pnpm test`                 | Chạy toàn bộ unit/integration test một lần.                          |
| `pnpm test:coverage`        | Chạy test và xuất báo cáo coverage.                                  |
| `pnpm test:e2e --workers=1` | Chạy Playwright E2E ổn định trên năm viewport.                      |
| `pnpm build`                | Tạo production build và kiểm tra prerender.                            |
| `pnpm verify:build`         | Build rồi kiểm tra artifact, SPA fallback và deep link bằng Chromium. |

Trước khi chạy E2E lần đầu, cài Chromium cho Playwright:

```powershell
pnpm exec playwright install chromium
```

Full E2E có 240 executions trên năm viewport. Playwright không cấu hình retry. `pnpm verify:build` khởi động server kiểm tra tạm thời rồi tự dừng; đây không phải lệnh deploy production.

## Xử lý lỗi thường gặp

### Sai phiên bản Node hoặc pnpm

Nếu `pnpm install` báo lỗi `Unsupported engine`, chạy lại:

```powershell
nvm use 24.22.0
corepack prepare pnpm@10.34.7 --activate
node --version
pnpm --version
```

### PowerShell chặn `pnpm.ps1`

Không cần đổi Execution Policy. Dùng file lệnh `.cmd` tương ứng:

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd dev
```

### Cổng 5173 đang được sử dụng

Dừng tiến trình development cũ bằng `Ctrl+C`, sau đó chạy lại `pnpm dev`. E2E và tài liệu dự án đều dùng cổng `5173` mặc định.

### Muốn đặt lại toàn bộ dữ liệu mock

Mở DevTools của trình duyệt, vào Console rồi chạy:

```javascript
sessionStorage.clear();
location.reload();
```

Thao tác này chỉ xóa dữ liệu mock trong tab hiện tại.

## Route và tài khoản mock

- Customer: `/`, `/trips`, `/booking/:sessionId/{seats,passengers,review}`, `/payment/:bookingId/vnpay`, `/payment/vnpay/return`, `/tickets/lookup`, `/tickets/:ticketCode`, `/account/tickets`, `/bookings/:bookingCode/cancel`.
- Auth: `/login`, `/register`, `/forgot-password`.
- Admin: `/admin/organizations`, `/admin/staff`, `/admin/bookings`, `/admin/payments`, `/admin/refunds` và route detail tương ứng.
- Customer demo: `test+review@example.invalid` / `BlueDemo2026`.
- Super admin demo: `admin@blue.example.invalid` / `BlueDemo2026`.

Đây là credential công khai chỉ dành cho mock; không nhập mật khẩu thật. Guest có thể đặt vé và thanh toán mô phỏng, sau đó tra cứu bằng mã đặt vé cùng email/điện thoại người liên hệ. Phiên đăng nhập chỉ chứa token opaque/userId/role/expiry, không lưu email hay mật khẩu. Admin thiếu session chuyển `/login`; booking thiếu draft phục hồi tìm chuyến hết hạn; URL lạ có trang 404. Danh sách route canonical đầy đủ nằm trong [ROUTES.md](./docs/technical/ROUTES.md), còn thao tác thực tế nằm trong [hướng dẫn sử dụng](./docs/user/USER_GUIDE.md).

Lệnh build kiểm tra trực tiếp HTML prerender của `/` để tránh trang trắng trước JavaScript; route còn lại dùng SPA fallback. Development khởi động MSW trước route data; runtime production không import/start MSW browser, nhưng file public `mockServiceWorker.js` vẫn được copy vào build. `pnpm install` kích hoạt Husky pre-commit hook chạy lint-staged.

## Tài liệu quan trọng

- [PRD](./PRD.md)
- [Backlog](./TODO.md)
- [Kiến trúc hệ thống](./docs/technical/ARCHITECTURE.md)
- [Thiết kế frontend](./docs/technical/FRONTEND_ARCHITECTURE.md)
- [Công cụ và thư viện](./docs/technical/FRONTEND_STACK.md)
- [Quy ước code](./docs/technical/FRONTEND_CONVENTIONS.md)
- [Bản đồ quy tắc và vị trí file](./docs/technical/PROJECT_RULES_INDEX.md)
- [Quy trình thực thi Supervisor + Worker](./docs/technical/AGENT_EXECUTION_WORKFLOW.md)
- [Mapping Figma](./docs/technical/FIGMA_SCREEN_MAP.md)
- [Route](./docs/technical/ROUTES.md)
- [Hợp đồng dữ liệu mock](./docs/technical/API_CONTRACT.md)
- [Mapping dữ liệu frontend](./docs/technical/FE_BE_FIELD_MAPPING.md)
- [Quyết định kiến trúc](./docs/technical/DECISIONS.md)
- [Đặc tả brainstorming đã duyệt](./docs/superpowers/specs/2026-10-18-travel-v3-frontend-design.md)
- [Implementation master plan](./docs/superpowers/plans/2026-10-18-travel-v3-frontend-master-plan.md)

## Nguồn thiết kế

- Figma: https://www.figma.com/design/OCkWSOZQ8Pq8AejXccajpO/Travel-v3
- Customer Desktop: node `7:5`.
- Admin Desktop: node `7:11`.
- Brand Kit: node `0:1`; Components: node `7:3`.

## Ranh giới dự án

Database, ORM, server API và triển khai backend không thuộc dự án này. `API_CONTRACT.md` là contract nội bộ của frontend để MSW, query hooks và component dùng cùng một cấu trúc dữ liệu; nó không phải đặc tả công việc cho nhóm backend.
