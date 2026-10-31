# Công cụ frontend

**Trạng thái:** Đã duyệt cho mock · **Cập nhật:** 2026-10-18

| Công cụ | Phiên bản khóa | Vai trò | Quy tắc sử dụng |
|---|---|---|---|
| Node.js | 24.22.0 | Runtime | Khớp `.nvmrc` và `engines.node` |
| pnpm | 10.34.7 | Package manager | Khớp `packageManager`; commit `pnpm-lock.yaml` |
| React + TypeScript strict | 19.3.1 / 5.9.3 | UI và type safety | Không dùng `any` tùy tiện |
| Vite | 8.3.4 | Build/dev tooling | Không truy cập env ngoài `import.meta.env` |
| React Router Framework Mode | 8.4.0 | Route, prerender, SPA fallback | `ssr:false`; prerender route công khai ổn định |
| Tailwind CSS | 4.3.3 | Utility và responsive | Token qua CSS variables; CSS riêng dùng BEM |
| Radix UI primitives | dialog 1.3.1, dropdown 2.2.1, select 2.4.1 | Dialog/select/dropdown/accessibility | Tự style theo BLUE |
| Phosphor Icons | 2.1.10 | Icon thống nhất | Không trộn bộ icon khác hoặc emoji UI |
| TanStack Query | 5.104.4 | Server/mock state | Query key tập trung theo feature |
| Zustand | 5.0.15 | Booking draft | Không sao chép server state |
| React Hook Form + Zod | 7.90.0 / 4.6.7 | Form và validation | Form lớn tách section, không mirror sang Zustand |
| MSW | 3.0.3 | Mock API | Handler bám contract; dùng `onUnhandledFrame` |
| date-fns | 4.4.0 | Ngày giờ | Lưu UTC, format theo locale Việt Nam |
| ESLint + Prettier | 10.13.0 / 3.9.10 | Lint/format | Flat config; Prettier sắp xếp class Tailwind |
| Vitest + Testing Library | 5.0.5 / 16.3.3 | Unit/integration | Test hành vi người dùng |
| Playwright | 1.64.1 | E2E responsive | Bao phủ các luồng nghiệp vụ chính |
| Husky + lint-staged | 9.1.7 / 17.6.0 | Pre-commit | Hook có hiệu lực sau khi khởi tạo Git |

## Lệnh chuẩn

```text
pnpm dev
pnpm build
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
```

Chỉ nâng phiên bản sau khi đọc changelog, chạy toàn bộ kiểm tra liên quan và cập nhật file này cùng lockfile.
