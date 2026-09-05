# 3.1.5 Payment & Refund API

Owner: Payment Service. Chỉ service này giao tiếp Payment Gateway và sở hữu trạng thái Payment/Refund.

## Customer và admin endpoints

| Operation ID | Method/path | Permission | Idempotency | Success |
|---|---|---|---|---:|
| `createPayment` | `POST /api/v1/bookings/{bookingId}/payments` | Customer owns Booking | Required | `201/202` |
| `getPayment` | `GET /api/v1/payments/{paymentId}` | Customer owner hoặc `tenant.payment.read`/`platform.payment.read` + scope | No | `200` |
| `listBookingPayments` | `GET /api/v1/bookings/{bookingId}/payments` | Customer owner hoặc `tenant.payment.read`/`platform.payment.read` + scope | No | `200` |
| `cancelPayment` | `POST /api/v1/payments/{paymentId}/cancel` | Customer owner theo policy hoặc `platform.payment.manage` | Required | `200/202` |
| `createRefund` | `POST /api/v1/refunds` | workload identity hoặc `tenant.refund.request`/`platform.refund.request` + scope | Required | `202` |
| `getRefund` | `GET /api/v1/refunds/{refundId}` | Customer owner hoặc `tenant.refund.read`/`platform.refund.read` + scope | No | `200` |
| `searchAdminPayments` | `GET /api/v1/admin/payments` | `tenant.payment.read` hoặc `platform.payment.read` + scope | No | `200` |
| `searchAdminRefunds` | `GET /api/v1/admin/refunds` | `tenant.refund.read` hoặc `platform.refund.read` + scope | No | `200` |

Create Payment không nhận `amount` làm nguồn sự thật. Payment Service lấy/verifies booking payment snapshot qua trusted internal contract/event projection; request chỉ chọn `provider`, `method` và return/deep-link metadata allow-listed.

```json
{
  "provider": "CONFIGURED_PROVIDER",
  "method": "EWALLET",
  "returnUri": "https://allowed.example/payment-return"
}
```

Response `PROCESSING`:

```json
{
  "paymentId": "payment-1",
  "bookingId": "booking-1",
  "status": "PROCESSING",
  "amount": 300000,
  "currency": "VND",
  "providerAction": {
    "type": "REDIRECT",
    "url": "https://provider.example/...",
    "expiresAt": "2026-08-19T03:10:00Z"
  },
  "statusUrl": "/api/v1/payments/payment-1"
}
```

Client không suy luận success từ `returnUri`; luôn đọc status server.

## Refund internal/admin request

```json
{
  "refundReference": "refund-logical-1",
  "paymentId": "payment-1",
  "bookingId": "booking-1",
  "amount": 150000,
  "currency": "VND",
  "reason": "CUSTOMER_CANCELLATION"
}
```

Internal caller phải có workload identity và scoped permission. Payment khóa/kiểm tra tổng successful refund trước khi nhận request. Retry cùng reference/key trả Refund cũ.

## Provider webhook

| Operation ID | Method/path | User auth | Success contract |
|---|---|---|---|
| `handlePaymentWebhook` | `POST /integrations/payments/{provider}/webhooks` | Không dùng | `2xx` sau khi verified outcome đã persist hoặc duplicate hợp lệ được nhận diện |

- Đọc raw body để verify chữ ký trước JSON transformation.
- Kiểm tra provider/merchant, timestamp/replay window, external event ID, transaction ID, amount và currency.
- Invalid signature/mismatch không thay Payment, không publish success; trả status theo provider contract và ghi security metric/audit an toàn.
- Transaction `Payment state + WebhookReceipt + Outbox` là atomic.
- p95 persist + acknowledgement ≤ 2 giây; không chờ Booking, Notification hoặc Reporting.

## Reconciliation API/job

Admin endpoint `POST /api/v1/admin/payments/{paymentId}/reconcile` yêu cầu `platform.payment.reconcile`, reason và Idempotency-Key. Kết quả chưa chắc chắn giữ `PROCESSING`; outcome mâu thuẫn mở `ReconciliationCase`, không đổi `SUCCEEDED → FAILED`.
