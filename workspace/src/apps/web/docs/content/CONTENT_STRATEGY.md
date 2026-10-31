# Chiến lược nội dung BLUE

> Cập nhật: 2026-10-18 · Ngôn ngữ v1: tiếng Việt

## Định vị

BLUE giúp khách tìm và đặt vé xe trong một luồng rõ ràng từ tìm chuyến đến nhận vé. Nội dung phải giảm do dự bằng thông tin cụ thể về hành trình, thời gian, giá, ghế và trạng thái giao dịch.

**Giá trị chính**: Tìm chuyến phù hợp và hoàn tất đặt vé nhanh, rõ ràng, có thể kiểm tra lại.  
**Thông điệp dự thảo**: Đi đúng chuyến, đặt đúng ghế cùng BLUE.

## Giọng điệu

| Ngữ cảnh | Giọng điệu | Ví dụ |
|---|---|---|
| Tìm kiếm/đặt vé | Ngắn, rõ, hướng hành động | “Chọn ghế để tiếp tục” |
| Lỗi/xung đột | Bình tĩnh, nêu cách phục hồi | “Ghế A3 vừa được chọn. Vui lòng chọn ghế khác.” |
| Hết hạn | Trực tiếp, không đổ lỗi | “Thời gian giữ ghế đã hết. Tìm lại chuyến để tiếp tục.” |
| Thành công | Ấm áp, xác nhận kết quả | “Đặt vé thành công. Mã vé của bạn là…” |
| Admin | Chính xác, ưu tiên dữ liệu | “3 giao dịch đang chờ xử lý” |

Quy tắc:

- Dùng “bạn” cho khách và động từ cụ thể cho CTA.
- Nêu kết quả hoặc bước tiếp theo; tránh thuật ngữ kỹ thuật/API.
- Không hứa “giá rẻ nhất”, “an toàn tuyệt đối” hoặc dùng số liệu chưa có nguồn.
- Không hiển thị logo, đánh giá hoặc lời chứng thực giả như dữ liệu thật.

## Persona nội dung

### Khách đặt vé

- **Mục tiêu**: tìm chuyến phù hợp và biết chắc mình đã đặt đúng.
- **Lo ngại**: sai ngày/điểm đón, ghế không còn, tiền đã trừ nhưng chưa thấy vé.
- **CTA chính**: “Tìm chuyến”, “Chọn ghế”, “Thanh toán”, “Xem vé”.

### Super admin

- **Mục tiêu**: xem nhanh trạng thái và xử lý trường hợp cần chú ý.
- **Lo ngại**: dữ liệu khó lọc, trạng thái mơ hồ, thao tác không có xác nhận.
- **CTA chính**: “Xem chi tiết”, “Lọc”, “Xác nhận”, “Cập nhật trạng thái”.

## SEO dự thảo

Canonical domain chưa chốt. Trước khi production phải thay mọi URL placeholder cấu hình bằng domain thật; không hardcode domain trong component.

| Chủ đề từ khóa | Ý định | Route dự kiến |
|---|---|---|
| đặt vé xe online | giao dịch | `/` và `/trips` |
| vé xe đi [điểm đến] | giao dịch | route landing phổ biến khi dữ liệu thật sẵn sàng |
| tra cứu vé xe | điều hướng/giao dịch | `/tickets/lookup` |
| hủy vé xe, hoàn vé xe | thông tin/giao dịch | trang chính sách và chi tiết vé |

Khối lượng tìm kiếm, độ khó từ khóa và landing page theo tuyến cần nghiên cứu sau; không bịa số liệu trong giai đoạn mock.

## Metadata

- Homepage title dự thảo: `BLUE — Đặt vé xe online nhanh chóng`.
- Homepage description dự thảo: `Tìm chuyến, chọn ghế và đặt vé xe trực tuyến cùng BLUE.`
- `/admin/*`, trang thanh toán callback, lỗi và trang có dữ liệu cá nhân: `noindex, nofollow`.
- Route công khai ổn định: title/description riêng; route tìm kiếm động dùng metadata theo điểm đi/đến khi dữ liệu hợp lệ.
- Structured data dự kiến: `Organization`, `WebSite`, `BreadcrumbList`; chỉ thêm schema chuyến/offer khi dữ liệu thật đáp ứng yêu cầu.

## CTA chuẩn

| CTA | Ngữ cảnh |
|---|---|
| Tìm chuyến | form tìm kiếm |
| Xem chuyến | kết quả/landing |
| Chọn ghế | chi tiết chuyến |
| Tiếp tục | chuyển bước booking |
| Thanh toán qua VNPay | bước thanh toán |
| Xem vé | kết quả thành công |
| Thử lại | lỗi có thể phục hồi |
| Quay lại kết quả | booking hết hạn/xung đột |
