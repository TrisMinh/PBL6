# Kế hoạch tối ưu hiệu năng PBL6

Đo trên cùng bộ dữ liệu và cấu hình Docker cho mỗi cặp trước/sau. Ghi số request, lượng dữ liệu, độ trễ p50/p95, lỗi và phạm vi kiểm thử. Mục tiêu tải đồng thời lấy từ [bộ kiểm thử NFR](../docs/detailed-design/03-06-test-design/06-performance-reliability-tests.md).

| Ưu tiên | Luồng | Thay đổi cần kiểm chứng | Điều kiện nghiệm thu |
|---|---|---|---|
| P0 | Customer tra vé | Tra theo mã vé/mã đơn ngay trên Booking; kiểm tra chủ sở hữu | Cùng kết quả cho vé và đơn cũ; khách khác và mã sai có cùng kết quả rỗng |
| P0 | Operator đơn đặt vé | Lọc và phân trang trên Booking; đọc mã ghế đã đặt từ cùng truy vấn | Tổng đúng sau lọc; giữ đủ ghế, trạng thái, múi giờ và ranh giới nhà xe |
| P0 | Operator báo cáo | Giới hạn dữ liệu theo khoảng ngày; nhóm số liệu một lượt | Tổng doanh thu, vé, khách và cấu phần chi tiết khớp cùng khoảng ngày |
| P1 | Customer tìm chuyến, Khám phá | Đo riêng truy vấn tìm chuyến, dữ liệu bộ lọc và kiểm tra tồn ghế; chuyển phần tổng hợp phù hợp xuống API | Giữ đủ lựa chọn lọc, thứ tự và kết quả bán hết; chọn ghế dựa trên tồn kho lúc giao dịch |
| P1 | Admin thanh toán/hoàn tiền, Operator hoàn tiền/lịch chuyến | Phân trang sau lọc, truy vấn thông tin liên quan theo nhóm và giới hạn dữ liệu theo ngữ cảnh | Tra mã liên dịch vụ và bộ lọc áp dụng trên toàn tập; mở chi tiết lịch sử vẫn được |
| P1 | Checkout, thanh toán, báo cáo | Đo thời gian khóa ghế, độ trễ webhook, độ trễ hàng đợi và thời gian báo cáo | Không trùng đặt vé, phát hành vé, thanh toán hoặc hoàn tiền khi có retry hay chạy đồng thời |
| P2 | Toàn hệ thống | Đo tải theo NFR và thử lỗi hạ tầng trên stack cách ly | Có thông số môi trường, kết quả theo percentile và chứng cứ bảo toàn dữ liệu |

Thực hiện lần lượt theo tác động và chi phí. Phân trang sau khi áp dụng phạm vi quyền, bộ lọc và thứ tự. So sánh dữ liệu và hành vi với bản đang chạy trước khi thay thế. Các tác vụ đo tải ghi dữ liệu dùng stack cách ly và giao dịch mô phỏng.

## Kết quả đợt đầu trên Docker local

| Luồng | Trước | Sau |
|---|---|---|
| Operator đặt chỗ, nhà xe có 8.079 đơn | 81 request tải danh sách, 2,28 giây cho riêng bước đó; 721 chuyến cần thêm sơ đồ ghế | Một request trả trang 10 đơn kèm mã ghế đã đặt và một request lấy chuyến theo ID của trang |
| Customer chi tiết vé theo mã | Dò lịch sử theo từng trang trước khi mở vé | Tra đúng mã bằng truy vấn có chỉ mục, rồi đọc chi tiết theo ID để giữ QR của vé đủ điều kiện |
| Customer tìm chuyến, khoảng 2.826 chuyến đủ điều kiện | Một truy vấn điểm đón trả cho từng chuyến | Một truy vấn điểm đón trả theo các tuyến trong trang; p50 quan sát từ 286 ms xuống 211 ms trên 5 mẫu API, 93–97 chuyến/trang |
| Operator doanh thu | Kỳ so sánh đợi kỳ hiện tại trả về | Hai kỳ độc lập được tải song song; báo cáo toàn thời gian chỉ tải kỳ hiện tại |

Đã kiểm tra phân trang không trùng, lọc ngày theo giờ Việt Nam, mã ghế khớp hành khách, và từ chối dữ liệu ngoài tài khoản hoặc nhà xe. Các số đo này là kiểm tra local trên dữ liệu demo hiện tại. Bước đo NFR với 300 người dùng đồng thời và các kịch bản cạnh tranh ghế, lỗi hạ tầng vẫn cần chạy trên stack cách ly.

## Đợt tối ưu toàn dự án

| Luồng | Thay đổi và cách đối chiếu |
|---|---|
| Admin thanh toán và hoàn tiền | Mỗi request danh sách trả tối đa số dòng của trang. Đối chiếu mã đơn trong Booking và lọc cùng trạng thái, nhà xe trước khi tính tổng. Bổ sung mã thanh toán gốc ngay trên trang hoàn tiền. Kiểm tra hai trang liên tiếp trên 110.094 thanh toán và 6.471 hoàn tiền. |
| Operator lịch chuyến và danh sách hành khách | PostgreSQL áp dụng ngày giờ Việt Nam, trạng thái, phân công, thứ tự rồi mới lấy trang 5 chuyến. Mở chi tiết theo ID. Danh sách hành khách đọc tổng đã đặt và đã check-in theo nhà xe bằng một truy vấn, đối chiếu với manifest chi tiết. |
| Operator hoàn tiền | Phân trang mặc định và khi lọc ngày/trạng thái ở Payment. Kết hợp dữ liệu theo nhóm ID cho tìm kiếm và mức chính sách, tải mã ghế hủy cho trang đang xem. Chi tiết tra theo mã hồ sơ hoặc mã đơn. |
| Customer tìm chuyến và khám phá | Cache ngắn theo phiên bản dữ liệu, gộp lượt đọc giống nhau đang chạy, thêm chỉ mục thời gian và giá. Các thẻ tuyến nổi bật dùng chung dữ liệu của ngày hiển thị. Tồn ghế đọc theo nhóm, tính ghế giữ đã hết hạn bằng truy vấn chỉ đọc. Thao tác giữ ghế tiếp tục xác thực và khóa trên DB. |
| Checkout, webhook và báo cáo | Kiểm thử DB cách ly gồm 32 lượt tranh cùng một ghế (1 thành công, 31 xung đột), 8 IPN SePay trùng (1 biên nhận và 1 sự kiện thành công), retry sau lỗi checkout và kiểm thử báo cáo. |
| Hàng đợi | Bộ Messaging chạy với PostgreSQL và RabbitMQ cách ly, kiểm tra khởi động lại broker, retry outbox, và hai replica cùng đọc hàng đợi. |

### Đo tải tìm chuyến

Bản sao Transport gồm 150.414 chuyến, 38.898 chuyến còn mở bán. Các chuyến bổ sung dùng tuyến, xe và giá từ bộ demo với thời gian dịch theo từng khoảng không trùng lịch. Môi trường Docker Linux 12 CPU, 7,6 GiB RAM, PostgreSQL 17, Redis 7 và một replica Transport. Client Node chạy trên cùng máy qua loopback, gọi trực tiếp dịch vụ. Làm nóng một lượt từng mẫu, sau đó 300 người dùng ảo chạy vòng lặp khép kín trong 60 giây. Hỗn hợp gồm tìm rộng, sắp xếp giá, trang sâu, theo tuyến/ngày và chi tiết. Percentile lấy theo thứ hạng gần nhất, bao gồm request lỗi và timeout.

| Bản | Tìm chuyến p50 | p95 | p99 | Lỗi | Chi tiết p95 |
|---|---:|---:|---:|---:|---:|
| Chỉ giới hạn pool | 95 ms | 7.845 ms | 8.998 ms | 50 / 9.081 | 6.995 ms |
| Thêm chỉ mục, đơn giản hóa truy vấn, cache và gộp lượt đọc | 81 ms | 151 ms | 251 ms | 0 / 147.302 | 139 ms |

Postman local dừng lần chạy đầu do bộ phát tải báo mức sử dụng bộ nhớ 97,11%. Hai hàng trên dùng cùng [script Node](../workspace/scripts/benchmark-search.mjs). Bản tối ưu xử lý 55.293 request chi tiết, 0 lỗi. Kiểm tra khi Transport không kết nối được Redis với 20 người dùng trong 10 giây cho p95 tìm chuyến 285 ms, 0 lỗi trên 1.337 lượt tìm. Bài tải 300 người dùng lặp các bộ lọc đại diện và dùng cache. Lưu lượng tìm kiếm phân tán hơn, chạy lâu, hoặc qua Gateway cần đo riêng.

Tồn ghế chạy riêng với bản sao Booking gồm 356.389 ghế. 300 người dùng trong 30 giây, mỗi lượt đọc 12 chuyến. Hoàn tất 58.487 request, p50 143 ms, p95 235 ms, p99 278 ms, 0 lỗi. Đã đối chiếu kết quả GET và POST theo nhóm trên Docker chính. Một danh mục khoảng 2.826 chuyến cần tối đa 3 request tồn ghế với nhóm 1.000 ID; lúc đo, danh mục còn đọc dữ liệu chuyến theo trang.

### Kiểm tra lại trên trình duyệt

Đo điều hướng Chrome qua ba cổng Docker với tài khoản demo, 22 màn hình gồm Khám phá, tỉnh thành, vé, lịch chuyến, đơn đặt vé, danh sách hành khách, hoàn tiền, báo cáo, đối soát và danh sách admin. Số request tính cả dữ liệu dùng chung của màn hình. Thời gian là một lượt quan sát điều hướng đến khi mạng ổn định, trừ thời gian chờ 500 ms của Playwright. Đây là phép đo local từng người dùng.

| Màn hình | Trước | Sau |
|---|---|---|
| Khám phá | 39 request, 11,55 giây | 8 request, 1,09 giây |
| Vé của tôi | 88 request, 58 KB dữ liệu API nén | 3 request, 19 KB, hiển thị đủ 78 vé |
| Đối soát nhà xe | 161 request, 5,59 giây | 5 request, 0,59–1,03 giây, đối chiếu đủ 7.663 dòng |
| Danh sách chuyến có hành khách | 14 request, 86 KB | 6 request, 43 KB, bảng hiển thị 10 chuyến mỗi trang |
| Thành viên tổ chức | 2 request, 0,56 giây | 2 request, 0,56 giây |

Trang Tìm chuyến hiện đọc một kết quả gọn với điểm đón trả dùng chung theo tuyến, cộng tối đa ba lượt đọc tồn ghế trên bộ dữ liệu hiện tại. Khám phá dùng kết quả gọn cho danh mục tỉnh thành. Vé của tôi lấy thông tin hành trình theo nhóm ID và tra đơn theo mã trong phạm vi chủ sở hữu. Đối soát lấy dữ liệu đầy đủ và mã đơn theo phạm vi nhà xe để giữ tổng tiền, bộ lọc, biên nhận và CSV. Danh sách hành khách tải các trường cần cho bảng và số hành khách theo nhóm.

Đã kiểm tra quyền sở hữu khi tra đơn, quyền nhà xe khi lấy mã đối soát, thứ tự và tổng số dòng đối soát so với API phân trang. Tải CSV trên trình duyệt trả đủ 7.663 dòng. TypeScript, 293 kiểm thử giao diện và 97 kiểm thử Transport, Booking, Payment và hợp đồng đều đạt. Một lượt mở trang Nhân viên dao động đến 1,55 giây, trong khi các danh sách admin khác và chi tiết thành viên tổ chức khoảng 0,56–0,58 giây ở lượt đo này.

Bài tải 300 người dùng đã ghi ở trên dùng API tìm chuyến phân trang. Kết quả gọn, danh sách đối soát đầy đủ, tải hỗn hợp qua Gateway và độ trễ phát hành vé đầu cuối cần phép đo tải riêng. Màn đối soát chuyển khoảng 829 KB dữ liệu API nén để giữ bộ lọc, tổng tiền và xuất CSV trên toàn bộ tập kết quả hiện tại.

### Kiểm tra giao dịch

- Giữ ghế p95 771 ms trong 32 request tranh cùng ghế. Thử lại sau khi giữ ghế hết hạn thành công và kiểm tra lượt đọc tồn ghế không thay đổi bản ghi.
- SePay IPN p95 63 ms trong 8 lượt giao cùng thông báo trên fixture, gồm ghi nhận giao dịch, đối soát và outbox. Các số này đo trên TestServer với PostgreSQL Docker và IPN mô phỏng.
- Bộ kiểm thử hồi phục nghiệp vụ và báo cáo đã chạy cùng các ca retry của Booking, Payment và RabbitMQ. Độ trễ webhook tới phát hành vé qua toàn bộ dịch vụ, kiểm tra dừng Notification/Reporting, failover DB và phục hồi PITR vẫn là các kịch bản cần đo riêng.
