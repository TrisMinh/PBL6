# BLUE — Hướng dẫn sử dụng frontend mock

Frontend development/mock dùng điểm dừng, nhà xe, chuyến, tài khoản và giao dịch mô phỏng. Toàn bộ luồng đặt vé, VNPay, tra cứu/chi tiết vé, đăng nhập, lịch sử vé, hủy một phần và quản trị đã hoạt động. Không thu tiền thật và không thay đổi backend nào.

## Tìm chuyến từ trang chủ

1. Mở `/` và chờ tải danh sách điểm đi/đến. Nếu tải lỗi, chọn **Thử lại**.
2. Chọn **Điểm đi**, **Điểm đến** khác nhau, **Ngày đi** từ hôm nay theo lịch Việt Nam và **Hành khách** từ 1 đến 6.
3. Chọn **Tìm chuyến** hoặc nhấn Enter khi focus nút. Lỗi hiện cạnh trường cần sửa; dữ liệu chưa hợp lệ sẽ giữ bạn ở trang chủ.
4. Khi hợp lệ, URL chuyển đến `/trips` với điểm đi/đến/ngày/số khách đã chọn. Chờ tải danh sách chuyến; mỗi thẻ hiển thị nhà xe, hành trình, giờ/ngày tại Việt Nam, thời lượng, loại xe, chỗ còn và giá VND/khách.

## Lọc và sắp xếp kết quả

1. Chọn **Sắp xếp** theo giờ khởi hành hoặc giá tăng/giảm; chọn **Loại xe** nếu cần. Trên điện thoại, mở **Bộ lọc và sắp xếp** trước. Thay đổi cập nhật ngay trên URL và kết quả.
2. Chọn **Đặt lại** để trở về giờ khởi hành sớm nhất và tất cả loại xe, giữ hành trình/ngày/số khách.
3. Khi không có chuyến, thử đổi loại xe hoặc chọn **Sửa tìm kiếm** về trang chủ. Khi tải lỗi, chọn **Thử lại**; bạn cũng có thể sửa tìm kiếm.
4. Nút **Chọn chuyến** của chuyến hết chỗ bị khóa. Chuyến còn chỗ bắt đầu một phiên đặt vé 10 phút và chuyển đến **Chọn ghế**. Khi đang xử lý, các nút chọn chuyến bị khóa để tránh gửi lặp. Nếu có lỗi, bạn ở lại kết quả, có thể **Thử lại đặt vé** hoặc **Sửa tìm kiếm**; thông tin phiên trước vẫn được giữ. Sơ đồ ghế và các bước hành khách, kiểm tra đặt vé, VNPay mô phỏng được mô tả bên dưới.

Nếu URL tìm kiếm thiếu hoặc sai thông tin, trang hiển thị **Thông tin tìm kiếm chưa hợp lệ**. Chọn **Tìm lại chuyến** để nhập hành trình mới. Trong drawer mobile, Escape hoặc **Đóng bộ lọc** trả focus về nút mở.

Các bến và operator là dữ liệu mô phỏng. Để kiểm thử seed cố định, dùng route Bến Mây Sài Gòn → Bến Thông Đà Lạt ngày2099-01-01; ngày này phục vụ thử nghiệm, không phải lịch bán vé thật. Production build giữ nội dung hero prerender; nguồn MSW hiện chỉ khởi động trong development.

## Mở các trang khách hàng

1. Mở trang chủ `/` để xem thương hiệu BLUE.
2. Chọn **Tìm chuyến**, **Tra cứu vé** hoặc **Đăng nhập** để mở trang tương ứng.
3. Trên điện thoại, chọn **Mở menu** để xem các liên kết. Chọn một liên kết hoặc nhấn **Escape** để đóng menu.

Dùng phím **Tab** để di chuyển giữa liên kết/nút và **Enter** để kích hoạt. Liên kết **Đến nội dung chính** xuất hiện khi nhận focus, cho phép bỏ qua header.

## Khi mở đường dẫn không tồn tại

Trang hiển thị **Không tìm thấy trang**. Chọn **Về trang chủ** để tiếp tục điều hướng. Nếu trang gặp lỗi tải, giao diện cũng có liên kết này; chi tiết lỗi nội bộ không hiển thị.

## Khi mở trang đặt vé hoặc quản trị

| Tình huống | Hành vi hiện có |
|---|---|
| Mở trang đặt vé/thanh toán khi không có phiên hợp lệ | Chuyển về trang **Tìm chuyến** |
| Mở trang quản trị khi chưa có phiên đăng nhập | Chuyển về trang **Đăng nhập**, rồi trở lại route quản trị canonical sau khi dùng fixture admin |
| Phiên khách hàng mở trang quản trị | Hiển thị **403 — Không có quyền truy cập** và link về trang chủ |
| Phiên quản trị hợp lệ trong môi trường kiểm thử | Hiển thị các module Tổ chức, Nhân viên, Đơn đặt vé, Thanh toán và Hoàn tiền với list/detail/filter; Tổ chức và Nhân viên có dialog thêm/sửa mock |

Trên màn hình nhỏ, menu quản trị mở bằng **Mở menu quản trị**. Phím Escape đóng menu và trả focus về nút mở. Bảng quản trị chuyển thành thẻ có nhãn dưới 768px để tránh cuộn ngang.

## Chọn ghế và giữ chỗ

Chọn chuyến sẽ mở sơ đồ giường nằm34 hoặc cabin22. Ghế đã bán/đang được người khác giữ/không khả dụng không thể chọn; chỗ bạn đã chọn vẫn có thể bỏ chọn khi tải lại trang. Chọn tối đa6 chỗ; nút Tiếp tục chỉ mở khi số chỗ đúng bằng số hành khách đã tìm và cập nhật đã hoàn tất. Tổng cộng là giá vé nhân số ghế, không có dòng phí dịch vụ.

Đồng hồ giữ nguyên thời hạn10 phút ban đầu qua refresh hoặc quay lại tab. Nếu chỗ vừa được người khác chọn, thông báo cho biết mã chỗ, trả lại lựa chọn trước đó và cho phép tải sơ đồ/chọn lại hoặc về danh sách. Khi hết hạn, thông báo hướng dẫn tìm chuyến mới; nếu còn hành trình hợp lệ, link giữ các tiêu chí tìm kiếm, nếu không thì về Home. Lỗi kết nối giữ lựa chọn cũ và có nút tải lại. Bước thông tin hành khách đã có trong Task6 bên dưới.

## Nhập thông tin hành khách

Sau khi chọn đủ ghế, chọn **Tiếp tục**. Mỗi ghế có họ tên bắt buộc và điện thoại tùy chọn; điểm đón hiển thị theo chuyến. Nhập tên, số di động Việt Nam và email của người liên hệ nhận vé, rồi chọn **Xác nhận thông tin**. Lỗi chỉ rõ trường cần sửa và đưa focus về trường đầu tiên. Khi đang lưu, các ô và nút xác nhận tạm khóa.

Lỗi kết nối giữ nguyên nội dung đang nhập để bạn xác nhận lại. Sau khi lưu thành công, quay lại hoặc refresh khôi phục thông tin theo đúng ghế; nội dung chưa lưu chưa được lưu qua refresh. Đồng hồ luôn dùng thời hạn giữ chỗ ban đầu. Hết hạn sẽ đưa tới hướng dẫn tìm chuyến mới. Nút xác nhận mở bước kiểm tra đặt vé trước khi tạo đơn và thanh toán mô phỏng.

## Kiểm tra trước khi thanh toán

Sau khi lưu hành khách, kiểm tra nhà xe, giờ đi/đến, điểm đón, ghế, tên hành khách và người liên hệ. Chọn các liên kết chỉnh sửa nếu cần. Mở **Xem chính sách mô phỏng** bằng chuột hoặc Enter/Space để đọc điều kiện; chính sách/hoàn tiền hiện chỉ mô phỏng. Tổng tiền bằng giá vé nhân số ghế, không có phí hay khuyến mãi bổ sung.

Chọn **Tiếp tục thanh toán** để xác nhận đặt vé. Nút tạm khóa khi gửi; nếu lỗi, thông tin và yêu cầu được giữ để thử lại, kể cả sau refresh. Sau khi tạo đơn, ghế/hành khách được khóa; quay lại chỉ xem lại và tiếp tục cùng đơn, không tạo thêm đơn. Thời hạn giữ chỗ vẫn là thời hạn ban đầu; hết hạn hướng dẫn tìm chuyến mới. Trang VNPay hiển thị tổng tiền và thông tin giao dịch mô phỏng.

## Thanh toán mô phỏng qua VNPay

Chọn **Tiếp tục đến VNPay** để tạo và kiểm tra giao dịch. Khi gửi, nút tạm khóa; nếu kết nối lỗi, chọn **Thử lại yêu cầu thanh toán** để tiếp tục cùng yêu cầu. Refresh giữ nguyên thời hạn giữ chỗ. Môi trường development có bốn nút mô phỏng, giao diện production chỉ có thanh toán/hủy; không có thu tiền thật hoặc kết nối ngân hàng.

- **Thanh toán thành công**: hiển thị các mã vé đã phát hành, xóa phiên đặt vé khỏi trình duyệt sau khi xác nhận đủ vé. Refresh không tạo thêm giao dịch hay vé. Liên kết mã vé yêu cầu tra cứu xác thực trước khi xem chi tiết; thanh toán thành công không tự cấp quyền xem vé.
- **Thanh toán chưa thành công** hoặc **Đã hủy thanh toán**: không phát hành vé; có thể thử lại cùng đơn khi thời hạn giữ chỗ còn hiệu lực.
- **Thanh toán đang chờ xác nhận**: chọn **Kiểm tra lại**; không tự chuyển thành thành công. Không tạo giao dịch mới khi giao dịch này còn chờ.

Nếu chưa nhận được kết quả, nút kiểm tra lại tiếp tục giao dịch hiện tại. Quay về bước thanh toán có thể hiện **Kiểm tra giao dịch hiện tại** thay cho tạo mới. Đường dẫn kết quả chỉ chứa hai mã giao dịch ngẫu nhiên, không chứa số điện thoại/email/hành khách. Sai đường dẫn có hướng dẫn về trang chủ; hết hạn giữ chỗ hướng dẫn tìm chuyến mới.

Dữ liệu mô phỏng lưu riêng trong tab cho refresh. Khi xóa dữ liệu tab hoặc quá thời gian lưu24 giờ, kết quả cũ có thể không còn. Đây là giới hạn môi trường thử nghiệm, không phải xác nhận thanh toán ngân hàng thực tế.

## Tra cứu và xem vé điện tử

Chọn **Tra cứu vé** trên menu hoặc từ trang yêu cầu xác thực. Nhập **Mã đặt vé** BLUE và **Email hoặc số điện thoại đã đặt vé** của người liên hệ, rồi chọn **Tra cứu vé** hoặc nhấn Enter. Email không phân biệt hoa/thường; số di động0 và +84 tương đương. Lỗi cần sửa hiện cạnh trường. Sai mã hoặc thông tin xác thực nhận cùng thông báo không tìm thấy vé; không đưa thông tin này vào đường dẫn.

Sau xác thực, trang **Vé điện tử** hiển thị một vé/ghế, tên hành khách, nhà xe, lịch trình/điểm đón, giá và tham chiếu VNPay mô phỏng. Có thể chuyển sang vé khác thuộc cùng đặt vé hoặc tra cứu vé khác. Refresh giữ quyền trong thời hạn15 phút ban đầu; không gia hạn. Hết hạn hoặc dữ liệu tab không hợp lệ sẽ xóa phiên và yêu cầu tra cứu lại. Lỗi kết nối có **Thử lại**; trình duyệt chặn lưu phiên sẽ yêu cầu cho phép lưu dữ liệu tab.

Biểu tượng QR chỉ minh họa mã vé, không dùng quét hoặc đi xe thật. Chưa có PDF/chia sẻ; hủy vé dùng luồng mô phỏng riêng được mô tả bên dưới. Toàn bộ đây là mô phỏng; không phải cơ chế xác thực production. Không chia sẻ dữ liệu lưu tab.

## Đăng nhập mô phỏng và xem vé của tôi

Mở **Đăng nhập**. Giao diện luôn ghi rõ không phải tài khoản thật. Dùng customer `test+review@example.invalid` hoặc admin `admin@blue.example.invalid`, cùng mật khẩu công khai `BlueDemo2026`; không nhập mật khẩu thật. Google/Facebook cũng là nút mô phỏng; development có lựa chọn thành công/lỗi để thử recovery.

Đăng ký yêu cầu họ tên, điện thoại, email, mật khẩu và xác nhận. Quên mật khẩu chỉ yêu cầu email. Cả hai trả cùng thông báo trung tính, không tạo tài khoản, không gửi email và không xác nhận email đã tồn tại. Session tab hết hạn sau một giờ; xóa dữ liệu tab hoặc chọn **Đăng xuất** sẽ yêu cầu đăng nhập lại.

Khách đăng nhập mở `/account/tickets` để xem vé **Đã phát hành** thuộc đúng fixture email. Trang có loading, empty, retry và link xem chi tiết; mã vé một mình không cấp quyền. Admin không mở được lịch sử khách và khách không mở được admin. Redirect sau login chỉ giữ route nội bộ hợp lệ; URL ngoài hệ thống hoặc query lạ bị đưa về trang mặc định an toàn.

## Hủy một phần và theo dõi hoàn tiền mô phỏng

Từ vé **Đã phát hành** hoặc **Vé của tôi**, chọn **Hủy vé**. Trang chỉ mở khi phiên tra cứu còn quyền với đúng vé trong đơn hoặc tài khoản khách đang sở hữu vé; nhập mã đặt vé/mã vé trong URL không tự cấp quyền. Chọn A01, A02 hoặc cả hai. Khi chưa chọn vé, nút tiếp tục bị khóa.

Chọn **Xem phí và tiền hoàn**, kiểm tra chính xác mã vé trong hộp xác nhận và số tiền ước tính. Policy hiện tại hoàn100% giá các vé chọn nhưng chỉ là dữ liệu mô phỏng. Sau xác nhận, giao diện hiện **VNPay đang xử lý hoàn tiền** cùng mã refund; không có giao dịch ngân hàng thật, ETA hoặc tự động chuyển trạng thái hoàn tất.

Chỉ vé đã chọn thành **Đã hủy**; vé còn lại vẫn **Đã phát hành**. Refresh trang chi tiết giữ trạng thái này. Trong **Vé của tôi**, dùng bộ lọc **Tất cả**, **Đã phát hành** hoặc **Đã hủy**. Gửi lại cùng yêu cầu không tạo thêm refund; vé đã hủy không thể hủy lại. Dữ liệu lưu trong tab và giới hạn như các mock khác, không thay quy trình hoàn tiền backend production.

## Tra cứu giao dịch trong trang quản trị

Admin có thể mở **Đơn đặt vé**, **Thanh toán** và **Hoàn tiền**, tìm theo từ khóa/trạng thái, phân trang bằng URL và mở từng dòng để xem chi tiết. Mã đơn, mã giao dịch và quan hệ booking/payment có liên kết nội bộ khi dữ liệu hỗ trợ. Đây là dữ liệu mô phỏng read-only; giao diện không thu tiền, hoàn tiền hoặc thay đổi trạng thái backend. Lỗi quyền và hồ sơ không tồn tại không có nút thử lại; lỗi mạng/dịch vụ có **Thử lại**.

Admin cũng có thể quản lý **Tổ chức** và **Nhân viên** bằng danh sách, trang chi tiết và hộp thoại thêm/chỉnh sửa. Đóng hoặc lưu hộp thoại giữ nguyên bộ lọc và trang hiện tại. Trên màn hình nhỏ, mở nút menu quản trị; bảng chuyển thành thẻ có nhãn để không phải cuộn ngang. Tất cả dữ liệu và thao tác hiện là mock trong development/test, không thay đổi backend thật.
