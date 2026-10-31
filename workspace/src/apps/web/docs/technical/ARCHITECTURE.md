# Kiến trúc hệ thống BLUE Frontend

> Cập nhật: 2026-10-18 · Phiên bản: 1.0

## Tổng quan

BLUE là SPA React có hai vùng giao diện: Customer và Admin. Cả hai dùng cùng domain model và service interface; request được MSW xử lý bằng fixture/scenario. Đây là kiến trúc frontend độc lập, không bao gồm server hoặc database.

```text
Browser
  ├─ Customer routes ─┐
  └─ Admin routes ────┤
                      ▼
              React feature layer
               ├─ TanStack Query
               ├─ Zustand booking draft
               └─ React Hook Form + Zod
                      │
              typed service interfaces
                      │
             MSW mock API + fixtures
```

## Công nghệ

| Lớp | Công nghệ | Mục đích |
|---|---|---|
| UI | React + TypeScript strict | component và type safety |
| Build | Vite, pnpm | dev/build nhanh, lock dependency |
| Routing | React Router Framework Mode, `ssr:false` | SPA route, loader/action khi phù hợp, prerender route ổn định |
| Styling | Tailwind CSS + BEM custom CSS | responsive utility và CSS có cấu trúc |
| Primitives | Radix UI + Phosphor Icons | accessibility và icon nhất quán |
| Data | TanStack Query + MSW | server state và API mô phỏng |
| Client state | Zustand | booking draft liên màn hình |
| Forms | React Hook Form + Zod | form state và validation |
| Tests | Vitest, Testing Library, Playwright | unit, integration và E2E |

Phiên bản cụ thể được khóa trong TASK-001 theo phiên ổn định tương thích tại thời điểm cài đặt.

## Ranh giới module

- `app`: router, provider, layout và guard.
- `pages`: route module mỏng, ghép feature và layout.
- `features`: nghiệp vụ theo miền `auth`, `search`, `booking`, `payment`, `tickets`, `admin`.
- `components`: primitive/composite dùng lại nhưng không chứa nghiệp vụ của một feature.
- `mocks`: handler, fixture, factory và scenario MSW.
- `styles`: semantic tokens, global reset và BEM dùng chung.

Chi tiết cấu trúc, state ownership và dependency rules nằm trong `FRONTEND_ARCHITECTURE.md`.

## Luồng dữ liệu chính

### Đặt vé

1. Khách tìm chuyến; query string giữ trạng thái có thể chia sẻ.
2. TanStack Query lấy kết quả từ service; MSW trả response theo contract.
3. Chọn ghế tạo hold với `expiresAt`; Zustand lưu booking draft vào `sessionStorage`.
4. Form hành khách được Zod kiểm tra trước khi review.
5. VNPay mock trả một trong bốn trạng thái; success sinh booking/ticket mock.
6. Hết hạn hoặc xung đột ghế xóa/rollback phần state liên quan và dẫn khách phục hồi.

### Admin

1. Route guard kiểm tra session mock và role `admin`.
2. Layout admin tải navigation và render page theo route con.
3. Các bảng/chi tiết lấy dữ liệu qua query hooks, không đọc fixture trực tiếp.
4. Mutation cập nhật MSW in-memory state và invalidates query liên quan.

## Bảo mật và phân quyền

Client guard chỉ mô phỏng hành vi phân quyền giao diện, không phải lớp bảo mật server. Không lưu secret hoặc thông tin thanh toán thật trong repo/browser.

## Hiệu năng và SEO

- Lazy-load theo route/feature và tránh bundle thư viện không dùng.
- Dùng responsive image, kích thước ảnh rõ ràng và font loading có kiểm soát.
- Prerender homepage và route nội dung ổn định; route tìm kiếm/booking động dùng SPA fallback.
- Đặt metadata theo `CONTENT_STRATEGY.md`; `/admin/*`, auth callback và payment result dùng `noindex` khi phù hợp.

## Ranh giới

Kiến trúc này chỉ bao gồm frontend, build, test, mock API và tài nguyên tĩnh. Backend, database và ORM thuộc dự án khác. Hosting frontend, CI/CD và canonical domain sẽ được chọn khi chuẩn bị phát hành.

## Cancellation slice — Plan04 Task11

Feature `cancellation` giữ schema/type/repository/query/mutation/page/component riêng; UI không import fixture hoặc mockDb. GET options và POST mutation dùng cùng `CancellationAccess` union cho guest token hoặc account session. Server mock kiểm tra authority trước projection/mutation, canonicalize ticket set cho idempotency, validate toàn bộ selection trước một commit đồng bộ, rồi persist ticket lifecycle/refund/key cùng snapshot.

Ticket issuance summary của payment giữ immutable; private current Ticket mới mang trạng thái `issued|cancelled`. Ticket detail và account history project current status, còn refund là resource riêng `processing`. TanStack invalidation chỉ nhắm ticket detail/history sau success; mutation result được giữ để render processing state. Archive max100 và strict restore bảo vệ tab-local mock khỏi tăng vô hạn hoặc cross-link hỏng; đây vẫn là frontend mock, không thay backend/refund ledger thật.
