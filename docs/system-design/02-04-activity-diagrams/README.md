# 2.4 Activity Diagrams

Bộ sơ đồ activity mô tả đủ bảy quy trình nghiệp vụ `BP-01..07` trong SRS. Mỗi action ghi rõ chủ thể thực hiện; decision dùng điều kiện trong ngoặc vuông và mọi nhánh lỗi đều kết thúc hoặc quay lại một bước hợp lệ.

## Danh mục

| Quy trình | Sơ đồ | Use Case nguồn |
|---|---|---|
| `BP-01` | [Tìm chuyến, đặt vé và thanh toán](./01-search-booking-payment.md) | `UC-SEARCH-01`, `UC-BOOK-01`, `UC-PAY-01`, `UC-TICKET-01` |
| `BP-02` | [Hủy vé và hoàn tiền](./02-ticket-cancellation-refund.md) | `UC-CANCEL-01` |
| `BP-03` | [Đổi vé](./03-ticket-change.md) | `UC-CHANGE-01` |
| `BP-04` | [Tạo và mở bán chuyến](./04-create-publish-trip.md) | `UC-OPS-05` |
| `BP-05` | [Vận hành chuyến và check-in](./05-trip-operation-checkin.md) | `UC-OPS-06`, `UC-DRIVER-01`, `UC-REVIEW-01` |
| `BP-06` | [Hủy chuyến có vé đã bán](./06-trip-cancellation.md) | `UC-TRIP-01` |
| `BP-07` | [Quản lý tài khoản, nhà xe và nền tảng](./07-account-platform-management.md) | Nhóm Auth, Profile, Ops, Admin và Report |

## Quy ước

- Hình tròn kép: điểm bắt đầu/kết thúc.
- Hình thoi: decision; nhãn cạnh là guard.
- Action có tiền tố `Actor`, `Client`, `Service` hoặc `Provider` để thay cho swimlane khi Mermaid không có UML Activity native.
- Trạng thái viết hoa phải khớp [State Requirements](../../srs-v2/06-yeu-cau-trang-thai.md).
- Redirect từ provider không phải bằng chứng thanh toán; chỉ webhook đã xác minh mới được phép tạo `PaymentSucceeded`.

