# 00 — Bản đồ từ `develop` đến `fulltemplate`

## `develop` đang có gì?

`origin/develop` là nền móng ban đầu:

- solution .NET;
- API Gateway sơ khai;
- Identity Api/Application/Domain/Infrastructure còn là scaffold;
- Docker Compose nền tảng database-per-service;
- các file mặc định như `WeatherForecast` và `Class1.cs` vẫn còn.

Nó chưa phải ứng dụng hoàn chỉnh. Đây là điểm bắt đầu tốt vì người học thấy được quá trình thay scaffold bằng code thật.

## `fulltemplate` đã thêm gì?

| Khối | Nội dung |
|---|---|
| Cấu hình chung | Central Package Management, warnings-as-errors, `.NET 10`, npm workspaces |
| Building blocks | Result, errors, correlation ID, error envelope, health, JWT, OpenAPI |
| Messaging | RabbitMQ, event envelope, outbox relay, inbox dedupe, consumer host |
| Service | Identity, Transport, Booking, Payment, Notification, Reporting |
| Data | Sáu PostgreSQL database, migration baseline, integration tables, seed |
| Gateway | YARP route/cluster, Swagger UI tập trung, CORS |
| Web | Customer Web và Back-office bằng React/Vite |
| Mobile | Expo/React Native, navigation và secure session |
| Test | Unit, architecture, contract, integration và Testcontainers |
| Dev workflow | script chạy host, Docker, seed và verification |

## Các mốc nên commit

Tạo branch học tập:

```powershell
git fetch origin
git switch -c learning/rebuild-fulltemplate origin/develop
```

Commit theo thứ tự sau:

1. `chore: configure dotnet and npm workspaces`
2. `feat: add core building blocks`
3. `feat: add aspnet and messaging building blocks`
4. `chore: add local infrastructure and database baselines`
5. `feat: implement identity service`
6. `feat: add transport booking payment services`
7. `feat: add notification reporting services`
8. `feat: configure yarp gateway and openapi`
9. `feat: add web clients and shared packages`
10. `feat: add mobile client`
11. `test: add architecture contract and integration coverage`
12. `chore: add local run and verification scripts`

## Cách đối chiếu mà không phá code đang làm

Xem file chỉ có ở đích:

```powershell
git diff --name-status origin/develop...fulltemplate
```

Xem thay đổi theo thư mục:

```powershell
git diff --stat origin/develop...fulltemplate -- workspace/src/building-blocks
git diff --stat origin/develop...fulltemplate -- workspace/src/services
git diff --stat origin/develop...fulltemplate -- workspace/src/apps
```

Xem nội dung file đích mà không checkout:

```powershell
git show fulltemplate:workspace/Directory.Packages.props
```

Khôi phục một file của branch học tập về phiên bản vừa commit:

```powershell
git restore path/to/file
```

Không dùng `git reset --hard` trong lộ trình này vì dễ làm mất phần đang học.

## Thứ tự phụ thuộc

Không thể làm các phần tùy ý. Chuỗi phụ thuộc thực tế là:

```text
Toolchain
  -> cấu hình solution
  -> BuildingBlocks core
  -> ASP.NET + Messaging building blocks
  -> PostgreSQL/RabbitMQ
  -> service bốn tầng
  -> Gateway
  -> API client
  -> Web/Mobile
  -> integration test
```

Nếu làm UI trước API client và Gateway, bạn sẽ phải hard-code URL rồi sửa lại. Nếu làm service trước BuildingBlocks, mỗi service sẽ tự tạo error/health/auth khác nhau. Vì vậy hãy giữ đúng thứ tự.
