# 3.7.3 React Design System Baseline

Phong cách sản phẩm ưu tiên tin cậy, rõ giá/chính sách và thao tác nhanh trong bối cảnh di chuyển. Customer UI có nhịp thoáng; Back-office ưu tiên mật độ vừa phải và quét dữ liệu nhanh. Không dùng dashboard/card tràn lan khi bảng hoặc danh sách có cấu trúc phù hợp hơn.

## Design tokens

```css
:root {
  --color-brand-900: #0b1f33;
  --color-brand-700: #0f3d56;
  --color-action-700: #0b5cad;
  --color-action-100: #e8f2ff;
  --color-accent-700: #c2410c;
  --color-success-700: #16704a;
  --color-warning-700: #9a6700;
  --color-danger-700: #b42318;
  --color-neutral-950: #15191e;
  --color-neutral-700: #46515d;
  --color-neutral-300: #cbd2d9;
  --color-neutral-100: #f1f4f6;
  --color-surface: #ffffff;
  --color-background: #f6f8fa;
  --focus-ring: #2563eb;

  --font-sans: Inter, "Segoe UI", Arial, sans-serif;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;
}
```

Màu state phải đi cùng icon/text/pattern. Contrast của text/action được kiểm tra tự động; token không đạt WCAG AA không được dùng cho chữ kích thước thường.

## Type scale

| Token | Web size/line | Dùng cho |
|---|---|---|
| Display | 40/48 desktop, 32/40 mobile | Hero/search intent duy nhất |
| H1 | 32/40 | Tên page |
| H2 | 24/32 | Section lớn |
| H3 | 20/28 | Section con/card title |
| Body | 16/24 | Nội dung/form |
| Small | 14/20 | Metadata/helper |
| Mono | 14/20 | Booking/public/correlation code |

## Component inventory MVP

- App shell, responsive header/sidebar/breadcrumb.
- Button/link/icon button với loading/disabled/destructive state.
- Text/date/phone/password/select/combobox field và field error.
- Search form, filter drawer, sort control và pagination.
- Trip result row, itinerary/timeline và fare/policy summary.
- Accessible seat map: seat button, legend, selected summary.
- Countdown synced theo server time.
- Money summary, confirmation panel và status timeline.
- Data table với column visibility/responsive alternate list.
- QR panel + public code + offline/stale indicator.
- Empty/error/permission/not-found state.
- Dialog/drawer/toast/banner; dialog chỉ dùng khi cần giữ context.

## Interaction baseline

- Minimum interactive target 44×44 CSS px cho touch-critical action.
- Focus visible rõ, focus trap đúng trong dialog và trả focus về trigger.
- Form submit bằng keyboard; error summary focusable và link đến field.
- Loading skeleton chỉ dùng khi layout đã biết; action mutation dùng progress text rõ.
- Animation tôn trọng `prefers-reduced-motion`, không dùng motion để truyền trạng thái duy nhất.
- Seat map có accessible name dạng “Ghế A1, còn trống, 150.000 đồng”; selected/held/booked/disabled không chỉ khác màu.

## Shared package boundary

Customer Web và Back-office có thể chia sẻ token, primitive và icon. Không chia sẻ page component, router, API cache hoặc role-specific business component. Mobile chuyển token qua theme TypeScript tương đương thay vì import CSS.
