# Tiêu chí chấp nhận và truy vết yêu cầu

## 1. Acceptance criteria P0

### AC-AUTH-001 — Đăng ký duy nhất

**Given** email đã thuộc tài khoản, **when** Guest đăng ký lại bằng email đó, **then** hệ thống không tạo User thứ hai và trả lỗi an toàn.

### AC-AUTH-002 — Tenant authorization

**Given** Operator Staff thuộc Organization A, **when** gọi API xem/sửa Trip của Organization B, **then** API trả 403/404 theo policy, không trả dữ liệu B và ghi security context phù hợp.

### AC-SEAT-001 — Không double hold

**Given** TripSeat A1 đang `AVAILABLE`, **when** hai Customer giữ A1 đồng thời, **then** đúng một request thành công và request còn lại nhận `SEAT_UNAVAILABLE`.

### AC-SEAT-002 — Giữ tất cả hoặc không giữ ghế nào

**Given** A1 available và A2 đã held, **when** Customer yêu cầu giữ A1+A2, **then** request thất bại toàn bộ và A1 vẫn available.

### AC-SEAT-003 — Hết hạn hold

**Given** SeatHold đã quá `expiresAt`, **when** Customer tạo Booking từ hold, **then** hệ thống trả `SEAT_HOLD_EXPIRED`, không tạo Booking và giải phóng ghế hợp lệ.

### AC-BOOK-001 — Tính tiền phía server

**Given** client sửa total nhỏ hơn giá snapshot, **when** tạo Booking, **then** server bỏ qua total client, tính lại chính xác và trả total chính thức.

### AC-BOOK-002 — Idempotent booking

**Given** cùng `Idempotency-Key` và payload, **when** create Booking được gửi hai lần, **then** chỉ một Booking tồn tại và hai response tham chiếu cùng ID.

### AC-PAY-001 — Webhook hợp lệ

**Given** Booking còn hiệu lực và webhook có chữ ký/amount/currency hợp lệ, **when** Payment Service xử lý, **then** Payment thành `SUCCEEDED`, Booking thành `PAID`, ghế thành `BOOKED` và mỗi item có một Ticket.

### AC-PAY-002 — Webhook lặp

**Given** provider gửi cùng webhook ba lần, **when** hệ thống xử lý, **then** chỉ một logical payment success và một tập ticket được tạo.

### AC-PAY-003 — Webhook sai số tiền

**Given** webhook amount khác payment intent, **when** hệ thống xác minh, **then** Booking không thành `PAID`, không tạo Ticket và một reconciliation/security record được tạo.

### AC-PAY-004 — Callback trễ

**Given** payment thành công sau khi hold hết hạn và ghế đã bán cho Booking khác, **when** Booking Service nhận event, **then** không double-book và compensation refund/manual case được tạo.

### AC-CANCEL-001 — Preview hủy

**Given** Ticket đủ điều kiện hủy, **when** Customer yêu cầu preview, **then** response hiển thị policy version, fee và refund amount trước khi xác nhận.

### AC-CANCEL-002 — Hủy lặp

**Given** cancellation đã tạo Refund, **when** cùng command được gửi lại với cùng idempotency key, **then** không tạo refund thứ hai.

### AC-TICKET-001 — Check-in hợp lệ

**Given** Driver được phân công và Ticket `ISSUED` thuộc đúng Trip, **when** scan QR, **then** Ticket thành `CHECKED_IN` và audit ghi actor/time/trip.

### AC-TICKET-002 — Check-in sai chuyến

**Given** Ticket thuộc Trip A, **when** Driver scan trong Trip B, **then** hệ thống từ chối và không thay đổi Ticket.

### AC-TRIP-001 — Xung đột lịch

**Given** Bus hoặc Driver đã được phân công trong khoảng thời gian chồng lấn, **when** Operator publish Trip mới, **then** publish bị từ chối với thông tin xung đột.

### AC-TRIP-002 — Hủy chuyến

**Given** Trip có Ticket đã bán, **when** Operator có quyền hủy, **then** Trip cancelled, các booking bị ảnh hưởng được xử lý, refund được yêu cầu và Customer nhận notification eventual.

### AC-NFR-001 — Tải đồng thời

**Given** dataset và tải tại NFR-PERF, **when** chạy load/concurrency test, **then** đạt latency baseline và không có duplicate Booking/Payment/Ticket hay double-booking.

### AC-OBS-001 — Truy vết

**Given** một booking thanh toán thành công, **when** tra cứu correlation ID, **then** có thể liên kết log/trace qua Gateway, Booking, Payment và Notification mà không lộ token/PII nhạy cảm.

## 2. Traceability matrix

### 2.1. Cấp mục tiêu

| Goal | Phạm vi yêu cầu chính | Bằng chứng nghiệm thu |
|---|---|---|
| GOAL-001 | FR-IAM, FR-SEARCH, FR-BOOK, FR-PAY, FR-TICKET, FR-OPS, FR-NOTIF, FR-ADMIN và FR-REPORT; toàn bộ Use Case MUST | Acceptance P0, integration test và end-to-end test cho các actor |
| GOAL-002 | FR-BOOK-002..010, FR-PAY-003..010, FR-TICKET-001..006; BR-SEAT, BR-BOOK, BR-PAY, BR-CANCEL, BR-TICKET và yêu cầu trạng thái | AC-SEAT, AC-BOOK, AC-PAY, AC-CANCEL, AC-TICKET, AC-TRIP và concurrency test |
| GOAL-003 | FR-IAM-005..009, FR-BOOK-011, FR-PAY-009, FR-OPS-001..010, FR-ADMIN-001..003; BR-TENANT, BR-DATA, NFR-SEC và yêu cầu privacy | AC-AUTH-001..002, authorization/negative test, security test và privacy review |
| GOAL-004 | UI-001..008; Web End-user, Mobile App, Back-office Web; API/event contract và contract compatibility | Contract test, integration test và end-to-end test trên cả ba client |
| GOAL-005 | UI-002, UI-004..007; accessibility, responsive, localization và NFR-UX | Accessibility test, responsive/browser test và usability acceptance cho luồng Customer cốt lõi |
| GOAL-006 | NFR-PERF, NFR-REL, NFR-SCALE và các kịch bản ngoại lệ/phục hồi | AC-NFR-001, load/concurrency test, retry/DLQ test và recovery test |
| GOAL-007 | FR-PAY-009..010, FR-ADMIN-002..003, FR-REPORT-001..003, BR-AUDIT và NFR-OBS | AC-OBS-001, report test, audit test và reconciliation test |

### 2.2. Cấp feature

| Feature | FR | Business rule | Use Case | API/Event | Acceptance |
|---|---|---|---|---|---|
| Đăng ký/đăng nhập | FR-IAM-001..007 | BR-DATA, AUTHZ | UC-AUTH-01/02 | `/auth/**`, UserRegistered | AC-AUTH-001 |
| Tenant/role | FR-IAM-008..009, FR-ADMIN-001 | BR-TENANT-001..002 | UC-ADMIN-01 | `/admin/users`, `/admin/organizations` | AC-AUTH-002 |
| Tìm chuyến | FR-SEARCH-001..006 | BR-TRIP-001 | UC-SEARCH-01 | `GET /trips` | NFR/API tests |
| Giữ ghế | FR-BOOK-001..003 | BR-SEAT-001..010 | UC-BOOK-01 | `POST /trips/{id}/seat-holds` | AC-SEAT-001..003 |
| Tạo booking | FR-BOOK-004..007 | BR-BOOK-001..010 | UC-BOOK-01 | `POST /bookings`, BookingCreated | AC-BOOK-001..002 |
| Thanh toán | FR-PAY-001..007 | BR-PAY-001..010 | UC-PAY-01 | `/payments`, PaymentSucceeded | AC-PAY-001..004 |
| Hủy/refund | FR-BOOK-009, FR-PAY-008 | BR-CANCEL, BR-PAY | UC-CANCEL-01 | `/cancel`, RefundRequested/Succeeded | AC-CANCEL-001..002 |
| Đổi vé | FR-BOOK-010 | BR-CANCEL-006..007 | UC-CHANGE-01 | `/tickets/{id}/change` | P1 test suite |
| Vé/check-in | FR-TICKET-001..006 | BR-TICKET-001..004 | UC-DRIVER-01 | `/tickets/**`, PassengerCheckedIn | AC-TICKET-001..002 |
| Publish Trip | FR-OPS-005..006 | BR-TRIP-001..002 | UC-OPS-01 | `/operator/trips/**`, TripPublished | AC-TRIP-001 |
| Hủy Trip | FR-OPS-008 | BR-TRIP-004..006 | UC-TRIP-01 | TripCancelled | AC-TRIP-002 |
| Notification | FR-NOTIF-001..003 | Retry rules | Các UC phát event | NotificationRequested | AC-TRIP-002, integration tests |
| Reporting | FR-REPORT-001..003 | Tenant scope | UC-REPORT-01 | `/reports/**` | Report tests |
| Hiệu năng/độ tin cậy | NFR-PERF/REL | Idempotency/outbox | UC-BOOK/PAY | REST + events | AC-NFR-001 |
| Observability | NFR-OBS | BR-AUDIT | Tất cả UC | Correlation/event envelope | AC-OBS-001 |

## 3. Definition of Done cho requirement MUST

Một requirement MUST chỉ hoàn thành khi:

1. Có implementation trong đúng service.
2. Có unit/integration test phù hợp.
3. Có OpenAPI/event schema nếu tạo hợp đồng.
4. Có authorization và negative test.
5. Có log/metric cần thiết nhưng không lộ dữ liệu nhạy cảm.
6. Traceability được cập nhật.
7. Acceptance test liên quan đạt trong CI hoặc môi trường nghiệm thu.
