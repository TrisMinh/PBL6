# Dữ liệu PostgreSQL local

Thư mục này giữ bản sao dữ liệu để chuyển máy. Bản sao ngày 19/11/2026 có tên `PBL6-data-20261119T054831Z.zip` và tương ứng với commit `084bc844`. ZIP chứa sáu database (Identity, Transport, Booking, Payment, Notification và Reporting), checksum và script `Restore-PBL6Data.ps1`.

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
