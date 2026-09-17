# 2.1.4 Microservices Architecture

## 1. Service boundaries

Ranh giới service bám theo business capability, không bám theo bảng dữ liệu hay màn hình. Mỗi service phải có thể build, test, migrate và deploy độc lập; thay đổi nội bộ không buộc consumer rebuild nếu contract không đổi.

| Service | Public/synchronous contract | Message contract chính | Scale driver |
|---|---|---|---|
| Identity | `/auth/**`, `/users/**`, admin user/role/organization membership | Phát `UserRegistered`, user/role lifecycle event khi cần | Login burst, token refresh |
| Transport | `/trips/**`, `/routes/**`, `/operator/**`, Organization profile, driver assignment | Phát `TripPublished`, `TripUpdated`, `TripCancelled` | Search/read traffic, operator batch |
| Booking | `/seat-holds/**`, `/bookings/**`, `/tickets/**`, operator manifest/admin booking lookup | Nhận Trip/Payment event; phát Booking/Ticket/Refund request | Seat contention, booking checkout |
| Payment | `/payments/**`, `/refunds/**`, payment webhook | Nhận refund/compensation command; phát payment/refund event | Provider webhook và reconciliation |
| Notification | Notification read API; in-app/email delivery | Nhận notification command hoặc domain event | Provider throughput, retry backlog |
| Reporting | `/reports/**` | Nhận integration event để dựng projection | Query workload |

## 2. Data ownership

- Identity là nguồn sự thật cho user/role/membership; service khác chỉ lưu immutable identifier và snapshot tối thiểu.
- Transport là nguồn sự thật cho Organization profile, tài sản vận tải và lịch chuyến.
- Booking là nguồn sự thật cho inventory theo chuyến, hold, booking và ticket. SupportCase là thiết kế P1.
- Payment là nguồn sự thật cho trạng thái giao dịch với payment provider.
- Notification sở hữu delivery lifecycle; trạng thái gửi không thay đổi trạng thái Booking.
- Reporting sở hữu projection có thể rebuild; không sửa transaction nguồn.

Không có foreign key, view, trigger hoặc ORM relation xuyên database service.

## 3. Coupling rules

| Rule | Cách áp dụng |
|---|---|
| Không chain đồng bộ dài | Public request không đi qua chuỗi dài hơn ba service; ưu tiên local snapshot/read model |
| Contract-first | REST có OpenAPI; message có JSON Schema/AsyncAPI-compatible schema và version |
| Consumer tolerant | Bỏ qua field không biết; producer chỉ thêm optional field trong cùng version |
| Timeout bắt buộc | Mọi HTTP client cấu hình connect/read/overall timeout theo use case |
| Idempotency | HTTP command tạo side effect dùng `Idempotency-Key`; event dùng `eventId`, async command dùng `commandId` |
| Failure isolation | Notification/Reporting không nằm trong transaction của Booking/Payment |
| Deploy independence | Không release đồng thời bắt buộc chỉ vì import shared business model |

## 4. Transaction boundaries

Mỗi command chỉ có một local transaction owner. Nếu một use case cần thay đổi nhiều service:

1. Service hiện tại commit aggregate và outbox.
2. Outbox publisher phát message đến RabbitMQ.
3. Consumer dedupe, thực thi local transaction và ghi outbox tiếp theo nếu cần.
4. Khi bước sau thất bại không thể retry, service phát failure/compensation message.

Không giữ database transaction trong lúc gọi HTTP provider hoặc chờ message.

## 5. Saga chính

### Payment confirmation saga

```text
PaymentSucceeded (PREPAID)
  → Booking kiểm tra booking/hold
  → [valid] Booking=PAID, TripSeat=BOOKED, Ticket=ISSUED
      → BookingPaid + TicketIssued
      → Payment chốt settlement: commission 10% snapshot + operator payable 90%
  → [invalid/seat unavailable] PaymentCompensationRequested
      → Payment refund hoặc tạo reconciliation case

PAY_LATER booking created
  → Booking=CONFIRMED, TripSeat=BOOKED, Ticket=ISSUED (cùng transaction)
  → Payment tạo settlement UNCOLLECTED, commission = 0 (không Payment cổng)
```

### Cancellation/refund saga

```text
Booking/Ticket cancelled
  → [PREPAID đã thu và refundable > 0] RefundRequested
      → Payment gọi provider
      → RefundSucceeded | RefundFailed
      → Đảo commission/payable tương ứng
  → [PAY_LATER hoặc refundable = 0] chỉ hủy vé/chỗ, không Refund cổng
  → Notification + Reporting cập nhật bất đồng bộ
```

## 6. Service autonomy checklist

Một service chỉ đạt baseline khi:

- Có repository, migration và credential database riêng.
- Có OpenAPI và message schema thuộc quyền quản lý của service.
- Có health/liveness/readiness, metric và structured log.
- Consumer có inbox/dedupe; producer event quan trọng có outbox.
- Có test contract và test migration backward/forward phù hợp.
- Có thể deploy mà không yêu cầu stop toàn hệ thống.
- Runbook mô tả retry, DLQ và recovery của service.

## 7. Khi nào chưa tách thêm service

Khi P1 được kích hoạt, Promotion/Review/SupportCase thuộc Booking và ExportJob thuộc Reporting theo ADR hiện tại. Chỉ tách khi xuất hiện ít nhất một động lực rõ: owner riêng, compliance boundary, scale profile khác biệt, release cadence độc lập hoặc blast radius cần cô lập.
