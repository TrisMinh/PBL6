# 6. Yêu cầu trạng thái nghiệp vụ

[← Chương 5](./05-yeu-cau-chuc-nang.md) · [Mục lục](./README.md) · [Chương 7 →](./07-giao-dien-va-tich-hop.md)

Tên trạng thái trong yêu cầu, API, dữ liệu, event và giao diện phải thống nhất với chương này. Mọi chuyển trạng thái không được liệt kê hoặc không thỏa điều kiện phải bị từ chối.

## 6.1. TripSeat

[Mở State Diagram TripSeat](../system-design/02-05-state-machine-diagrams/01-trip-seat.md) · [SeatHold](../system-design/02-05-state-machine-diagrams/02-seat-hold.md)

| Từ | Đến | Điều kiện |
|---|---|---|
| AVAILABLE | HELD | SeatHold được tạo thành công cho toàn bộ ghế trong cùng yêu cầu. |
| HELD | AVAILABLE | Hold hết hạn/release và Trip còn cho phép bán. |
| HELD | BOOKED | Payment/Booking được xác nhận hợp lệ trong khi ghế vẫn thuộc hold/Booking đó. |
| AVAILABLE | DISABLED | Operator vô hiệu ghế trước khi ghế bị giữ hoặc bán. |
| DISABLED | AVAILABLE | Operator kích hoạt lại khi Trip còn cho phép. |
| BOOKED | AVAILABLE | Chỉ sau khi Ticket bị hủy hợp lệ và Trip còn cho phép bán lại. |

Ràng buộc:

- `SELECTED` chỉ là trạng thái UI, không phải TripSeat state.
- Một TripSeat không đồng thời thuộc hai SeatHold ACTIVE hoặc hai Ticket còn hiệu lực.
- Ghế BOOKED không được tự chuyển AVAILABLE chỉ do cache/hold hết TTL.

## 6.2. SeatHold

| Trạng thái | Ý nghĩa | Trạng thái đích hợp lệ |
|---|---|---|
| ACTIVE | Ghế đang được giữ đến `expiresAt`. | CONSUMED, EXPIRED, RELEASED |
| CONSUMED | Hold đã được dùng để tạo Booking. | Trạng thái cuối |
| EXPIRED | Hold quá hạn và không còn quyền giữ ghế. | Trạng thái cuối |
| RELEASED | Customer/hệ thống chủ động giải phóng. | Trạng thái cuối |

Ràng buộc:

- ACTIVE chỉ được consume một lần.
- EXPIRED/RELEASED phải giải phóng TripSeat hợp lệ.
- Request release lặp là idempotent.

## 6.3. Booking

[Mở State Diagram Booking](../system-design/02-05-state-machine-diagrams/03-booking.md) · [Payment](../system-design/02-05-state-machine-diagrams/04-payment.md)

| Từ | Đến | Trigger/điều kiện |
|---|---|---|
| PENDING_PAYMENT | PAID | Payment thành công đã xác minh; Booking, ghế và Ticket được cập nhật nhất quán. |
| PENDING_PAYMENT | EXPIRED | Quá thời hạn chưa có Payment hợp lệ. |
| PENDING_PAYMENT | CANCELLED | Customer/hệ thống hủy trước khi thanh toán. |
| PAID | COMPLETED | Trip hoàn thành và nghĩa vụ Ticket kết thúc theo policy. |
| PAID | CANCELLED | Hủy hợp lệ hoặc Trip bị hủy. |
| CANCELLED | REFUND_PENDING | Có khoản đã thanh toán cần hoàn. |
| REFUND_PENDING | REFUNDED | Tổng khoản Refund cần thiết đã thành công. |

Ràng buộc:

- Booking có thể chứa nhiều Ticket; khi hủy từng Ticket, trạng thái item và Refund là nguồn chi tiết.
- Booking PAID không được sửa trực tiếp Passenger hoặc TripSeat.
- Payment callback lặp không được tạo lại transition PAID.

## 6.4. Payment

| Từ | Đến | Trigger/điều kiện |
|---|---|---|
| PENDING | PROCESSING | Yêu cầu đã gửi provider hoặc đang chờ kết quả cuối. |
| PENDING | CANCELLED | Hủy trước khi provider xử lý thành công. |
| PROCESSING | SUCCEEDED | Kết quả provider hợp lệ, đúng amount/currency và chưa được xử lý. |
| PROCESSING | FAILED | Provider trả kết quả cuối thất bại. |
| PROCESSING | CANCELLED | Provider/Customer hủy và chưa thành công. |
| SUCCEEDED | REFUND_PENDING | Có Refund đang xử lý. |
| REFUND_PENDING | PARTIALLY_REFUNDED | Tổng Refund thành công nhỏ hơn Payment amount. |
| REFUND_PENDING | REFUNDED | Đã hoàn toàn bộ amount phải hoàn. |
| PARTIALLY_REFUNDED | REFUNDED | Khoản còn lại được hoàn thành công. |

Ràng buộc:

- Không đổi SUCCEEDED thành FAILED do callback đến sau; tạo reconciliation case nếu provider mâu thuẫn.
- External transaction/event ID chỉ tác động một lần.
- Trạng thái PROCESSING được dùng khi chưa chắc chắn, không được coi là FAILED.

## 6.5. Ticket

[Mở State Diagram Ticket](../system-design/02-05-state-machine-diagrams/05-ticket.md) · [Refund](../system-design/02-05-state-machine-diagrams/06-refund.md)

| Từ | Đến | Điều kiện |
|---|---|---|
| ISSUED | CHECKED_IN | QR/mã hợp lệ, đúng Trip và actor có quyền. |
| CHECKED_IN | USED | Trip hoàn thành theo policy. |
| ISSUED | CANCELLED | Customer hủy hợp lệ hoặc Trip bị hủy. |
| CANCELLED | REFUNDED | Khoản hoàn liên quan thành công. |

Ràng buộc:

- Ticket CHECKED_IN/USED không được Customer hủy bằng luồng thông thường.
- Check-in lặp không tạo transition thứ hai.
- Ticket CANCELLED/REFUNDED không còn quyền sử dụng QR.

## 6.6. Refund

| Từ | Đến | Điều kiện |
|---|---|---|
| REQUESTED | PROCESSING | Yêu cầu hợp lệ được gửi provider. |
| PROCESSING | SUCCEEDED | Provider xác nhận hoàn tiền thành công. |
| PROCESSING | FAILED | Provider trả kết quả cuối thất bại. |
| FAILED | PROCESSING | Retry/manual action được phép, có idempotency và audit. |

Ràng buộc:

- Refund FAILED không tự khôi phục Ticket.
- Tổng Refund thành công không vượt Payment thành công.
- Retry không tạo logical Refund thứ hai.

## 6.7. Trip

[Mở State Diagram Trip](../system-design/02-05-state-machine-diagrams/07-trip.md)

| Từ | Đến | Actor/điều kiện |
|---|---|---|
| SCHEDULED | BOARDING | Operator Operations/Driver được phân công; đến thời gian cho phép. |
| BOARDING | DEPARTED | Driver/Operator có quyền. |
| DEPARTED | IN_TRANSIT | Driver/Operator có quyền. |
| IN_TRANSIT | ARRIVED | Driver/Operator có quyền. |
| ARRIVED | COMPLETED | Driver/Operator hoặc job được cấu hình. |
| SCHEDULED | CANCELLED | Operator/Admin có quyền và cung cấp reason. |
| BOARDING | CANCELLED | Operator/Admin có quyền và cung cấp reason. |

Hủy sau DEPARTED là trường hợp vận hành đặc biệt, không dùng transition thông thường nếu chưa có policy và quyền cao hơn được phê duyệt.

## 6.8. Quy tắc thực thi chung

- Mỗi command chuyển trạng thái kiểm tra actor, ownership/tenant, trạng thái nguồn và concurrency version.
- Transition thành công ghi actor, timestamp, reason khi cần và correlation ID.
- Transition có tác động tới miền khác phải tạo dữ liệu/sự kiện bền vững để retry.
- Command lặp cùng idempotency key không tạo transition hoặc side effect lần hai.
- Giao diện phải tải lại trạng thái server sau khi command thành công hoặc xung đột.

[← Chương 5](./05-yeu-cau-chuc-nang.md) · [Mục lục](./README.md) · [Chương 7 →](./07-giao-dien-va-tich-hop.md)
