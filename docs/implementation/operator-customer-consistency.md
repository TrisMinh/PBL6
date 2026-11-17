# Operator: thống nhất giao diện với customer

## Nguyên tắc
- Giữ toàn bộ thông tin, thao tác, bộ lọc và luồng API. Không thay dữ liệu thật bằng demo.
- Mã ngắn chỉ là nhãn hiển thị; định danh gốc giữ trong request, tìm kiếm và chi tiết.
- Dùng token BLUE, Be Vietnam Pro, control và lịch chung của customer.
- Kiểm tra ảnh thực tế và thao tác sau từng nhóm. Test tự động không thay thế duyệt UI.
- Chạy local 5182. Chỉ build Docker khi người dùng yêu cầu.

## Phạm vi duyệt
- [x] Lịch chuyến, bộ lọc, phân trang, popup tài xế
- [x] Tạo / sửa / xác nhận chuyến, chi tiết dạng trang và khung mở rộng
- [x] Đặt chỗ, danh sách chuyến, danh sách hành khách, chi tiết và xuất dữ liệu
- [x] Hủy vé, chính sách, chi tiết yêu cầu và theo dõi hoàn tiền
- [x] Tuyến, điểm dừng, tạo/sửa tuyến và popup điểm dừng
- [x] Xe, sơ đồ ghế, tạo/sửa và xác nhận thay đổi
- [x] Tài xế, hồ sơ, tạo/sửa, tệp đính kèm và phân công
- [x] Đối soát, chi tiết, lọc thời gian và CSV
- [x] Báo cáo, biểu đồ, bộ lọc và các popup chi tiết
- [x] Hồ sơ nhà xe, thành viên, vai trò, trạng thái, upload và thông báo
- [x] Header, sidebar, mobile drawer, loading, lỗi và trạng thái rỗng

## Kiểm tra mỗi màn hình
1. Desktop 1600/1280 và mobile 390: chụp ảnh, xem căn hàng, chữ, khoảng cách, tràn và vùng cuộn.
2. Mở dropdown/calendar/dialog; kiểm tra focus, Escape, đóng và quay lại.
3. Kiểm tra tìm kiếm/lọc/reset/pagination; xác nhận không làm mất hành động nghiệp vụ.
4. Lưu/hủy bằng demo hoặc fixture khi có tác động dữ liệu; không hủy chuyến thật chỉ để kiểm tra UI.
5. Ghi phát hiện, sửa rồi chụp lại. Chỉ đánh dấu hoàn tất sau khi duyệt ảnh.

## Kết quả lượt 2026-11-17
- Đã duyệt ảnh 20 route/trạng thái ở 1600px và 390px (40 ảnh), chờ dữ liệu tải xong trước khi chụp.
- Duyệt thêm 9 popup/drawer và thao tác phân trang; kiểm tra không tràn viewport và không có lỗi JS.
- 13 danh sách chính không còn UUID trong nội dung hiển thị mặc định. Định danh đầy đủ nằm trong chi tiết, trường mã tuyến hoặc phần mở rộng kỹ thuật; không thay ID API.
- Mã hiển thị: CX (chuyến), TU (tuyến), TX (tài xế), DS (đối soát), GD (giao dịch). Mã nghiệp vụ đã có được giữ nguyên.
- Danh sách chuyến hành khách phân trang 10 dòng, chọn trang không làm đổi ID hay dữ liệu lọc. Tuyến/tài xế và bảng báo cáo có vùng cuộn riêng.
- Form tạo/sửa chuyến và tuyến dùng nhãn rõ, control BLUE, bỏ viền lồng; các lịch ngày dùng DatePicker customer.
- Đã giữ xuất CSV, bộ lọc, tìm kiếm, chọn hàng, xem chi tiết, điểm dừng, sơ đồ ghế, upload và thao tác trạng thái.
- 121 test operator qua; TypeScript và ESLint thay đổi qua. Thao tác nghiệp vụ có tác động dữ liệu được giữ nguyên, không phát hành/hủy chuyến hoặc tạo hoàn tiền thật trong lượt duyệt giao diện.
- Chỉ local 5182; chưa build Docker và chưa push lượt này.

## Tạo chuyến tối giản và ảnh chuyến
- Bỏ bóng đổ và thanh nhấn trang trí trong form; giảm khung lồng ở điểm đón/trả, giữ đủ ba bước và trường nghiệp vụ.
- Thẻ tóm tắt có ảnh, tuyến, giờ chạy, xe/sức chứa, avatar chữ tài xế và giá vé. Ảnh JPG/PNG tối đa 5 MB được xem trước và lưu tham chiếu theo chuyến trong metadata của nhà xe; lịch chuyến và khung chi tiết dùng lại ảnh đó.
- Nếu tải ảnh hoặc lưu tham chiếu lỗi sau khi đã tạo bản nháp, thử lại sử dụng bản nháp đã tạo, tránh tạo trùng chuyến.
- Đã xem lại ảnh desktop 1600px và mobile 390px, kiểm tra Next/Back, trường bắt buộc, giá vé và preview ảnh. Kiểm tra lưu ảnh/lỗi rồi thử lại dùng các request ghi được intercept, không tạo chuyến hay phát hành thật.
- 127 test operator qua; TypeScript và ESLint qua. Chỉ cập nhật localhost 5182.

## Chọn tỉnh và điểm đón/trả khi tạo chuyến
- Hai ô trên chọn tỉnh/thành phố đã gộp trùng; Đà Lạt được nhóm vào Lâm Đồng. Tên fixture dạng Seed/Station không dùng làm tên tỉnh.
- Bên dưới chọn điểm xuất phát/đến từ các đầu tuyến đã khai báo, dùng tên và địa chỉ để gộp điểm trùng. Cặp tỉnh và cặp điểm xác định routeId thật, không lưu lựa chọn giả hoặc sửa danh sách điểm dừng của tuyến.
- Đổi tỉnh xóa lựa chọn phụ thuộc. Nếu cùng cặp điểm có nhiều tuyến, phần mở rộng cho phép đổi tuyến khai thác; các điểm phục vụ trung gian vẫn xem được trong phần mở rộng.
- Đã xem ảnh desktop và mobile; kiểm tra luồng chọn, reset, Next/Back và payload lưu có routeId bằng request ghi intercept. Form demo chỉnh sửa vẫn hoạt động. 131 test operator, TypeScript và ESLint qua; không build Docker.

## Tự đối chiếu phân công và gợi ý giờ
- Bỏ nút kiểm tra lại lịch. Đổi xe, tài xế hoặc khung giờ tạo lượt đối chiếu mới; phản hồi cũ không được dùng để đi tiếp trong lúc đang kiểm tra. Có tự thử lại khi tải lỗi và vẫn kiểm tra định kỳ.
- Chọn tuyến khi chưa nhập giờ sẽ gợi ý giờ tròn kế tiếp theo giờ Việt Nam, rồi tính giờ đến từ thời lượng tuyến. Đây là giờ gợi ý, không phải giờ cố định của tuyến. Các trường đã chỉnh thủ công và giờ của bản nháp đang sửa không bị ghi đè.
- Đã thử tự gọi GET sau khi đổi phân công, phản hồi trùng lịch chặn Next và chọn xe phù hợp để tiếp tục; đã xem ảnh trạng thái hợp lệ/trùng lịch. Kiểm tra đổi tuyến giữ nguyên giờ sửa tay, Next/Back và mobile; không ghi dữ liệu thật. 133 test operator qua, TypeScript/ESLint qua, chỉ local.

## Trạng thái đối chiếu phân công gọn trong form
- Thay logo loading giữa form bằng nhãn thụ động ở cuối khối xe/nhân sự: Đang kiểm tra, Sẵn sàng, Trùng lịch, Chưa kiểm tra được; có Chờ phân công/GPLX hết hạn/Cần kiểm tra thêm theo điều kiện thực tế.
- Giữ dữ liệu lần đối chiếu trước trong lúc tải lại, hai ô chọn vẫn thao tác được; Next/review vẫn chờ kết quả mới. Cảnh báo ở dưới ô chọn, không đẩy các ô lên/xuống khi đối chiếu.
- Đã làm chậm phản hồi, kiểm tra vị trí ô chọn không thay đổi trong khối, không xuất hiện BrandLoading, kiểm tra sẵn sàng/trùng lịch/lỗi tự thử lại và đổi lựa chọn để phục hồi. Đã xem ảnh desktop/mobile. 133 test operator và TypeScript/ESLint qua; không ghi dữ liệu thật hoặc build Docker.
