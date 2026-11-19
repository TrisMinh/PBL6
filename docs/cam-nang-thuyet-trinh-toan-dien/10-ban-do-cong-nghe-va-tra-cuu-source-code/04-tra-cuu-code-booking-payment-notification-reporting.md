# Danh Bạ Giải Phẫu Thuần Mã Nguồn (Phần 3): Từng File & Từng Hàm Của `Booking`, `Payment`, `Notification` & `Reporting`

> **Mục tiêu tài liệu**: Bóc tách **100% các file `.cs`** còn lại trong 4 dịch vụ giao dịch, thanh toán, thông báo và báo cáo CQRS, đi thẳng vào **cấu trúc byte, công thức toán học, cơ chế khóa dòng/khóa tư vấn PostgreSQL và luồng sự kiện RabbitMQ**.

---

## PHẦN A — `BusTicketPlatform.Booking.*` (`workspace/src/services/booking/`)

### 1. Các File Thuật Toán & Mật Mã Lõi Ở `Booking.Application`

#### 1.1. `TicketLookupToken.cs` (41 dòng — Đóng gói Nhị phân `Span<byte>` & `stackalloc`)
- **Thư viện**: `System.Buffers.Binary.BinaryPrimitives`, `System.Security.Cryptography.HMACSHA256`, `CryptographicOperations`.
- **Cấu trúc mảng 56 bytes nhị phân (`PayloadLength = 24` + `MAC = 32`)**:
  - Bytes `[0..15]` (16 bytes): `bookingId.TryWriteBytes(data)` — ghi trực tiếp GUID không cấp phát mảng phụ.
  - Bytes `[16..23]` (8 bytes): `BinaryPrimitives.WriteInt64BigEndian(data.AsSpan(16), expiry.ToUnixTimeSeconds())` — thời điểm hết hạn (14 phút) dạng Big-Endian 64-bit.
  - Bytes `[24..55]` (32 bytes): `HMACSHA256.HashData(Key(secret), data.AsSpan(0, 24), data.AsSpan(24))` — ghi thẳng chữ ký vào nửa sau mảng `data`, với khóa con dẫn xuất bằng UTF-8 Literal zero-allocation: `HMACSHA256.HashData(UTF8(secret), "blue-ticket-lookup-v1"u8)`.
  - Chuỗi đầu ra: Base64Url dài cố định **đúng 75 ký tự** ($\lceil 56 \times 4 / 3 \rceil = 75$ sau khi cắt 1 dấu `=`).
- **Hàm giải mã `TryRead` (Zero Heap Allocation trên đường thất bại)**:
  - Kiểm tra nhanh `if (token.Length != 75) return false;`.
  - Cấp phát bộ đệm ngay trên ngăn xếp CPU: **`Span<byte> data = stackalloc byte[56];`**.
  - Giải mã Base64 trực tiếp vào `Span<byte>`, đối chiếu chữ ký hằng thời gian `FixedTimeEquals(expected, data[24..])` và kiểm tra hạn `ReadInt64BigEndian(data[16..]) > UtcNow`.

#### 1.2. `TicketQr.cs` (44 dòng — Ký Số Vé Điện Tử)
- Định dạng chuỗi QR: `BT1.<32-hex-ticketId>.<64-hex-HMACSHA256>`.
- Hàm `TryVerify`: Tách chuỗi tối đa 3 phần `.Split('.', 3)`, kiểm tra `Guid.TryParseExact(parts[1], "N", out ticketId)`, tính lại `HMACSHA256` và đối chiếu bằng `CryptographicOperations.FixedTimeEquals`.

#### 1.3. `Contracts.cs` (Chứa thuật toán `CancellationPolicy`)
- Hàm bậc thang `CancellationPolicy.For(DateTimeOffset departureAt, DateTimeOffset now)`:
  - Tính `hours = (departureAt - now).TotalHours`.
  - `hours >= 24` $\rightarrow$ `(0.10m, true)` (phí 10%); `hours >= 6` $\rightarrow$ `(0.20m, true)` (phí 20%); `hours >= 2` $\rightarrow$ `(0.30m, true)` (phí 30%); `< 2` $\rightarrow$ `(0m, false)` (cấm tự hủy).
- Hàm làm tròn tiền Việt: `HalfUp(decimal amount) => (long)decimal.Round(amount, 0, MidpointRounding.AwayFromZero)`.

#### 1.4. `BookingService.cs` (796 dòng — Điều phối Đặt Vé, Coupon & Check-in)
- **`CouponDiscount(coupon, subtotal)`**: `Math.Min(coupon.Cap, (long)decimal.Floor((decimal)subtotal * coupon.Percent / 100))`.
- **Thuật toán Chia Tiền Giảm Giá Lũy Kế Không Lệch Đồng Lẻ (dòng 313–320)**:
  ```csharp
  long runningSubtotal = 0, allocatedDiscount = 0;
  for (var index = 0; discount > 0 && index < items.Count; index++)
  {
      runningSubtotal += items[index].UnitPrice;
      var cumulativeDiscount = (long)decimal.Floor((decimal)runningSubtotal * discount / hold.TotalAmount);
      items[index] = items[index] with { Discount = cumulativeDiscount - allocatedDiscount };
      allocatedDiscount = cumulativeDiscount;
  }
  ```
  *(Đảm bảo ở phần tử cuối `index = n - 1`, `runningSubtotal == hold.TotalAmount` nên `cumulativeDiscount == discount`, tổng chiết khấu của $n$ vé khớp **chính xác 100%** với `discount` tổng đơn!).*
- **`ApplyPaymentSucceededAsync` (dòng 481–504 — Saga Compensation Tầng 2)**: Nếu `store.ApplyPaidAsync` trả về `false` (do đơn vừa hết hạn hoặc mất ghế trong lúc tin nhắn đang bay trên RabbitMQ) và trạng thái hiện tại khác `PAID`, tự động phát ngược sự kiện bù trừ `events.RefundRequestedAsync(..., "PAYMENT_AFTER_BOOKING_CLOSED")` sang `Payment Service`.
- **`ResolveScannedAsync` (dòng 750–766 — Giải mã Đa định dạng khi Tài xế quét vé)**: Thử lần lượt 4 cách: (1) Xác thực chữ ký `TicketQr.TryVerify` $\rightarrow$ (2) Tra `SHA256(raw)` trên `qr_token_hash` $\rightarrow$ (3) Tra mã vé in trên giấy `public_code` (`TK...`) $\rightarrow$ (4) Parse thẳng `Guid`.

---

### 2. Tầng `Booking.Infrastructure` (`BookingRepository.cs` — 1.009 dòng & `CouponRepository.cs`)

| Phương Thức Trong `BookingRepository.cs` | Kỹ Thuật Khóa PostgreSQL & Câu Lệnh SQL Cốt Lõi |
|---|---|
| `ImportTripAsync` (dòng 10) | `INSERT INTO trip_snapshots ... ON CONFLICT (trip_id) DO UPDATE SET source_trip_version = GREATEST(...)` + lặp chèn ghế vào `trip_seats` với `ON CONFLICT (trip_id, source_seat_id_external) DO NOTHING` trong 1 Transaction. |
| `ApplyTripStatusAsync` (dòng 75) | Khi chuyến chuyển sang trạng thái đóng bán hoặc `CANCELLED`: dùng CTE giải phóng toàn bộ `seat_holds` đang `ACTIVE`; nếu `CANCELLED` thì hủy toàn bộ `tickets`, trả ghế về `AVAILABLE`, và chuyển các đơn `PREPAID` đã `PAID` sang `REFUND_PENDING` với **`cancellation_fee = 0, refund_amount = total_amount`** (hoàn 100%). |
| `ExpireHoldsAsync` (dòng 159) | **Lazy Atomic Expiration**: Chạy 2 khối `WITH expired_bookings AS (UPDATE bookings SET status = 'EXPIRED' WHERE status = 'PENDING_PAYMENT' AND expires_at <= NOW() RETURNING id) UPDATE trip_seats ...` và tương tự cho `seat_holds` $\rightarrow$ thu hồi ghế quá hạn 10 phút ngay tức khắc không độ trễ. |
| `CreateHoldAsync` (dòng 254) | **Pessimistic All-or-Nothing Lock**: `SELECT id, price FROM trip_seats WHERE trip_id = @trip AND id = ANY(@ids) AND status = 'AVAILABLE' FOR UPDATE;`. Nếu `prices.Count != seatIds.Count` lập tức `RollbackAsync` và trả `null` (`409 SEAT_UNAVAILABLE`). |
| `ReplaceHoldAsync` (dòng 326) | **Deadlock-Free Total Lock Ordering**: Khóa `seat_holds FOR UPDATE`, sau đó khóa gộp cả ghế cũ lẫn ghế mới theo thứ tự tăng dần khóa chính: `SELECT id, price, status, active_hold_id FROM trip_seats WHERE trip_id = @trip AND (id = ANY(@ids) OR active_hold_id = @hold) ORDER BY id FOR UPDATE`. |
| `CreateBookingAsync` (dòng 411) | 1. Nếu có Coupon: khóa chia sẻ **`SELECT 1 FROM coupons WHERE code=@coupon ... FOR SHARE`** (chặn Admin đổi phần trăm giảm giá giữa chừng).<br>2. Chạy **`SET CONSTRAINTS ALL DEFERRED;`** để hoãn kiểm tra khóa ngoại hai chiều `fk_trip_seats_active_hold` & `fk_trip_seats_active_booking_item` đến lúc `CommitAsync`.<br>3. Tiêu thụ `seat_holds` (`WHERE id = @id AND status = 'ACTIVE'`, nếu `!= 1` dòng thì Rollback), chèn `bookings`, `booking_items`, `passengers`, chuyển `trip_seats` sang `BOOKED`. Bắt `SqlState is "23505" or "23514" or "23503"` để Rollback an toàn. |
| `ApplyPaidAsync` (dòng 559) | **100% Atomic Transactional Outbox**: Trong **cùng 1 `NpgsqlTransaction`**, kiểm tra đơn chưa hết hạn và ghế vẫn thuộc đơn $\rightarrow$ cập nhật `bookings` sang `PAID` $\rightarrow$ sinh các dòng `tickets` (`NOT EXISTS` chống sinh trùng) $\rightarrow$ chèn trực tiếp 2 sự kiện `BookingPaid` và `TicketIssued` vào bảng `outbox_messages` bằng `jsonb_build_object(...)`! |

### 3. Tầng `Booking.Api` (`Program.cs` & `BookingEndpoints.cs`)
- `Program.cs` đăng ký bộ giới hạn tốc độ `AddFixedWindowLimiter("ticket-lookup", PermitLimit = 40, Window = 1 minute)` gắn vào endpoint tra cứu vé khách vãng lai `POST /api/v1/tickets/lookup` chống vét cạn mã đặt chỗ.

---

## PHẦN B — `BusTicketPlatform.Payment.*` (`workspace/src/services/payment/`)

### 1. Các File Thuật Toán Ký Số & Phân Tích Cổng Thanh Toán (`Payment.Application`)
| File `.cs` | Hàm Chính | Thuật Toán Chuẩn Hóa & Xác Thực Mật Mã |
|---|---|---|
| `SePayCheckout.cs` | `Sign`, `BuildAction`, `TryReadLocalReturn`, `Authenticate` | - **`Sign`**: Duyệt mảng thứ tự cứng 11 trường `SignedFields` (`order_amount, merchant, currency, ...`), bỏ qua trường rỗng hoặc `"0"`, nối chuỗi `key=value` phân cách bằng dấu phẩy `,`, ký `HMACSHA256` mã hóa Base64.<br>- **Cầu nối Localhost (`BuildAction` & `TryReadLocalReturn`)**: Khi chạy Sandbox từ `localhost`, đóng gói `LocalReturnState(BookingId, Origin, Expiry)` thành JSON UTF-8 Base64Url, ký `HMACSHA256` với tiền tố miền `"BLUE_SEPAY_LOCAL_RETURN:"` và kiểm tra chặt `uri.IsLoopback` chống Open Redirect.<br>- **`Authenticate(configured, supplied)`**: Băm kép cả 2 chuỗi qua `SHA256.HashData` (đưa về cùng độ dài 32 bytes để không lộ chiều dài khóa bí mật!) rồi mới gọi `CryptographicOperations.FixedTimeEquals`. |
| `SePayIpn.cs` | `Parse(JsonElement body)` | Phân tích cây JSON `order` & `transaction` không cần tạo class trung gian: ép kiểu `decimal` bất biến văn hóa (`InvariantCulture`), kiểm tra số nguyên dương (`amount == decimal.Truncate(amount)`), khớp `order_amount == transaction_amount`, `VND`, và với `ORDER_PAID` bắt buộc thỏa đồng thời 3 cờ `CAPTURED` + `APPROVED` + `PAYMENT`. |
| `VnPayCheckout.cs` | `BuildCheckoutUrl`, `Sign`, `Verify` | Nhân `amountVnd * 100` theo chuẩn VNPay, chuyển giờ sang `Asia/Ho_Chi_Minh`, sắp xếp khóa tăng dần theo mã ASCII bằng **`OrderBy(pair => pair.Key, StringComparer.Ordinal)`**, mã hóa `WebUtility.UrlEncode`, nối bằng `&` và ký **`HMACSHA512`** dạng chuỗi Hex thường; kiểm chứng bằng `FixedTimeEquals`. |
| `PaymentService.cs` | `CreateAsync`, `HandleWebhookAsync`, `CreateRefundAsync`, `ApplyRefundRequestedAsync` | Khi tạo thanh toán mới (`CreateAsync`), gọi vòng lặp bất đồng bộ ngắn `WaitForQuoteAsync` chờ sự kiện `BookingCreated` đồng bộ sang bảng `booking_quotes`, lấy đúng số tiền Server đã chốt mà không cần gọi HTTP sang `Booking Service`. |

---

### 2. Tầng `Payment.Infrastructure` (`SePayPaymentStore.cs` & `PaymentRepository.cs`)
- **`SePayPaymentStore.ApplySePayAsync` (167 dòng — Giao dịch 4-trong-1 với 3 Lớp Khóa)**:
  1. `SELECT pg_advisory_xact_lock(hashtext(@txn))` $\rightarrow$ Khóa tư vấn trên RAM của Postgres theo mã giao dịch ngân hàng.
  2. `SELECT ... FROM payments WHERE logical_reference = @ref FOR UPDATE` $\rightarrow$ Khóa dòng hóa đơn.
  3. `SELECT pg_advisory_xact_lock(hashtext(@booking))` $\rightarrow$ Khóa tư vấn theo mã đơn đặt chỗ (đồng bộ với `InsertPaymentAsync`).
  4. Kiểm tra chống dùng 1 `provider_transaction_id` thanh toán cho 2 `payment_id` khác nhau, sau đó khử trùng lặp qua `INSERT INTO webhook_receipts ... ON CONFLICT (provider, external_event_id) DO NOTHING`.
  5. Tính biến boolean `late = alreadyCaptured || payment.ExpiresAt <= UtcNow || payment.Status is "CANCELLED" or "FAILED"`:
     - Nếu `!late`: Cập nhật `payments = 'SUCCEEDED'`, chèn bút toán hoa hồng sàn vào `booking_settlements` (`ROUND(p.amount * q.commission_rate)`), và chèn trực tiếp sự kiện `PaymentSucceeded` vào `outbox_messages` — **tất cả Commit trong 1 Transaction duy nhất**!
     - Nếu `late`: Chuyển `payments = 'REFUND_PENDING'` và gọi `QueueRefund(..., "LATE_PROVIDER_SUCCESS")` (sử dụng CTE kiểm tra trần `amount <= payment.amount - SUM(refunds)` ngay trong câu lệnh `INSERT`).
     - Nếu nhận `TRANSACTION_VOID` sau khi đã thu tiền hoặc thu tiền lần 2: mở hồ sơ cảnh báo mức `HIGH` vào bảng `reconciliation_cases` mà không tự ý hủy vé đã cấp!
- **`PaymentRepository.TryApplyRefundAsync` (dòng 197–280)**: Khóa `payments FOR UPDATE`, tính tổng tiền đã hoàn `SUM(amount)`, kiểm tra không vượt gốc, chèn `refunds`, tính phần tiền giữ lại `remaining = payment.Amount - refunded - refund.Amount`, tính lại hoa hồng sàn trên `remaining` và cập nhật ngược vào `booking_settlements`.

---

## PHẦN C — `Notification` (`Port 5085`) & `Reporting` (`Port 5086`)

### 1. `BusTicketPlatform.Notification.*` (`workspace/src/services/notification/`)
- **`NotificationEventHandlers.cs`**: Lắng nghe hàng đợi `notification.integration-events.q` (6 routing keys), dò tìm GUID người nhận qua `TryUserId` (`payload.userId` hoặc `payload.customerId`) rồi gọi `NotificationService.IngestAsync`.
- **`NotificationRepository.cs`**:
  - Chống trùng thông báo ở tầng DB: `INSERT INTO notifications ... ON CONFLICT (source_message_id, user_id_external) DO NOTHING`.
  - **Thuật toán Phân trang Con trỏ `Keyset Cursor Pagination` ($O(\log N)$)**: Thay vì dùng `OFFSET` chậm dần theo số trang, câu lệnh dùng `WHERE user_id_external = @user AND (@cursor::timestamptz IS NULL OR created_at < @cursor) ORDER BY created_at DESC, id DESC LIMIT @limit`, tận dụng trực tiếp chỉ mục phức hợp `ix_notifications_user_cursor`.
- **`CustomerRequests.cs`**: Giới hạn tốc độ `30 req/phút` (`AddFixedWindowLimiter("customer-requests")`), kiểm tra biểu thức chính quy số điện thoại Việt Nam `^(?:\+84|0)[0-9]{9}$`, sinh mã tham chiếu `"BLUE-SUP-"` / `"BLUE-NX-"` và lưu JSONB vào bảng `customer_requests`.

---

### 2. `BusTicketPlatform.Reporting.*` (`workspace/src/services/reporting/`)
- **`ReportingEventHandlers.cs`**: Lắng nghe `reporting.integration-events.q` với 3 wildcard routing keys `booking.booking.*.v1`, `payment.payment.*.v1`, `payment.refund.*.v1`.
- **`ReportingRepository.cs` — Hai câu lệnh SQL CQRS đắt giá nhất**:
  1. **`UpsertBookingAsync` (Hội tụ bất biến thứ tự sự kiện với `GREATEST`)**:
     - Câu lệnh 1: `INSERT INTO booking_projections ... ON CONFLICT (booking_id) DO UPDATE` dùng **`GREATEST(booking_projections.cancellation_fee, EXCLUDED.cancellation_fee)`** và **`GREATEST(booking_projections.refunded_amount, EXCLUDED.refunded_amount)`** cùng biểu thức bảo vệ `status` — tạo thành cấu trúc nửa dàn đơn điệu (*Monotonic Join-Semilattice*) để sự kiện cũ đến trễ không bao giờ ghi đè làm tụt số tiền đã hoàn!
     - Câu lệnh 2: Rollup tổng hợp lại toàn bộ doanh thu trong ngày `(booked_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date` của nhà xe đó và `INSERT ... ON CONFLICT (organization_id_external, period_date, currency) DO UPDATE` vào bảng `revenue_projections`.
  2. **`ApplyRefundAsync` (CTE Khóa & Cộng dồn Hoàn tiền Có Trần)**:
     - Dùng 1 chuỗi CTE nguyên tử: `WITH current AS (SELECT ... FROM booking_projections WHERE booking_id = @booking FOR UPDATE), changed AS (UPDATE booking_projections b SET refunded_amount = LEAST(b.gross_amount, current.old_refunded + @amount) ... RETURNING LEAST(@amount, b.gross_amount - current.old_refunded) AS applied, ...) UPDATE revenue_projections ... SET refund_amount = refund_amount + changed.applied, net_revenue = net_revenue - changed.applied`.
