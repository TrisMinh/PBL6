# Bổ sung kết nối live

- Tìm chuyến gửi giá, giờ khởi hành và thứ tự sắp xếp tới BE, đọc đủ các trang thay vì dừng ở 100 kết quả. Bộ lọc loại xe, buổi và tiện ích tiếp tục xử lý trên toàn bộ kết quả để giữ cách phân loại của giao diện. BE sắp xếp thêm theo ID để phân trang ổn định khi nhiều chuyến cùng giá/giờ.
- Trang kiểm tra đặt vé có lựa chọn điểm đón, điểm trả và kênh thanh toán. Các tùy chọn lưu theo phiên đặt vé; khóa sau lần gửi giữ ghế đầu tiên để retry giữ nguyên nội dung yêu cầu.
- `PAY_LATER` chỉ hiện khi API chuyến trả `allowPayLater=true`. Trường này lấy từ chính sách giá đã chốt khi công bố chuyến, cùng nguồn mà Booking sử dụng. Bật thanh toán sau trong hồ sơ nhà xe áp dụng cho chuyến công bố sau đó.
- Đặt vé trả sau thành công chuyển tới vé trong tài khoản; trả trước chuyển tới cổng thanh toán. Trang thanh toán hỗ trợ QR, ATM, tài khoản ngân hàng và cổng VNPay.
- Nút bỏ đặt vé nhả hold qua DELETE. Nếu mất phản hồi tạo hold, khôi phục bằng cùng idempotency key trước khi nhả. Nếu hold đã được chuyển thành đơn, yêu cầu kiểm tra tài khoản thay vì coi thao tác này là hủy đơn.
- Nhà xe mở đối soát tại `/operator/settlements`. Tại `/operator/bookings`, chọn “Xem giao dịch” để xem thanh toán của đơn và tạo hoàn tiền. Trang hoàn tiền cũng hỗ trợ tra cứu trực tiếp ID giao dịch.
- Thông báo dùng cursor với nút “Xem thêm thông báo”. Badge đếm số chưa đọc trong các mục đã tải, không phải tổng chưa đọc toàn hệ thống vì BE chưa trả tổng này.

Kiểm tra: typecheck FE, ESLint các file thay đổi và Docker build Transport. Chưa chạy bộ test hoặc kiểm thử giao dịch thực tế trong lần bổ sung này.
