# Yêu cầu về trạng thái nghiệp vụ

Tên trạng thái trong tài liệu, API, database và event phải dùng đúng danh mục này.

## 1. TripSeat

```text
AVAILABLE → HELD → BOOKED
    ↑          ↓
    └──────────┘  (release/expiry)

AVAILABLE ↔ DISABLED
```

| Từ | Đến | Điều kiện |
|---|---|---|
| AVAILABLE | HELD | SeatHold được tạo thành công cho toàn bộ ghế đã chọn trong cùng giao dịch |
| HELD | AVAILABLE | Hold hết hạn/release và Trip còn bán |
| HELD | BOOKED | Payment thành công, booking/hold còn hợp lệ |
| AVAILABLE | DISABLED | Operator vô hiệu ghế trước khi bị giữ/bán |
| DISABLED | AVAILABLE | Operator kích hoạt lại khi Trip còn cho phép |

Không cho phép `BOOKED → AVAILABLE` nếu Ticket chưa được hủy hợp lệ.

## 2. SeatHold

```text
ACTIVE → CONSUMED
   ├──→ EXPIRED
   └──→ RELEASED
```

| Trạng thái | Ý nghĩa |
|---|---|
| ACTIVE | Ghế đang được giữ đến `expiresAt` |
| CONSUMED | Đã dùng để tạo Booking |
| EXPIRED | Hết thời gian |
| RELEASED | Customer/system chủ động giải phóng |

## 3. Booking

```text
PENDING_PAYMENT → PAID → COMPLETED
       ├──→ EXPIRED
       └──→ CANCELLED

PAID → CANCELLED → REFUND_PENDING → REFUNDED
```

| Từ | Đến | Trigger |
|---|---|---|
| PENDING_PAYMENT | PAID | `PaymentSucceeded` hợp lệ; booking, ghế và ticket được cập nhật nhất quán trong cùng giao dịch |
| PENDING_PAYMENT | EXPIRED | Quá `expiresAt` chưa thanh toán |
| PENDING_PAYMENT | CANCELLED | Customer/system hủy trước payment |
| PAID | COMPLETED | Trip hoàn thành và nghĩa vụ vé kết thúc |
| PAID | CANCELLED | Hủy hợp lệ hoặc Trip cancelled |
| CANCELLED | REFUND_PENDING | Có khoản tiền cần hoàn |
| REFUND_PENDING | REFUNDED | Tổng refund cần thiết thành công |

Booking có thể gồm nhiều Ticket. Khi hỗ trợ hủy từng vé, Booking tổng hợp trạng thái từ item; trạng thái chi tiết của Ticket/Refund là nguồn quyết định.

## 4. Payment

```text
PENDING → PROCESSING → SUCCEEDED
   │           ├──→ FAILED
   │           └──→ CANCELLED
   └───────────→ CANCELLED

SUCCEEDED → REFUND_PENDING → PARTIALLY_REFUNDED → REFUNDED
                       └────────────────────────→ REFUNDED
```

| Trạng thái | Ý nghĩa |
|---|---|
| PENDING | Payment record đã tạo, chưa gửi/nhận provider |
| PROCESSING | Provider đang xử lý hoặc chờ webhook |
| SUCCEEDED | Payment đã xác minh thành công |
| FAILED | Kết quả cuối thất bại |
| CANCELLED | Customer/provider hủy trước thành công |
| REFUND_PENDING | Có refund đang xử lý |
| PARTIALLY_REFUNDED | Đã hoàn một phần |
| REFUNDED | Đã hoàn toàn bộ amount hợp lệ |

Không đổi `SUCCEEDED → FAILED` do callback đến sau; tạo reconciliation case nếu provider báo mâu thuẫn.

## 5. Ticket

```text
ISSUED → CHECKED_IN → USED
   └──────→ CANCELLED → REFUNDED
```

| Từ | Đến | Điều kiện |
|---|---|---|
| ISSUED | CHECKED_IN | QR/mã hợp lệ, đúng chuyến, actor có quyền |
| CHECKED_IN | USED | Trip hoàn thành |
| ISSUED | CANCELLED | Hủy hợp lệ hoặc Trip cancelled |
| CANCELLED | REFUNDED | Khoản hoàn liên quan thành công |

## 6. Refund

```text
REQUESTED → PROCESSING → SUCCEEDED
                    └──→ FAILED → PROCESSING
```

Retry `FAILED → PROCESSING` chỉ được thực hiện idempotent và có giới hạn/manual action.

## 7. Trip

```text
SCHEDULED → BOARDING → DEPARTED → IN_TRANSIT → ARRIVED → COMPLETED
     └──────────────→ CANCELLED
          BOARDING ─→ CANCELLED
```

| Từ | Đến | Actor |
|---|---|---|
| SCHEDULED | BOARDING | Operator Operations/Driver được phân công |
| BOARDING | DEPARTED | Driver/Operator |
| DEPARTED | IN_TRANSIT | Driver/Operator |
| IN_TRANSIT | ARRIVED | Driver/Operator |
| ARRIVED | COMPLETED | Driver/Operator hoặc job được cấu hình |
| SCHEDULED/BOARDING | CANCELLED | Operator có quyền/Admin |

Hủy sau `DEPARTED` là trường hợp vận hành đặc biệt, cần quyền cao hơn và audit; không dùng luồng chuyển trạng thái thông thường.
