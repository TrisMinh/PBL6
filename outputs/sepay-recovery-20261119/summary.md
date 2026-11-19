# Kiểm thử khôi phục SePay và các ca hồi quy — 19/11/2026

Lượt chạy dùng mã local trên commit `4a53f8d2`, .NET SDK 10.0.401 và Testcontainers. Kết quả gốc nằm trong `workspace/TestResults/sepay-recovery-20261119/` trên máy chạy.

| Suite .NET | Đạt | Lỗi | Bỏ qua |
|---|---:|---:|---:|
| Identity | 19 | 0 | 0 |
| Transport | 18 | 0 | 0 |
| Booking | 17 | 0 | 0 |
| Payment | 43 | 0 | 0 |
| Notification | 2 | 0 | 0 |
| Reporting | 8 | 0 | 0 |
| Gateway | 11 | 0 | 0 |
| Messaging | 5 | 0 | 0 |
| Building Blocks | 17 | 0 | 0 |
| Contracts | 10 | 0 | 0 |
| Architecture | 16 | 0 | 0 |
| **Tổng** | **166** | **0** | **0** |

- Ba ca lỗi cũ đã qua. Identity từ chối token của phiên đã đăng xuất khi đọc hồ sơ. Booking bỏ endpoint HTTP xác nhận thanh toán cũ và từ chối truy vấn Operator khi thiếu phạm vi nhà xe.
- Sáu ca đối chiếu dùng phản hồi SePay mô phỏng. Các ca kiểm tra xác nhận khoản đã thu, IPN đến trong lúc đang đối chiếu, đơn hết hạn chuyển chờ hoàn tiền, giao dịch còn chờ, số tiền lệch và lỗi phía SePay. Ca kiểm thử cũng xác nhận người ngoài đơn bị từ chối và giới hạn gọi lặp được giữ.
- Vitest chạy 24 ca trong ba tệp test liên quan đến trang kết quả thanh toán. Tất cả đạt.
- Docker Compose build thành công và đã áp dụng migration `006_sepay_reconciliation.sql`. Request ẩn danh qua cổng Customer đến API mới nhận `401`. Khi dừng `payment-2`, cả sáu request đọc qua Gateway nhận `200` từ `payment` sau khi health check cập nhật. Khi khởi động lại `payment-2`, cả hai healthy và mỗi instance nhận ba trong sáu request tiếp theo.

Nghiệm thu một giao dịch thanh toán trả trước trực tiếp trên SePay Sandbox và chạy đối chiếu định kỳ vẫn là các bước tiếp theo.
