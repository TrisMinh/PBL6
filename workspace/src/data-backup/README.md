# Dữ liệu PostgreSQL local

Thư mục này giữ bản sao dữ liệu để chuyển máy. Bản sao ngày 19/11/2026 có tên `PBL6-data-20261119T054831Z.zip` và tương ứng với commit `084bc844`. ZIP chứa sáu database (Identity, Transport, Booking, Payment, Notification và Reporting), checksum và script `Restore-PBL6Data.ps1`.

## Build Docker và nạp data sau khi clone

Mở Docker Desktop ở chế độ Linux containers. Chép file `PBL6-data-*.zip` vào `workspace/src/data-backup/` và chạy tại gốc repo:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\workspace\scripts\dev-docker.ps1 -RestoreData
```

Script chọn ZIP mới nhất theo tên, khởi động PostgreSQL, nạp sáu database rồi build và chạy toàn bộ Docker Compose. Lần nạp đầu cần volume PostgreSQL trống. Nếu cùng bản sao đã được nạp, script dùng lại dữ liệu hiện có. Nếu PostgreSQL có dữ liệu khác, script dừng trước khi nạp.

Dùng `-BackupPath` nếu ZIP nằm ở nơi khác, hoặc `-EnvFile` nếu cần truyền cấu hình SePay và Power BI. Chỉ dùng ZIP tin cậy vì bước khôi phục chạy `Restore-PBL6Data.ps1` bên trong. ZIP và các file giải nén được bỏ qua khi commit và build image, nên cần chuyển ZIP riêng sang máy mới.

- Customer `http://localhost:5173`
- Operator `http://localhost:5174`
- Admin `http://localhost:5175`
