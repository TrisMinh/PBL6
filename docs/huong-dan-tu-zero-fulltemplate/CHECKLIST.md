# Checklist từ `develop` đến `fulltemplate`

Đánh dấu bằng `[x]` chỉ sau khi đã chạy checkpoint tương ứng.

## Toolchain

- [ ] Git hoạt động.
- [ ] .NET SDK 10.0.401 tương thích.
- [ ] Node 20+ và npm hoạt động.
- [ ] Docker Desktop và Compose v2 hoạt động.
- [ ] Không có port bắt buộc bị chiếm.

## Workspace

- [ ] `BusTicketPlatform.sln` được tạo.
- [ ] Có `global.json`, `Directory.Build.props`, `Directory.Packages.props`.
- [ ] Có npm workspace và lockfile.
- [ ] `dotnet restore` thành công.

## Shared foundation

- [ ] Core BuildingBlocks không phụ thuộc framework/provider.
- [ ] ASP.NET BuildingBlocks có correlation, error, health, JWT, OpenAPI.
- [ ] Messaging có event envelope, outbox, inbox và consumer.
- [ ] Unit test shared foundation xanh.

## Infrastructure

- [ ] Compose config hợp lệ.
- [ ] PostgreSQL, RabbitMQ, Redis, Mailpit, simulator chạy.
- [ ] Có sáu database.
- [ ] Baseline và seed chạy lại không lỗi/không trùng.

## Services

- [ ] Identity đủ bốn tầng và đăng nhập seed được.
- [ ] Transport đủ bốn tầng và tìm chuyến được.
- [ ] Booking đủ bốn tầng và tạo hold/booking/ticket được.
- [ ] Payment đủ bốn tầng và xử lý simulator callback được.
- [ ] Notification consume event và ghi delivery được.
- [ ] Reporting consume event và đọc report được.
- [ ] Không còn `Class1.cs`/`WeatherForecast`.

## Gateway và clients

- [ ] Gateway proxy đủ route và cluster.
- [ ] Swagger UI thấy sáu OpenAPI document.
- [ ] CORS hoạt động từ 5173/5174.
- [ ] API client dùng Gateway, không hard-code service URL trong component.
- [ ] Customer Web build/chạy.
- [ ] Back-office build/chạy.
- [ ] Mobile typecheck/chạy Expo.

## Tests và nghiệm thu

- [ ] Unit tests xanh.
- [ ] Architecture tests xanh.
- [ ] Contract tests xanh, fixture sai bị bắt.
- [ ] Gateway integration tests xanh.
- [ ] Sáu service integration tests xanh.
- [ ] Messaging tests xanh.
- [ ] `npm run build:web` xanh.
- [ ] Luồng login → search → hold → booking → payment → ticket chạy qua.
- [ ] `git status` không có secret/cache/output ngoài ý muốn.

## Gate cuối

```powershell
Set-Location workspace
dotnet restore
dotnet build --no-restore
dotnet test --no-build
npm ci
npm run build:web
./scripts/verify-contracts.ps1
./scripts/verify-s0.ps1
docker compose -f src/infra/docker-compose.yml config
```
