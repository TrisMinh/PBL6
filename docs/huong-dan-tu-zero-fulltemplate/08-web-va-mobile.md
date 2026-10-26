# 08 — Web và Mobile

## 1. Tạo hai package dùng chung

### `@busticket/api-client`

Tạo:

```text
src/packages/api-client/
├─ package.json
└─ src/index.ts
```

`package.json` export `./src/index.ts`. `index.ts` chịu trách nhiệm:

- base URL Gateway;
- thêm bearer token;
- thêm correlation/idempotency header khi cần;
- parse error envelope;
- type cho request/response;
- hàm gọi auth, trip, booking, payment, admin/reporting.

Không để component UI tự viết `fetch` rải rác.

### `@busticket/ui`

Tạo:

```text
src/packages/ui/
├─ package.json
├─ theme.ts
└─ tokens.css
```

- `theme.ts`: token dùng trong TypeScript/React Native.
- `tokens.css`: CSS custom properties cho web.
- giữ tên token tương đương giữa hai file để web/mobile cùng ngôn ngữ thiết kế.

## 2. Customer Web

Scaffold:

```powershell
npm create vite@latest src/apps/customer-web -- --template react-ts
```

Đổi package name thành `@busticket/customer-web`, rồi cài:

```powershell
npm install -w @busticket/customer-web react@^19 react-dom@^19 react-router-dom@^7.6 lucide-react@^1.47 qrcode.react@^4.2
npm install -D -w @busticket/customer-web typescript@~5.8.3 vite@^6.2.4 @vitejs/plugin-react@^4.4.1 @types/react@^19 @types/react-dom@^19
```

File cần hoàn thiện:

| File | Trách nhiệm |
|---|---|
| `index.html` | HTML shell và metadata |
| `vite.config.ts` | React plugin và dev server |
| `tsconfig.json` | strict TypeScript và JSX |
| `src/main.tsx` | mount React, Router và providers |
| `src/session.tsx` | token/session context |
| `src/App.tsx` | route và màn hình customer |
| `src/styles.css` | layout/component/responsive |
| `src/vite-env.d.ts` | type cho Vite env |
| `public/images/*` | ảnh hero/coach tối ưu |

Luồng nên làm theo thứ tự:

1. shell/header/footer;
2. đăng ký/đăng nhập;
3. tìm chuyến;
4. xem ghế;
5. tạo seat hold;
6. tạo booking;
7. checkout/payment;
8. xem vé và QR;
9. profile/lịch sử.

## 3. Back-office Web

Scaffold React TypeScript lần hai, package name `@busticket/backoffice-web`, port 5174. Cài React, router, local API client và UI package.

File giống Customer Web, nhưng `App.tsx` chứa màn hình operator/admin:

- trip/coach/route management;
- booking/manifest;
- payment/refund/settlement;
- user/membership;
- reporting.

`session.tsx` phải đọc role claim và chặn route theo quyền. UI guard chỉ để trải nghiệm; API vẫn phải authorize thật.

## 4. Mobile

Tạo Expo app trong npm workspace, package name `@busticket/mobile`. Thư viện đúng được liệt kê ở phụ lục A.

File:

| File | Trách nhiệm |
|---|---|
| `app.json` | metadata Expo, scheme và platform config |
| `babel.config.js` | Babel preset Expo |
| `metro.config.js` | resolve package trong monorepo |
| `index.ts` | register root component/navigation |
| `tsconfig.json` | cấu hình TypeScript Expo |
| `src/session.ts` | token bằng `expo-secure-store` |
| `src/types.ts` | navigation/domain UI types |
| `src/ui.tsx` | component/theme dùng chung |
| `src/screens/Auth.tsx` | login/register/verify |

Không lưu token mobile bằng plain AsyncStorage; template dùng Secure Store.

## 5. Biến môi trường client

Web chỉ được nhận biến public có prefix `VITE_`, ví dụ:

```text
VITE_API_BASE_URL=http://localhost:5080
```

Không đưa signing key, database password hoặc RabbitMQ credential vào Vite/Expo bundle.

## Checkpoint 08

```powershell
Set-Location workspace
npm install
npm run build:web
npm run dev:customer
npm run dev:backoffice
npm run typecheck -w @busticket/mobile
```

Web phải build không có TypeScript error. Khi dev, Customer ở `5173`, Back-office ở `5174`, mọi API request đi qua Gateway `5080`.
