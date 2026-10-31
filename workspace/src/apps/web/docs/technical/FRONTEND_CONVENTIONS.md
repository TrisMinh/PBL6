# Quy ước frontend

**Trạng thái:** Đã duyệt · **Cập nhật:** 2026-10-18

## Đặt tên

| Đối tượng | Quy tắc | Ví dụ |
|---|---|---|
| Thư mục | kebab-case | `passenger-details/` |
| Component/page | PascalCase.tsx | `TripCard.tsx` |
| Hook | useCamelCase.ts | `useBookingSession.ts` |
| API/service | camelCase.ts | `bookingApi.ts` |
| Schema | camelCase.schema.ts | `passenger.schema.ts` |
| Test | tên nguồn + `.test` | `TripCard.test.tsx` |
| Biến/hàm | camelCase | `selectedSeats` |
| Boolean | is/has/can/should | `isLoading` |
| Event prop/handler | on... / handle... | `onSubmit`, `handleSubmit` |
| Constant | UPPER_SNAKE_CASE | `HOLD_DURATION_MS` |
| Type | PascalCase, không tiền tố I | `BookingResponse` |
| URL | chữ thường, danh từ số nhiều | `/admin/bookings/:bookingId` |
| Env | VITE_ | `VITE_API_BASE_URL` |

Code dùng tiếng Anh; nội dung UI dùng tiếng Việt. Không dùng tên layer Figma vô nghĩa như `n340`. Import nội bộ dùng alias `@/`. Exported function có return type rõ.

## BEM và Tailwind

Tailwind dùng cho layout, spacing, responsive và utility. Mọi CSS tự viết dùng BEM:

```css
.trip-card {}
.trip-card__operator {}
.trip-card--selected {}
.trip-card__seat--unavailable {}
```

Không styling bằng ID, không phụ thuộc selector DOM sâu, không hardcode màu khi đã có semantic token. Modifier chỉ diễn tả trạng thái/variant.

## Clean code

- Component có một vai trò rõ; page không gọi HTTP trực tiếp.
- Không giữ derived state nếu có thể tính từ nguồn hiện có.
- Không magic string cho route, query key, status hoặc error code.
- Không `console.log`, code comment-out hoặc secret.
- Comment giải thích lý do/ràng buộc, không lặp lại code.
- Mọi page dữ liệu có loading, empty, error và success phù hợp.
- Semantic HTML, keyboard navigation, focus visible và touch target tối thiểu 44px.
## Icon imports và prerender

Import Phosphor theo từng file, ví dụ `import { WarningCircleIcon } from "@phosphor-icons/react/dist/csr/WarningCircle"`. Không dùng root barrel `@phosphor-icons/react` cho component runtime. SSR bundle externalizes thư viện: root import buộc Node nạp toàn graph icon trước response prerender đầu tiên; optimizeDeps chỉ giải quyết prebundle development, không tree-shake graph external ở SSR. Giữ explicit leaf entries cần thiết trong optimizeDeps cho route lazy.

Plan04 Task5 regression: đo được root import nạp 4.541 Phosphor modules trong 4.820 ms, trong khi một leaf chỉ nạp 4 modules trong 13 ms trên Node 24 đã pin. Default prerender timeout vẫn giữ nguyên; không thêm retry/sleep hoặc sửa node_modules. Production artifact test rejects a root Phosphor import in build/server/index.js. Chạy typegen/build tuần tự để tránh Windows .react-router EPERM; build lặp để xác minh sau root-cause fix, không coi lần retry pass là fix.
