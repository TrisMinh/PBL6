# Dữ liệu PostgreSQL local

Repo có sẵn `PBL6-data-sample.zip`, tạo từ các migration và seed trong `docs/database` trên một PostgreSQL 17 mới. ZIP chứa sáu database (Identity, Transport, Booking, Payment, Notification và Reporting), checksum và script `Restore-PBL6Data.ps1`. Bộ seed có bốn tài khoản `example.test`, nhà xe, tuyến, chuyến và ghế mẫu.

## Build Docker và nạp data sau khi clone

Mở Docker Desktop ở chế độ Linux containers và chạy tại gốc repo:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\workspace\scripts\dev-docker.ps1 -RestoreData
```

Script dùng bản sao riêng mới nhất theo tên nếu có, hoặc dùng ZIP mẫu của repo. Script khởi động PostgreSQL, nạp sáu database rồi build và chạy toàn bộ Docker Compose. Lần nạp đầu cần volume PostgreSQL trống. Nếu cùng bản sao đã được nạp, script dùng lại dữ liệu hiện có. Nếu PostgreSQL có dữ liệu khác, script dừng trước khi nạp.

Dùng `-BackupPath` để chọn một ZIP cụ thể hoặc `-EnvFile` để truyền cấu hình SePay và Power BI. Chỉ dùng ZIP tin cậy vì bước khôi phục chạy `Restore-PBL6Data.ps1` bên trong. Bản sao dữ liệu từ máy cá nhân được bỏ qua khi commit và cần chuyển riêng nếu muốn khôi phục dữ liệu đó.

- Customer `http://localhost:5173`
- Operator `http://localhost:5174`
- Admin `http://localhost:5175`
