# Dữ liệu PostgreSQL local

Setup mặc định khởi tạo project Docker `pbl6-operating` và nạp dữ liệu vận hành giả lập vào sáu database. Repo giữ `PBL6-data-sample.zip` để khôi phục bộ seed kỹ thuật khi cần tái hiện ca kiểm thử cũ.

## Setup một lệnh trên Windows

Giải nén gói mã nguồn đầy đủ hoặc lấy đúng phiên bản repo, rồi chạy từ thư mục chứa `Setup-PBL6.ps1`.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Setup-PBL6.ps1
```

Trên máy đã có Docker Desktop, lệnh kiểm tra Linux engine, phiên bản Compose và các tệp nguồn trước khi build. Docker tải các image và thư viện build còn thiếu. .NET, Node.js, pnpm và PostgreSQL chạy trong Docker. Script đợi các dịch vụ khởi động, nạp bộ dữ liệu vận hành vào sáu database và kiểm tra Gateway cùng ba cổng web. Nếu Docker Desktop cần hoàn tất thiết lập hoặc khởi động lại Windows, chạy lại cùng lệnh sau khi hoàn tất.

Chạy lại để build và cập nhật dịch vụ trên volume hiện có. Bộ dữ liệu đã nạp thành công được nhận diện và bỏ qua. Nếu nạp bị gián đoạn, script tiếp tục với cùng mốc lịch.

Nếu Docker đang chạy project cũ `pbl6-local` trên cùng cổng, dừng project đó trong Docker Desktop rồi chạy setup. Volume của project cũ vẫn giữ nguyên.

Redis và RabbitMQ dùng mạng nội bộ Docker. Các cổng web của setup mặc định chỉ mở trên localhost. PostgreSQL của `pbl6-operating` mở tại `127.0.0.1:55475` để [Power BI gateway trên cùng máy Windows](../../analytics/power-bi/README.md) đọc dữ liệu.

Để khôi phục snapshot cũ vào volume riêng, dùng `-ProjectName pbl6-legacy -RestoreData` hoặc thay `-RestoreData` bằng `-BackupPath` với đường dẫn ZIP. Các project dùng cùng cổng localhost cần chạy lần lượt. Nếu database dịch vụ đã có bảng, setup giữ dữ liệu đó và tiếp tục. Chỉ dùng ZIP tin cậy vì bước khôi phục chạy `Restore-PBL6Data.ps1` bên trong. Thêm `-EnvFile` nếu cần SePay Sandbox hoặc Power BI nhúng.

- Customer `http://localhost:5173`
- Operator `http://localhost:5174`
- Admin `http://localhost:5175`

## Dữ liệu vận hành quy mô lớn

Bộ dữ liệu được nạp tự động qua `Setup-PBL6.ps1` hoặc `workspace/scripts/dev-docker.ps1`. Để chạy riêng bộ nạp sau khi stack đã khởi động và các service đã áp dụng migration, dùng lệnh sau.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\workspace\scripts\load-operating-demo.ps1
```

Dữ liệu giả lập gồm 16 nhà xe, 12.000 khách, 320 xe, 320 hồ sơ tài xế, 96 tuyến hai chiều theo từng nhà xe và hơn 11.000 chuyến. Lịch tính theo giờ Việt Nam, từ 90 ngày trước đến 30 ngày sau lần nạp đầu tiên. Lịch sử có đặt một hoặc nhiều ghế, trả trước và trả tại nhà xe, vé có mã QR, check-in, hủy vé, hoàn tiền, bảng kê doanh thu và đối soát tuần.

| Cổng | Tài khoản | Mật khẩu |
|---|---|---|
| Customer | `customer.00001@demo.blue.example.test` | `CustomerPass1` |
| Operator · Hải Vân Lam | `operator.01@demo.blue.example.test` | `CustomerPass1` |
| Operator · Cánh Buồm Sông Hàn | `operator.02@demo.blue.example.test` | `CustomerPass1` |
| Operator · Đường Mây Kinh Bắc | `operator.03@demo.blue.example.test` | `CustomerPass1` |
| Operator · Tài chính Hải Vân Lam | `finance.01@demo.blue.example.test` | `CustomerPass1` |
| Admin | `admin@demo.blue.example.test` | `CustomerPass1` |

Trong Customer, mở **Vé của tôi** để xem lịch sử hoặc tìm **Đà Nẵng → Huế** trong 30 ngày sau lần nạp. Trong Operator, mở lịch chuyến, danh sách hành khách, báo cáo và đối soát của Hải Vân Lam. Trong Admin, tìm các nhà xe có mã `DEMO01` đến `DEMO16`.

Script chỉ nạp vào PostgreSQL của Docker local. Bản ghi được tạo bằng định danh cố định và lệnh nạp thêm giữ dữ liệu hiện có. Nếu quá trình bị ngắt, chạy lại cùng lệnh để tiếp tục với mốc lịch cũ. Thêm `-DryRun` để chạy các phép kiểm tra và rollback từng database. Tài khoản, giấy phép, biển số, chứng từ và thông báo đều giả lập. Dữ liệu lịch sử không gửi thông báo hoặc tạo giao dịch với nhà cung cấp thanh toán. Các đơn mới tạo qua giao diện dùng cấu hình thanh toán của stack đang chạy.
