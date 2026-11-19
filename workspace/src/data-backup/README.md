# Dữ liệu PostgreSQL local

Thư mục này giữ bản sao dữ liệu để chuyển máy. Bản sao ngày 19/11/2026 có tên `PBL6-data-20261119T054831Z.zip` và tương ứng với commit `084bc844`. ZIP chứa sáu database (Identity, Transport, Booking, Payment, Notification và Reporting), checksum và script `Restore-PBL6Data.ps1`.

## Cài trên máy Windows mới bằng một lệnh

Đặt [Setup-PBL6.ps1](../../../Setup-PBL6.ps1) cùng thư mục với ZIP riêng của bạn, rồi mở PowerShell trong thư mục đó và chạy. Script cài Git, WSL 2 và Docker Desktop khi thiếu, clone repo, nạp data rồi build và đợi các container khởi động. Máy mới cần Windows hỗ trợ WSL 2, WinGet và quyền bật tính năng hệ thống.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Setup-PBL6.ps1
```

Nếu Windows yêu cầu khởi động lại sau khi bật WSL, chạy lại cùng lệnh. Docker Desktop hoặc GitHub có thể yêu cầu xác nhận hoặc đăng nhập lần đầu. Chỉ dùng ZIP từ nguồn bạn tin cậy vì bộ khôi phục chạy script đi kèm. Dùng `-SeedOnly` nếu muốn khởi động bằng dữ liệu mẫu, hoặc `-EnvFile C:\DuongDan\pbl6.env` nếu đã có cấu hình tích hợp cần dùng. Script giữ nguyên database hiện có khi chạy lại.

## Khôi phục thủ công

Khi dựng Docker trên máy mới, chép ZIP vào thư mục này và chạy từ gốc repo. Nếu có nhiều bản sao, chọn bản mới nhất phù hợp với nhánh đang chạy. PostgreSQL phải dùng volume mới. Script kiểm tra checksum và từ chối khôi phục nếu database đích đã có đối tượng.

```powershell
$archive = Get-Item workspace/src/data-backup/PBL6-data-20261119T054831Z.zip -ErrorAction Stop
$extracted = Join-Path $archive.DirectoryName ('restore-' + [Guid]::NewGuid().ToString('N'))
Expand-Archive -LiteralPath $archive.FullName -DestinationPath $extracted -ErrorAction Stop
$restore = Join-Path (Join-Path $extracted $archive.BaseName) 'Restore-PBL6Data.ps1'

Push-Location workspace/src/infra
try {
    docker compose -f docker-compose.yml up -d --wait postgres
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL startup failed' }
    $postgres = docker compose -f docker-compose.yml ps -q postgres
    if ($LASTEXITCODE -ne 0 -or -not $postgres) { throw 'PostgreSQL container not found' }
    & $restore -Container $postgres
    docker compose -f docker-compose.yml -f docker-compose.apps.yml up -d --build --wait
    if ($LASTEXITCODE -ne 0) { throw 'Application startup failed' }
} finally {
    Pop-Location
}
```

Sau khi stack healthy, Customer mở tại `http://localhost:5173`, Operator tại `http://localhost:5174` và Admin tại `http://localhost:5175`. Redis tự tạo lại cache. Cấu hình SePay và kết nối Power BI được thiết lập riêng nếu cần.

ZIP và các file giải nén chứa dữ liệu riêng tư. Git và Docker build context bỏ qua chúng. Chuyển ZIP cùng repo qua kênh riêng nếu muốn giữ dữ liệu hiện tại khi đổi máy.
