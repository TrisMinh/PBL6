# 3.7 UI/UX Design

Thiết kế UI chuyển yêu cầu giao diện thành route, screen contract, state và component rule có thể triển khai bằng React/React Native. API/server vẫn là nguồn quyết định giá, quyền, Payment và ownership.

## Application baseline

| Application | Runtime | Actor | Phạm vi MVP |
|---|---|---|---|
| Customer Web | React + TypeScript | Guest, Customer | Toàn bộ Customer `MUST` |
| Back-office Web | React + TypeScript | Admin, Operator Staff, Driver | Toàn bộ back-office `MUST`, responsive cho Driver |
| Mobile | React Native + TypeScript | Customer | Toàn bộ Customer `MUST`, QR/deep link/secure storage |

Ba application dùng cùng OpenAPI-generated types, error-code catalog và terminology. Không dùng chung router, business store hoặc authentication persistence implementation.

## Tài liệu

- [Information architecture và route map](./01-information-architecture.md)
- [Screen contracts](./02-screen-contracts.md)
- [React design system baseline](./03-react-design-system.md)
- [Client state, security và resilience](./04-client-state-security.md)

## UI release gate

- Mỗi screen có loading, empty, error, retry và permission state phù hợp.
- Luồng destructive/financial có review/confirmation và chống double-submit.
- WCAG 2.1 AA cho luồng cốt lõi; dùng được bằng bàn phím trên Web.
- Không dùng màu làm tín hiệu duy nhất; QR có public code thay thế.
- Không lộ cross-tenant resource qua menu, URL direct access, cache key hoặc error detail.
- Mobile/Web không tự suy luận Payment success từ redirect/deep link.
- Feature `SHOULD/COULD` không xuất hiện trong menu/router khi flag tắt.
