# Power BI cho báo cáo doanh thu nhà xe

## Nhúng tự động cho nhà xe mới

Chế độ nhúng bằng ứng dụng dùng một báo cáo và một semantic model có RLS động. Portal gọi `POST /api/v1/reports/power-bi/embed`; Reporting lấy UUID nhà xe hoạt động từ JWT, kiểm tra vai trò `OPERATOR_ADMIN` hoặc `OPERATOR_FINANCE` trong nhà xe rồi cấp embed token chỉ đọc. Cả hai bảng dùng vai trò `BlueOperator` để lọc theo UUID. Nhà xe mới dùng cùng luồng sau khi đăng nhập và dữ liệu xuất hiện ngay khi nguồn DirectQuery có bản ghi.

1. Chuẩn bị một workspace chuyên dụng trên Power BI Embedded hoặc Fabric capacity. Cho ứng dụng Microsoft Entra chạy Power BI API và cấp quyền cho service principal trong workspace. Giới hạn quyền quản trị workspace và quyền đọc semantic model chứa dữ liệu nhiều nhà xe.
2. Tạo gói DirectQuery có RLS, xuất bản với tên mới bằng `Publish-OperatorPowerBI.ps1`, sau đó gắn hai nguồn PostgreSQL vào gateway. Bản chạy mặc định bằng `Setup-PBL6.ps1` dùng `127.0.0.1:55475`.

   ```powershell
   python workspace/analytics/power-bi/build_operator_dashboard.py --live --direct-query --embedded `
     --server 127.0.0.1:55475 `
     --output "$env:LOCALAPPDATA/BLUE/PowerBI/operator-dashboard-embedded.zip"
   ```

3. Dùng một login PostgreSQL chuyên dụng cho gateway. Cấp `CONNECT` và `USAGE ON SCHEMA bi` trong từng database. Chỉ cấp `SELECT` trên `bi.embedded_booking_activity` trong Booking và `bi.embedded_revenue_by_booking` trong Reporting. Hai view này chứa dữ liệu nhiều nhà xe. Lưu thông tin đăng nhập trong gateway và hạn chế người được dùng kết nối.
4. Đặt `POWER_BI_EMBED_ENABLED=true` cùng `POWER_BI_TENANT_ID`, `POWER_BI_CLIENT_ID`, `POWER_BI_CLIENT_SECRET`, `POWER_BI_WORKSPACE_ID`, `POWER_BI_REPORT_ID` và `POWER_BI_DATASET_ID` cho Reporting qua môi trường triển khai. Chỉ lưu secret ở phía máy chủ. Khi chạy trực tiếp bằng .NET, dùng các khóa tương ứng trong mục `PowerBi`. Tạo lại Reporting container để đọc cấu hình.
5. Trước khi cho người dùng truy cập, thử token nhúng thật với hai nhà xe có dữ liệu khác nhau và một nhà xe mới. Kiểm tra cả hai bảng, trang Chi tiết đơn hàng và việc từ chối tài khoản thiếu vai trò. [Cấu hình Power BI Embedded với service principal](https://learn.microsoft.com/power-bi/developer/embedded/embed-service-principal)

Khi chế độ này tắt, portal dùng các liên kết nhúng đã cấu hình cho môi trường demo. Khi đã bật, lỗi cấu hình, quyền hoặc gateway được hiển thị ngay trên tab.

## Báo cáo mẫu và báo cáo riêng theo nhà xe

Trong portal Operator, mục **Power BI** có tệp `operator-dashboard-demo.pbix` đã nạp dữ liệu mẫu và gói nguồn `operator-dashboard.zip`. Để dùng gói nguồn, giải nén, mở `OperatorDashboard.pbip` trong Power BI Desktop và chọn **Refresh**. Trang **Vận hành** có KPI khách, đơn, vé và vé đã check-in. Trang **Tài chính** có số liệu thu, hoàn và đối soát theo ngày giao dịch và tiền tệ.

Trong **Tài chính**, chọn ngày giao dịch và một loại tiền tệ. Chọn một thanh trong **Doanh thu theo tuyến · Thu ròng**, rồi bấm **Xem đơn của tuyến đã chọn**. Trang **Chi tiết đơn hàng** giữ bộ lọc và cộng các khoản thu, hoàn của từng mã đơn trong khoảng ngày đã chọn. Nút **Quay lại Tài chính** trở về trang nguồn. Dữ liệu mẫu VND của tuyến **Đà Nẵng – Hà Nội** từ 17–18/11/2026 gồm hai đơn với tổng thu ròng 399.999 ₫.

Tạo lại gói mẫu bằng `python workspace/analytics/power-bi/build_operator_dashboard.py`. Để tạo dự án riêng chỉ đọc PostgreSQL, chạy từ gốc repository trong PowerShell.

```powershell
python workspace/analytics/power-bi/build_operator_dashboard.py --live `
  --server 127.0.0.1:55475 `
  --output "$env:LOCALAPPDATA/BLUE/PowerBI/operator-dashboard-live.zip"
```

Đổi máy chủ và các tham số `--booking-db`, `--reporting-db` theo môi trường. Bản live đọc `bi.operator_booking_activity` và `bi.operator_revenue_by_booking`. ZIP chỉ chứa định nghĩa báo cáo, mô hình và địa chỉ kết nối. Power BI lưu thông tin xác thực của nguồn dữ liệu riêng. Với PostgreSQL nội bộ, cấu hình gateway và thông tin xác thực riêng của đúng nhà xe trước khi bật lịch refresh. Chỉ đổi URL nhúng sau khi đã xác nhận lần refresh đầu tiên và quyền xem ở Power BI Service.

Dùng `127.0.0.1:55475` cho hai kết nối Booking và Reporting của `pbl6-operating` khi chạy `Setup-PBL6.ps1` hoặc `workspace/scripts/dev-docker.ps1`. Cả hai kết nối dùng chung container PostgreSQL và chọn database tương ứng. Cấp login chỉ đọc theo nhà xe trước khi gắn gateway cho mô hình mới.

Trang `/operator/reports` và Power BI dùng cùng sổ giao dịch theo **nhà xe, ngày nghiệp vụ tại Việt Nam và tiền tệ**. API đọc `bi.revenue_daily`. Power BI đọc số liệu theo ngày giao dịch, tiền tệ và mã đơn từ `bi.operator_revenue_by_booking`. Khi chưa nhận được thông tin đơn, khoản thu hoặc hoàn vẫn xuất hiện trong nhóm **Chưa xác định tuyến**. Khi Reporting xử lý xong dữ liệu đơn, lần refresh tiếp theo sẽ gắn khoản đó với đúng tuyến và mã đơn.

Triển khai Reporting trước Booking và Payment để consumer có thể xử lý sự kiện bổ sung cho các đơn và giao dịch lịch sử. Chờ Reporting xử lý xong đợt backfill trước khi refresh mô hình. Chạy cổng Operator với `VITE_API_MODE=live` để mở báo cáo tài chính. Quyền xem báo cáo dành cho `OPERATOR_ADMIN` và `OPERATOR_FINANCE` của nhà xe đang hoạt động.

## Cấp tài khoản đọc

DBA tạo một PostgreSQL login chuyên dụng cho mỗi nhà xe trong database `reporting`. Đặt mật khẩu bằng trình quản lý bí mật hoặc dùng `\password` trong psql. Ví dụ dưới đây dùng UUID minh họa. Thay UUID bằng định danh nhà xe thật và đổi tên role cho từng kết nối.

```sql
CREATE ROLE pbi_operator_a LOGIN;
GRANT CONNECT ON DATABASE reporting TO pbi_operator_a;
GRANT USAGE ON SCHEMA bi TO pbi_operator_a;
GRANT SELECT ON bi.operator_revenue_by_booking TO pbi_operator_a;
INSERT INTO bi.operator_reader_scope(login_name, organization_id_external)
VALUES ('pbi_operator_a', '00000000-0000-0000-0000-000000000001');
```

Với tài khoản đã cấp từ trước, thêm quyền `SELECT` trên view mới trước khi chuyển báo cáo sang mô hình drill-through. View `bi.operator_revenue_daily` vẫn phục vụ các báo cáo tổng hợp đang dùng. Trong database `booking`, cấp thêm `CONNECT`, `USAGE ON SCHEMA bi` và `SELECT ON bi.operator_booking_activity` cho login này, rồi thêm cùng ánh xạ vào `bi.operator_reader_scope` của Booking. Khóa khách trong semantic model là mã giả danh theo nhà xe để tính khách duy nhất. Vé đã check-in là số vé ở trạng thái check-in hoặc đã sử dụng.

Để nhúng trong portal, publish dự án lên Power BI Service, lấy URL từ **Embed report → Website or portal**, rồi đặt `VITE_OPERATOR_POWER_BI_EMBED_URL` khi build frontend. Với báo cáo của một nhà xe, đặt `VITE_OPERATOR_POWER_BI_ORGANIZATION_ID` thành UUID đã ánh xạ cho login PostgreSQL. Trong Docker, dùng `OPERATOR_POWER_BI_EMBED_URL` và `OPERATOR_POWER_BI_ORGANIZATION_ID`. Portal hiển thị liên kết khi phiên Operator đang ở đúng nhà xe. Quyền xem của tài khoản Microsoft vẫn do Power BI Service kiểm soát. Với một mô hình phục vụ nhiều nhà xe, cấu hình RLS cho các tài khoản Power BI. [Nhúng Power BI có xác thực](https://learn.microsoft.com/en-us/power-bi/service-embed-secure)

Nếu dùng báo cáo riêng cho nhiều nhà xe trong cùng portal, đặt `VITE_OPERATOR_POWER_BI_REPORTS` (`OPERATOR_POWER_BI_REPORTS` trong Docker) thành một đối tượng JSON có khóa là UUID nhà xe và giá trị là URL nhúng tương ứng. Khi có cấu hình này, portal chọn URL theo nhà xe của phiên đăng nhập.

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

Khi nâng cấp báo cáo nhúng lên phiên bản có drill-through, tạo tên mới khi gọi `Publish-OperatorPowerBI.ps1`, chẳng hạn `-Name 'BLUE Operator Live Drill-through'`. Script dùng lại các item trùng tên trong workspace. Kiểm tra thao tác mở đơn và quay lại với báo cáo ở URL mới trước khi cấu hình Operator dùng URL đó.

## Bản live DirectQuery

```powershell
python workspace/analytics/power-bi/build_operator_dashboard.py --live --direct-query `
  --server 127.0.0.1:55475 `
  --output "$env:LOCALAPPDATA/BLUE/PowerBI/operator-dashboard-direct-query.zip"
```

Xuất bản gói với `Publish-OperatorPowerBI.ps1 -Name 'BLUE Operator DirectQuery'` vào workspace có quyền xem phù hợp. Trong Power BI Service, gắn lại hai kết nối PostgreSQL Booking và Reporting đã giới hạn theo nhà xe. Chạy thử truy vấn DAX trên cả hai bảng trước khi đổi `OPERATOR_POWER_BI_EMBED_URL` cho Docker. Các phép đổi nhãn và định dạng ngày của bản DirectQuery chạy trong câu SELECT PostgreSQL để trình kết nối có thể áp bộ lọc tại nguồn.

Các visual DirectQuery lấy dữ liệu từ PostgreSQL khi chạy truy vấn. Bản này dùng nút làm mới visual hoặc thao tác bộ lọc để truy vấn lại. Nếu bật Automatic Page Refresh, workspace chia sẻ chỉ cho chu kỳ từ 30 phút. [Giới hạn Automatic Page Refresh của Microsoft](https://learn.microsoft.com/power-bi/create-reports/desktop-automatic-page-refresh)
