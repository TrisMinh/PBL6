# Power BI cho báo cáo doanh thu nhà xe

Trong portal Operator, mục **Power BI** có tệp `operator-dashboard-demo.pbix` đã nạp dữ liệu mẫu. Mở trực tiếp bằng Power BI Desktop. Nếu cần sửa các tệp nguồn của report và semantic model, tải `operator-dashboard.zip`, giải nén, mở `OperatorDashboard.pbip` và chọn **Refresh**. Dự án có hai trang. Trang **Vận hành** có KPI khách, đơn, vé, vé đã check-in và ma trận **ngày đặt × tuyến × kênh thanh toán**. Trang **Tài chính** có số liệu thu, hoàn và đối soát theo ngày giao dịch và tiền tệ.

Tạo lại gói mẫu bằng `python workspace/analytics/power-bi/build_operator_dashboard.py`. Để tạo dự án riêng chỉ đọc PostgreSQL, chạy từ gốc repository trong PowerShell.

```powershell
python workspace/analytics/power-bi/build_operator_dashboard.py --live `
  --server 127.0.0.1:55474 `
  --output "$env:LOCALAPPDATA/BLUE/PowerBI/operator-dashboard-live.zip"
```

Đổi máy chủ và các tham số `--booking-db`, `--reporting-db` theo môi trường. Bản live luôn đọc `bi.operator_booking_activity` và `bi.operator_revenue_daily`. ZIP chỉ chứa định nghĩa báo cáo, mô hình và địa chỉ kết nối. Power BI lưu thông tin xác thực của nguồn dữ liệu riêng. Với PostgreSQL nội bộ, cấu hình gateway và thông tin xác thực riêng của đúng nhà xe trước khi bật lịch refresh. Chỉ đổi URL nhúng sau khi đã xác nhận lần refresh đầu tiên và quyền xem ở Power BI Service.

Khi chạy Docker local bằng `scripts/start-frontend.ps1` hoặc `scripts/start-sepay-local.ps1`, gateway vẫn kết nối PostgreSQL qua `127.0.0.1:55474`. Dùng cùng địa chỉ này cho hai kết nối Booking và Reporting trong Power BI Service.

Trang `/operator/reports` và Power BI dùng cùng số liệu tổng hợp theo **nhà xe, ngày nghiệp vụ tại Việt Nam và tiền tệ**. API đọc `bi.revenue_daily`, còn kết nối Power BI của từng nhà xe đọc `bi.operator_revenue_daily`. Payment và Reporting tự áp dụng các migration khi khởi động. Migration Payment tạo sự kiện cho giao dịch lịch sử và gửi qua outbox. Báo cáo được cập nhật khi Reporting xử lý xong các sự kiện.

Chạy cổng Operator với `VITE_API_MODE=live` để mở báo cáo tài chính. Khởi động lại Identity, Payment và Reporting khi triển khai phiên bản này, rồi đăng nhập lại để phiên nhận vai trò của đúng nhà xe đang hoạt động. Quyền xem báo cáo dành cho `OPERATOR_ADMIN` và `OPERATOR_FINANCE` của nhà xe đó. Chế độ mock của cổng vẫn dùng màn hình minh họa.

## Cấp tài khoản đọc

DBA tạo một PostgreSQL login chuyên dụng cho mỗi nhà xe trong database `reporting`. Đặt mật khẩu bằng trình quản lý bí mật hoặc dùng `\password` trong psql. Ví dụ dưới đây dùng UUID minh họa. Thay UUID bằng định danh nhà xe thật và đổi tên role cho từng kết nối.

```sql
CREATE ROLE pbi_operator_a LOGIN;
GRANT CONNECT ON DATABASE reporting TO pbi_operator_a;
GRANT USAGE ON SCHEMA bi TO pbi_operator_a;
GRANT SELECT ON bi.operator_revenue_daily TO pbi_operator_a;
INSERT INTO bi.operator_reader_scope(login_name, organization_id_external)
VALUES ('pbi_operator_a', '00000000-0000-0000-0000-000000000001');
```

Trong database `booking`, cấp thêm `CONNECT`, `USAGE ON SCHEMA bi` và `SELECT ON bi.operator_booking_activity` cho login này, rồi thêm cùng ánh xạ vào `bi.operator_reader_scope` của Booking. Dữ liệu vận hành không chứa thông tin liên hệ. Khóa khách trong semantic model là mã giả danh theo nhà xe để tính khách duy nhất trên toàn bộ bộ lọc. Số khách là số tài khoản đặt có ít nhất một vé hợp lệ. Vé đã check-in là số vé ở trạng thái check-in hoặc đã sử dụng trong nhóm đơn theo ngày đặt.

Nếu cần nhúng trong portal, publish dự án lên Power BI Service, lấy URL từ **Embed report → Website or portal**, rồi đặt `VITE_OPERATOR_POWER_BI_EMBED_URL` khi build frontend. URL chỉ cấu hình vị trí báo cáo; quyền xem phải được cấp và kiểm tra trong Power BI. Vì cấu hình URL dùng chung cho bản triển khai frontend, khi có nhiều nhà xe hãy dùng semantic model áp dụng RLS cho các tài khoản Power BI hoặc triển khai URL riêng cho mỗi nhà xe. [Nhúng Power BI có xác thực](https://learn.microsoft.com/en-us/power-bi/service-embed-secure)

View chỉ trả dữ liệu của login PostgreSQL đang kết nối. Cấp quyền riêng cho view này và kiểm tra quyền thừa kế trước khi phân phối. Khi hủy quyền truy cập, xóa ánh xạ login, thu hồi quyền hoặc vô hiệu hóa login. Với Power BI Service, dùng thông tin xác thực riêng của nhà xe cho từng semantic model, cấu hình gateway nếu PostgreSQL ở mạng riêng và phân quyền workspace tương ứng. File Power BI sau Import có thể chứa dữ liệu tài chính đã tải.

## Dựng trang Revenue trong Power BI Desktop

1. Tạo hai tham số Text `ReportingServer` và `ReportingDatabase`. Đặt tên máy chủ theo môi trường, và dùng `reporting` cho cấu hình mặc định.
2. Tạo **Blank Query** tên `RevenueDaily`, dán nội dung từ [RevenueDaily.pq](RevenueDaily.pq) vào Advanced Editor. Dùng thông tin đăng nhập ở trên và chọn chế độ Import.
3. Tạo `DimDate` và `DimCurrency`. Nối `DimDate[Date]` (1) đến `RevenueDaily[period_date]` (*) và `DimCurrency[currency]` (1) đến `RevenueDaily[currency]` (*), theo chiều lọc từ bảng danh mục sang bảng số liệu. Đánh dấu `DimDate` là Date table. Dùng slicer theo khoảng ngày và slicer tiền tệ chọn một giá trị. [Hướng dẫn bảng ngày của Microsoft](https://learn.microsoft.com/en-us/power-bi/guidance/model-date-tables)

```dax
DimDate =
VAR FirstDate = COALESCE(MIN(RevenueDaily[period_date]), TODAY())
VAR LastDate = COALESCE(MAX(RevenueDaily[period_date]), TODAY())
RETURN
CALENDAR(
    DATE(YEAR(FirstDate) - 1, 1, 1),
    DATE(YEAR(LastDate), 12, 31)
)

DimCurrency = DISTINCT(RevenueDaily[currency])
```

Tạo các measure dưới đây riêng từng cái. Các measure tiền để trống nếu có nhiều loại tiền trong ngữ cảnh bộ lọc.

```dax
Tiền thu = IF(HASONEVALUE(DimCurrency[currency]), COALESCE(SUM(RevenueDaily[gross_revenue]), 0))
Tiền hoàn = IF(HASONEVALUE(DimCurrency[currency]), COALESCE(SUM(RevenueDaily[refund_amount]), 0))
Thu ròng = IF(HASONEVALUE(DimCurrency[currency]), COALESCE(SUM(RevenueDaily[net_revenue]), 0))
Hoa hồng = IF(HASONEVALUE(DimCurrency[currency]), COALESCE(SUM(RevenueDaily[platform_commission]), 0))
Phải trả nhà xe = IF(HASONEVALUE(DimCurrency[currency]), COALESCE(SUM(RevenueDaily[operator_payable]), 0))
Chênh lệch đối soát = IF(HASONEVALUE(DimCurrency[currency]), COALESCE(SUM(RevenueDaily[unsettled_amount]), 0))
Lượt thu = SUM(RevenueDaily[payment_count])
Lượt hoàn = SUM(RevenueDaily[refund_count])
Dữ liệu nguồn ghi nhận đến = MAX(RevenueDaily[data_as_of])

Thu ròng kỳ trước =
VAR FirstDay = MIN(DimDate[Date])
VAR LastDay = MAX(DimDate[Date])
VAR DaysInPeriod = DATEDIFF(FirstDay, LastDay, DAY) + 1
RETURN
    CALCULATE(
        [Thu ròng],
        FILTER(ALL(DimDate), DimDate[Date] >= FirstDay - DaysInPeriod && DimDate[Date] < FirstDay)
    )
```

Đặt các KPI ở đầu trang, biểu đồ cột cho tiền thu và hoàn theo ngày, sau đó là bảng đối soát dùng cùng measure. Ghi rõ múi giờ, tiền tệ và thời điểm làm mới semantic model. `data_as_of` là thời điểm Reporting ghi dòng gần nhất trong bộ lọc. Theo dõi độ trễ outbox và lịch sử refresh độc lập với mốc này.

## Đối soát trước khi chia sẻ

- Thanh toán thành công tính theo ngày thu. Hoàn thành công tính theo ngày hoàn. Kỳ chỉ có hoàn tiền có thể âm. Đơn `PAY_LATER` không phát sinh tiền thu hộ trên nền tảng.
- Hoa hồng và phải trả lấy từ biến động settlement. Với dữ liệu lịch sử, ngày thu và hoàn được tái tạo từ giao dịch cùng tỷ lệ trong settlement. Điều chỉnh còn lại để khớp số dư được ghi theo ngày settlement cập nhật cuối. Khoản phải trả thể hiện nghĩa vụ đối soát trước chuyển tiền.
- So API, CSV của Operator và bảng Power BI cùng kỳ, cùng nhà xe, cùng tiền tệ. Kiểm tra từng ngày, tổng kỳ và chênh lệch đối soát. Login nhà xe A chỉ được trả về dòng A khi dữ liệu có cả A và B. Login chưa ánh xạ trả về bảng rỗng.
- Dùng PostgreSQL thử nghiệm riêng khi chạy suite backend bên ngoài Docker. Đặt `REPORTING_TEST_POSTGRES` thành connection string của database trống dành cho kiểm thử.

## Theo dõi đồng bộ

Payment phát `RevenueMovementRecorded` từ cùng giao dịch ghi thanh toán, hoàn tiền hoặc settlement. Reporting chấp nhận sự kiện theo khóa nghiệp vụ duy nhất của bút toán. Gửi lại cùng bút toán không làm thay đổi tổng. Để kiểm tra độ trễ, theo dõi tuổi bản ghi `RevenueMovementRecorded` chưa publish trong Payment và chiều sâu queue `reporting.integration-events.q` cùng dead-letter queue. Khi cần phục hồi, có thể phát lại các sự kiện đã lưu trong outbox theo cùng khóa nghiệp vụ. Một lần refresh Power BI thành công chỉ xác nhận semantic model đã đọc được trạng thái nguồn tại thời điểm refresh.

## Kích hoạt refresh bản live bằng PowerShell

Sau khi xuất bản dự án PostgreSQL-only vào workspace riêng của nhà xe và đăng ký hai kết nối PostgreSQL trong gateway, dùng `Enable-OperatorPowerBIRefresh.ps1` với các tham số `WorkspaceId`, `DatasetId`, `ReportId`, `GatewayId`, `BookingDatasourceId` và `ReportingDatasourceId`. Truyền token Power BI REST API của chủ semantic model qua biến môi trường `BLUE_POWERBI_ACCESS_TOKEN` trong phiên PowerShell. Xác minh các kết nối gateway dùng login PostgreSQL chỉ đọc đã ánh xạ đúng nhà xe trước khi chạy.

Script kiểm tra report trỏ đúng model, gắn hai nguồn gateway, gọi refresh và đối chiếu request ID trong lịch sử. Chỉ sau khi refresh hoàn tất, script bật lịch hằng ngày lúc 06:00 giờ Việt Nam (đổi bằng `-RefreshTime`) và in URL nhúng. Đối soát số liệu và quyền xem trước khi đưa URL này vào cấu hình của bản triển khai Operator dành cho nhà xe đó.

## Bản live DirectQuery

```powershell
python workspace/analytics/power-bi/build_operator_dashboard.py --live --direct-query `
  --server 127.0.0.1:55474 `
  --output "$env:LOCALAPPDATA/BLUE/PowerBI/operator-dashboard-direct-query.zip"
```

Xuất bản gói với `Publish-OperatorPowerBI.ps1 -Name 'BLUE Operator DirectQuery'` vào workspace có quyền xem phù hợp. Trong Power BI Service, gắn lại hai kết nối PostgreSQL Booking và Reporting đã giới hạn theo nhà xe. Chạy thử truy vấn DAX trên cả hai bảng trước khi đổi `OPERATOR_POWER_BI_EMBED_URL` cho Docker. Các phép đổi nhãn và định dạng ngày của bản DirectQuery chạy trong câu SELECT PostgreSQL để trình kết nối có thể áp bộ lọc tại nguồn.

Các visual DirectQuery lấy dữ liệu từ PostgreSQL khi chạy truy vấn. Bản này dùng nút làm mới visual hoặc thao tác bộ lọc để truy vấn lại. Nếu bật Automatic Page Refresh, workspace chia sẻ chỉ cho chu kỳ từ 30 phút. [Giới hạn Automatic Page Refresh của Microsoft](https://learn.microsoft.com/power-bi/create-reports/desktop-automatic-page-refresh)
