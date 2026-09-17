# 3.7.4 Client State, Security và Resilience

## State ownership

| State | Owner/client strategy |
|---|---|
| Server resource | Query cache keyed bằng endpoint + normalized filter + authenticated subject/tenant scope |
| Form draft | Local form state; không ghi PII vào URL/localStorage |
| Auth session Web | Access token memory; refresh qua HttpOnly Secure SameSite cookie nếu deployment chọn cookie flow |
| Auth session Mobile | Secure storage adapter; không log/analytics token |
| Seat selection | Local `SELECTED`; chỉ response SeatHold tạo quyền server |
| Countdown | `expiresAt` + `serverTime`; resync khi focus/resume và trước command |
| Payment result | Poll/refetch server; redirect/deep link chỉ là trigger |
| Feature | Build/config capability registry; flag false loại navigation/route/action |

## OpenAPI client rule

- TypeScript client và C# contract tests được sinh/kiểm tra từ `docs/contracts/openapi`.
- UI không khai báo lại enum state/error/money DTO bằng tay.
- Unknown enum render fallback an toàn và refresh/upgrade action; không suy ra thành success.
- Mọi mutation nhận cancellation signal, correlation ID và idempotency key khi contract yêu cầu.

## Idempotency key lifecycle

- Tạo key một lần khi người dùng bắt đầu một logical submit.
- Retry cùng payload/outcome chưa chắc chắn dùng lại key.
- Người dùng thay đổi payload sau validation/business response phải tạo key mới, trừ khi sửa lỗi transport trước khi server nhận.
- Không dùng timestamp đơn thuần hoặc reuse một key cho hai operation/target khác nhau.

## Authentication flow

- Protected route chờ bootstrap session; không flash dữ liệu/menu trái quyền.
- 401 do access expiry có tối đa một refresh in-flight; request khác chờ kết quả để tránh refresh storm.
- Refresh fail/reuse detection xóa local session và điều hướng login với return path an toàn.
- 403/404 không trigger refresh loop.
- Logout xóa cache theo subject/tenant và revoke server session.

## Payment state projection

```text
PAY_LATER Booking CONFIRMED + tickets complete → UI SUCCESS
Payment PENDING/PROCESSING          → UI PROCESSING
Payment SUCCEEDED + Booking pending → UI CONFIRMING
Booking PAID + tickets complete     → UI SUCCESS
Payment final FAILED/CANCELLED      → UI FAILED/CANCELLED
Convergence vượt p99/manual case    → UI NEEDS_SUPPORT
```

Client chỉ hiển thị SUCCESS khi Booking `PAID` hoặc `CONFIRMED` và ticket count khớp item count. Không hiển thị QR từ dữ liệu một phần.

## Offline/mobile

- Search/booking/payment command yêu cầu online.
- Ticket đã tải có thể đọc offline kèm `lastSyncedAt`; app refetch khi online.
- Driver check-in không có offline mutation queue trong MVP.
- Không tự replay command tài chính khi app resume; refetch trạng thái trước.

## Telemetry/privacy

- Analytics không chứa Passenger, email, phone, QR/public code, token hoặc full Booking ID nếu không cần.
- Error boundary gửi safe error code, route template, build version và correlation/trace reference; không gửi response body nhạy cảm.
- Cache/persistence được xóa khi đổi subject/tenant/logout.
