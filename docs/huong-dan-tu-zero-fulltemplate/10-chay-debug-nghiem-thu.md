# 10 — Chạy, debug và nghiệm thu

## 1. Restore/build sạch

```powershell
Set-Location workspace
dotnet restore
dotnet build
npm install
npm run build:web
```

Không chạy app khi build đang đỏ.

## 2. Cách A — Infra trong Docker, app trên host

Terminal 1:

```powershell
docker compose -f src/infra/docker-compose.yml up -d --wait
```

Terminal 2:

```powershell
./scripts/dev-host.ps1
```

Terminal 3 và 4:

```powershell
npm run dev:customer
```

```powershell
npm run dev:backoffice
```

Đây là cách dễ debug nhất: database/broker ở Docker, .NET/React chạy trực tiếp trên máy.

## 3. Cách B — Full Docker

```powershell
./scripts/dev-docker.ps1
```

Script dùng cả `docker-compose.yml` và `docker-compose.apps.yml`, build Gateway, sáu API và hai web app.

## 4. Thứ tự kiểm tra

### Hạ tầng

```powershell
docker compose -f src/infra/docker-compose.yml ps
Invoke-WebRequest http://localhost:8025
Invoke-WebRequest http://localhost:8099/health
```

### Backend

```powershell
5080..5086 | ForEach-Object {
  Invoke-RestMethod "http://localhost:$_/live"
}
```

`/live` chứng minh process sống. `/ready` mới chứng minh dependency như database sẵn sàng.

### UI

- Customer: `http://localhost:5173`
- Back-office: `http://localhost:5174`
- Gateway/Swagger: `http://localhost:5080/swagger/index.html`
- Mailpit: `http://localhost:8025`

## 5. Luồng nghiệm thu tối thiểu

1. Login customer seed.
2. Tìm chuyến `Seed Origin` → `Seed Destination`, ngày `2026-12-01`.
3. Xem ghế và tạo seat hold.
4. Tạo booking.
5. Tạo payment/đi qua simulator.
6. Nhận ticket/QR.
7. Mở Mailpit kiểm tra notification.
8. Login operator, xem manifest.
9. Login admin, xem user/payment/reporting.

## 6. Script cần có

| Script | Nhiệm vụ |
|---|---|
| `dev-env.ps1` | tập trung biến môi trường local |
| `dev-host.ps1` | khởi động Gateway và sáu API trên host |
| `dev-docker.ps1` | khởi động full Docker stack |
| `apply-dev-seed.ps1` | áp seed local an toàn/idempotent |
| `verify-contracts.ps1` | chạy contract gates |
| `verify-s0.ps1` | build/test gate Sprint 0 |
| `hash-password.cs` | tạo hash seed local |
| `gen_service_skeleton.py` | sinh skeleton service |

Không hard-code đường dẫn máy người tạo trong script. Đặc biệt kiểm tra và sửa `ROOT` của `gen_service_skeleton.py` thành đường dẫn tương đối trước khi chia sẻ.

## 7. Debug theo lớp

| Triệu chứng | Kiểm tra đầu tiên |
|---|---|
| `/ready` 503 | connection string và PostgreSQL |
| Gateway 502 | service đích/cluster address |
| Browser CORS | origin và header trong Gateway |
| 401 | issuer/audience/signing key/token expiry |
| 403 | role/policy, không phải authentication |
| Message không tới | outbox row, relay log, exchange/binding, inbox |
| UI trắng | console browser, Vite env, API base URL |
| Testcontainers fail | Docker Desktop và `docker info` |
| SQL chạy lặp | `schema_migrations`, filename và transaction |

## 8. Gate cuối

```powershell
dotnet restore
dotnet build --no-restore
dotnet test --no-build
npm ci
npm run build:web
./scripts/verify-contracts.ps1
./scripts/verify-s0.ps1
docker compose -f src/infra/docker-compose.yml config
git status --short
```

`git status` chỉ được chứa thay đổi bạn chủ động tạo. Không commit `.env`, token, database volume, `node_modules`, `bin` hoặc `obj`.

## Khi nào được xem là đạt `fulltemplate`?

- đủ cấu trúc trong phụ lục B;
- đúng version thư viện trong phụ lục A;
- build/test/web build xanh;
- sáu API ready;
- Gateway proxy và Swagger hoạt động;
- luồng nghiệm thu tối thiểu chạy qua;
- không còn scaffold `WeatherForecast`/`Class1.cs`;
- không có secret thật trong Git.
