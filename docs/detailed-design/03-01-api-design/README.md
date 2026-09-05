# 3.1 API Design

Thiết kế API public qua API Gateway và internal endpoint có kiểm soát. Các bảng là OpenAPI-ready source: khi sinh file OpenAPI, operation ID, schema và error code phải giữ nguyên semantics tại đây.

## Danh mục

- [3.1.1 Common API Contract](./01-common-api-contract.md)
- [3.1.2 Identity API](./02-identity-api.md)
- [3.1.3 Transport API](./03-transport-api.md)
- [3.1.4 Booking, Ticket, Promotion, Review & Support API](./04-booking-ticket-api.md)
- [3.1.5 Payment & Refund API](./05-payment-refund-api.md)
- [3.1.6 Notification & Reporting API](./06-notification-reporting-api.md)

## Route ownership và precedence

| Priority | Pattern | Owner |
|---:|---|---|
| 1 | `/integrations/payments/{provider}/webhooks` | Payment |
| 2 | `/api/v1/bookings/{bookingId}/payments` | Payment |
| 3 | `/api/v1/trips/{tripId}/seats`, `/api/v1/trips/{tripId}/seat-holds`, `/api/v1/trips/{tripId}/reviews`, `/api/v1/seat-holds/**` | Booking |
| 4 | `/api/v1/operator/trips/{tripId}/manifest`, `/api/v1/operator/promotions/**` | Booking |
| 5 | `/api/v1/admin/organizations/{organizationId}/members/**` | Identity |
| 6 | `/api/v1/admin/organizations/**`, `/api/v1/operator/**`, `/api/v1/trips/**`, `/api/v1/routes/**` | Transport |
| 7 | `/api/v1/auth/**`, `/api/v1/users/**`, `/api/v1/admin/users/**` | Identity |
| 8 | `/api/v1/bookings/**`, `/api/v1/tickets/**`, `/api/v1/reviews/**`, `/api/v1/admin/bookings/**`, `/api/v1/admin/reviews/**`, `/api/v1/admin/support/**` | Booking |
| 9 | `/api/v1/payments/**`, `/api/v1/refunds/**`, `/api/v1/admin/payments/**`, `/api/v1/admin/refunds/**` | Payment |
| 10 | `/api/v1/notifications/**`, `/api/v1/notification-preferences/**` | Notification |
| 11 | `/api/v1/reports/**`, `/api/v1/exports/**` | Reporting |

Specific route phải đứng trước wildcard route. `/**` trong bảng biểu diễn cả collection root và descendant; cấu hình framework phải khai báo cả hai nếu matcher không có semantics đó. Test cấu hình Gateway phải chứng minh từng pattern đến đúng owner trước khi deploy. Gateway chỉ route và kiểm tra token sơ bộ; service owner vẫn tự thực thi authorization, tenant và ownership.
