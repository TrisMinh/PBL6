# 3.2.4 Payment, Refund và Compensation Messages

## SRS baseline Payment events

| Event v1 | Routing key | Required payload |
|---|---|---|
| `PaymentSucceeded` | `payment.payment.succeeded.v1` | `paymentId`, `bookingId`, `organizationId`, `amount`, `currency`, `provider`, `providerTransactionId`, `succeededAt` |
| `PaymentFailed` | `payment.payment.failed.v1` | `paymentId`, `bookingId`, `organizationId`, `reasonCode`, `failedAt`, `retryable:false` |
| `RefundSucceeded` | `payment.refund.succeeded.v1` | `refundId`, `refundReference`, `paymentId`, `bookingId`, `organizationId`, `amount`, `currency`, `providerReference`, `succeededAt` |

Provider transaction/reference được access-control; không chứa PAN/CVV. `PaymentFailed` chỉ phát cho outcome cuối, không phát khi timeout/chưa chắc chắn.

## Design event

| Event v1 | Routing key | Required payload |
|---|---|---|
| `RefundFailed` | `payment.refund.failed.v1` | `refundId`, `refundReference`, `paymentId`, `bookingId`, `organizationId`, `reasonCode`, `retryable`, `failedAt` |

`RefundFailed.retryable=true` không tự trigger retry vô hạn; policy/worker hoặc operator quyết định retry cùng logical Refund và ghi audit.

## Compensation command

| Command v1 | Routing key | Exchange | Required payload |
|---|---|---|---|
| `PaymentCompensationRequested` | `booking.payment.compensation-requested.v1` | `platform.commands` | `compensationReference`, `paymentId`, `bookingId`, `organizationId`, `amount`, `currency`, `reasonCode`, `requestedAt` |

Reason baseline: `LATE_PAYMENT_SEAT_LOST`, `TICKET_ISSUANCE_FAILED_AFTER_PAYMENT`, `TICKET_CHANGE_FAILED_AFTER_ADDITIONAL_PAYMENT`.

Payment consumer:

1. Inbox dedupe command ID.
2. Lookup logical compensation/refund reference.
3. Kiểm tra Payment `SUCCEEDED`, amount/currency và remaining refundable amount.
4. Persist Refund `REQUESTED` hoặc existing result, cùng Outbox nếu có.
5. ACK sau commit; provider call chạy theo workflow có trạng thái.

## PaymentSucceeded example

```json
{
  "eventId": "01J...",
  "eventType": "PaymentSucceeded",
  "version": 1,
  "occurredAt": "2026-09-04T08:30:00Z",
  "producer": "payment-service",
  "correlationId": "corr-1",
  "causationId": "webhook-event-1",
  "aggregateId": "payment-1",
  "aggregateVersion": 4,
  "tenantId": "org-1",
  "payload": {
    "paymentId": "payment-1",
    "bookingId": "booking-1",
    "organizationId": "org-1",
    "amount": 300000,
    "currency": "VND",
    "provider": "CONFIGURED_PROVIDER",
    "providerTransactionId": "provider-txn-1",
    "succeededAt": "2026-09-04T08:29:59Z"
  }
}
```

