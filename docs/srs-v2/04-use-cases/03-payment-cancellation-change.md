# 4.4.3. Nhóm Use Case — Payment, hủy và đổi vé

[← Danh mục Use Case](./README.md)

## UC-PAY-01 — Thanh toán và nhận vé

| Thuộc tính | Nội dung |
|---|---|
| Mục tiêu | Ghi nhận Payment chính xác và phát hành Ticket đúng một lần. |
| Actor chính | Customer |
| Actor phụ | Payment Gateway |
| Kích hoạt | Customer chọn phương thức thanh toán cho Booking. |
| Tiền điều kiện | Booking PENDING_PAYMENT, còn hạn và thuộc Customer. |
| Hậu điều kiện thành công | Payment SUCCEEDED, Booking PAID, TripSeat BOOKED và Ticket ISSUED. |
| Hậu điều kiện thất bại | Không phát hành Ticket; giao dịch ở trạng thái có thể retry, bù trừ hoặc đối soát. |
| Liên kết | FR-PAY-001..007; FR-TICKET-001..003; BR-PAY-*; AC-PAY-* |

### Luồng chính

1. Customer mở Booking còn thời hạn thanh toán.
2. Customer chọn phương thức thanh toán.
3. Hệ thống xác minh Booking, ownership, expiry và total phía server.
4. Hệ thống tạo Payment/payment intent với mã tham chiếu duy nhất và idempotency key.
5. Customer hoàn tất bước cần thiết tại Payment Gateway.
6. Payment Gateway gửi webhook/callback có chữ ký.
7. Hệ thống xác minh provider, signature, external event/transaction ID, amount và currency.
8. Hệ thống lưu Payment SUCCEEDED theo cơ chế idempotent.
9. Kết quả Payment đã xác minh được chuyển đến miền Booking.
10. Hệ thống kiểm tra Booking/hold và cập nhật Booking, TripSeat, Ticket nhất quán.
11. Hệ thống tạo đúng một Ticket cho mỗi Booking Item và gửi Notification.
12. Client truy vấn trạng thái server và hiển thị kết quả cuối.

### Luồng thay thế và ngoại lệ

- Customer quay lại trước webhook: hiển thị PROCESSING và polling có backoff; không yêu cầu thanh toán lại ngay.
- Webhook lặp: trả kết quả phù hợp cho provider nhưng không xử lý nghiệp vụ lần hai.
- Chữ ký sai: từ chối và ghi security log đã loại bỏ dữ liệu nhạy cảm.
- Amount/currency sai: không xác nhận Booking; tạo reconciliation/security case.
- Payment FAILED/CANCELLED: Booking không chuyển PAID; ghế giữ đến expiry hoặc được giải phóng theo rule.
- Payment thành công sau khi hold/Booking hết hạn nhưng ghế vẫn còn hợp lệ: xử lý theo quy tắc được duyệt và vẫn không tạo Ticket trùng.
- Payment thành công trễ và ghế đã thuộc Booking khác: không chiếm lại ghế; tạo compensation Refund hoặc manual case.
- Notification lỗi: giao dịch đã commit không rollback; Customer vẫn xem Ticket trong ứng dụng.

### Yêu cầu idempotency

- Cùng idempotency key và payload cho create Payment trả cùng logical Payment.
- Provider transaction/event ID chỉ được xử lý một lần.
- Consumer kết quả Payment phải chống tạo BookingPaid/Ticket lần hai.

### Sơ đồ liên quan

- [Sequence Payment Provider](../../diagrams/subdiagrams/sequences/sequence-payment-provider.html)
- [Sequence Payment Confirm Booking](../../diagrams/subdiagrams/sequences/sequence-payment-confirm-booking.html)
- [Sequence Ticket Delivery](../../diagrams/subdiagrams/sequences/sequence-ticket-delivery.html)
- [State Booking và Payment](../../diagrams/subdiagrams/states/state-booking-payment.html)

## UC-CANCEL-01 — Hủy vé và hoàn tiền

| Thuộc tính | Nội dung |
|---|---|
| Mục tiêu | Thu hồi quyền sử dụng Ticket và hoàn đúng số tiền theo policy. |
| Actor chính | Customer |
| Actor phụ | Payment Gateway |
| Kích hoạt | Customer chọn hủy một hoặc nhiều Ticket/Booking Item. |
| Tiền điều kiện | Customer sở hữu Ticket; Ticket và Trip còn đủ điều kiện hủy. |
| Hậu điều kiện thành công | Ticket bị hủy; ghế được mở lại nếu còn bán; Refund được tạo khi có tiền phải hoàn. |
| Hậu điều kiện thất bại | Không hủy âm thầm; trạng thái tài chính không chắc chắn được giữ để retry/đối soát. |
| Liên kết | FR-BOOK-009; FR-PAY-008; BR-CANCEL-*; AC-CANCEL-* |

### Luồng preview

1. Customer chọn Ticket muốn hủy.
2. Hệ thống kiểm tra ownership, Ticket state, Trip state, giờ khởi hành và policy snapshot.
3. Hệ thống tính phí, số tiền hoàn, phương thức hoàn và thời gian dự kiến.
4. Hệ thống trả preview mà chưa thay đổi trạng thái.

### Luồng xác nhận

1. Customer xác nhận preview còn hiệu lực.
2. Client gửi command kèm idempotency key.
3. Hệ thống kiểm tra lại điều kiện để tránh dữ liệu thay đổi sau preview.
4. Hệ thống chuyển Ticket sang CANCELLED và cập nhật TripSeat nếu còn được bán lại.
5. Nếu refund amount lớn hơn 0, hệ thống tạo Refund REQUESTED.
6. Payment Gateway xử lý Refund; hệ thống lưu kết quả.
7. Customer được thông báo trạng thái Ticket và Refund.

### Luồng thay thế và ngoại lệ

- Không đủ điều kiện: không thay đổi dữ liệu; trả lý do và policy liên quan.
- Preview đã cũ: tính lại và yêu cầu Customer xác nhận lại nếu số tiền thay đổi.
- Refund amount bằng 0: hủy Ticket nhưng không tạo giao dịch Refund.
- Payment Gateway timeout: giữ Refund PROCESSING nếu chưa biết kết quả; không hoàn lại Ticket đã bị hủy.
- Refund FAILED: Ticket vẫn CANCELLED; Refund có thể retry hoặc xử lý thủ công.
- Command lặp: trả cùng kết quả và không tạo Refund thứ hai.
- Tổng Refund vượt Payment thành công: từ chối và tạo cảnh báo đối soát.

### Sơ đồ liên quan

- [Sequence Cancellation Preview](../../diagrams/subdiagrams/sequences/sequence-cancel-preview.html)
- [Sequence Refund Saga](../../diagrams/subdiagrams/sequences/sequence-refund-saga.html)
- [State Ticket và Refund](../../diagrams/subdiagrams/states/state-ticket-refund.html)

## UC-CHANGE-01 — Đổi vé

| Thuộc tính | Nội dung |
|---|---|
| Mục tiêu | Chuyển Passenger sang Trip/ghế mới mà không làm mất Ticket cũ nếu quy trình thất bại. |
| Actor chính | Customer |
| Actor phụ | Payment Gateway khi có chênh lệch tiền |
| Kích hoạt | Customer chọn đổi một Ticket còn hiệu lực. |
| Tiền điều kiện | Ticket thuộc Customer, còn đủ điều kiện đổi; Trip/ghế mới còn khả dụng. |
| Hậu điều kiện thành công | Ticket mới ISSUED, Ticket cũ CANCELLED và phần chênh lệch tài chính đã được xử lý. |
| Hậu điều kiện thất bại | Ticket cũ tiếp tục có hiệu lực, hoặc có manual case/bù trừ được audit. |
| Mức ưu tiên | SHOULD |
| Liên kết | FR-BOOK-010; BR-CANCEL-006..007 |

### Luồng chính

1. Customer chọn Ticket hiện tại.
2. Hệ thống kiểm tra policy, trạng thái và thời gian còn lại trước khởi hành.
3. Customer tìm/chọn Trip hoặc TripSeat mới.
4. Hệ thống tạo SeatHold cho ghế mới trước khi tác động Ticket cũ.
5. Hệ thống tính phí đổi và chênh lệch giữa giá cũ và giá mới.
6. Hệ thống hiển thị đầy đủ kết quả tài chính để Customer xác nhận.
7. Nếu cần thu thêm, Customer hoàn tất Payment bổ sung.
8. Nếu cần hoàn bớt, hệ thống tạo Refund theo policy.
9. Khi điều kiện tài chính cần thiết đã đạt, hệ thống phát hành Ticket mới và hủy Ticket cũ theo thao tác nhất quán/saga được kiểm soát.
10. Hệ thống giải phóng quyền trên ghế cũ nếu còn bán được và gửi Notification.

### Luồng thay thế và bù trừ

- Không giữ được ghế mới: không tác động Ticket cũ.
- Hold mới hết hạn trước xác nhận: không đổi Ticket; Customer phải chọn lại.
- Payment bổ sung thất bại: giải phóng hold mới và giữ Ticket cũ.
- Đã thu tiền nhưng không phát hành được Ticket mới: hoàn tiền bổ sung hoặc tạo manual case; Ticket cũ không bị hủy nếu chưa qua điểm commit.
- Đã phát hành Ticket mới nhưng hủy Ticket cũ gặp lỗi: đưa vào quy trình phục hồi có audit, không để hai Ticket cùng có hiệu lực cho hai ghế ngoài policy.
- Command lặp: trả lại kết quả đổi vé hiện có.

[← Danh mục Use Case](./README.md)
