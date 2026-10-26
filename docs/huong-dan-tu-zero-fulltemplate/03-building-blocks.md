# 03 — Tạo Building Blocks

Building Blocks là các khối kỹ thuật dùng chung. Làm phần này trước service để sáu service không tự phát minh sáu cách xử lý lỗi, health check và message khác nhau.

## 1. Tạo ba project

Từ `workspace`:

```powershell
dotnet new classlib -n BusTicketPlatform.BuildingBlocks `
  -o src/building-blocks/BusTicketPlatform.BuildingBlocks
dotnet new classlib -n BusTicketPlatform.BuildingBlocks.AspNetCore `
  -o src/building-blocks/BusTicketPlatform.BuildingBlocks.AspNetCore
dotnet new classlib -n BusTicketPlatform.BuildingBlocks.Messaging `
  -o src/building-blocks/BusTicketPlatform.BuildingBlocks.Messaging

dotnet sln add src/building-blocks/BusTicketPlatform.BuildingBlocks/BusTicketPlatform.BuildingBlocks.csproj
dotnet sln add src/building-blocks/BusTicketPlatform.BuildingBlocks.AspNetCore/BusTicketPlatform.BuildingBlocks.AspNetCore.csproj
dotnet sln add src/building-blocks/BusTicketPlatform.BuildingBlocks.Messaging/BusTicketPlatform.BuildingBlocks.Messaging.csproj
```

Xóa ba file `Class1.cs`.

## 2. Project Core

Project `BusTicketPlatform.BuildingBlocks` không tham chiếu ASP.NET, database hay RabbitMQ. Tạo file theo thứ tự:

| File | Trách nhiệm |
|---|---|
| `AssemblyMarker.cs` | kiểu rỗng dùng để lấy assembly trong test/scan |
| `Correlation/CorrelationDefaults.cs` | tên header `X-Correlation-Id` và quy ước correlation |
| `Errors/AppError.cs` | record/value object biểu diễn lỗi nghiệp vụ |
| `Errors/ErrorCodes.cs` | mã lỗi ổn định cho client |
| `Errors/ErrorMapper.cs` | ánh xạ loại lỗi sang HTTP status |
| `Errors/PlatformErrors.cs` | lỗi nền tảng dùng lại nhiều nơi |
| `Http/ErrorEnvelope.cs` | JSON lỗi thống nhất trả cho client |
| `Idempotency/IIdempotencyStore.cs` | port lưu kết quả theo idempotency key |
| `Ids/IIdGenerator.cs` | port sinh ID |
| `Ids/UuidV7IdGenerator.cs` | implementation UUID v7 có thứ tự thời gian |
| `Logging/LogRedaction.cs` | che token/password/secret trong log |
| `Results/Result.cs` | `Result`/`Result<T>` cho success hoặc error |
| `Telemetry/TelemetryConventions.cs` | tên activity/source/tag thống nhất |
| `Time/IClock.cs` | port lấy thời gian để test được |
| `Time/SystemClock.cs` | implementation dùng UTC thật |

Quy tắc khi viết:

- Core không dùng `HttpContext`, `NpgsqlConnection` hoặc `IModelBindingContext`.
- Lỗi có `code`, `message` và chi tiết an toàn; không trả stack trace.
- `Result<T>` không ném exception cho lỗi nghiệp vụ dự kiến.
- Mọi thời gian lưu trữ là UTC.

## 3. Project ASP.NET Core

Trong `.csproj`, thêm project reference tới Core và package:

```powershell
dotnet add src/building-blocks/BusTicketPlatform.BuildingBlocks.AspNetCore/BusTicketPlatform.BuildingBlocks.AspNetCore.csproj `
  reference src/building-blocks/BusTicketPlatform.BuildingBlocks/BusTicketPlatform.BuildingBlocks.csproj
dotnet add src/building-blocks/BusTicketPlatform.BuildingBlocks.AspNetCore/BusTicketPlatform.BuildingBlocks.AspNetCore.csproj `
  package Microsoft.AspNetCore.OpenApi
dotnet add src/building-blocks/BusTicketPlatform.BuildingBlocks.AspNetCore/BusTicketPlatform.BuildingBlocks.AspNetCore.csproj `
  package Microsoft.AspNetCore.Authentication.JwtBearer
```

Tạo từng file:

| File | Làm gì | Được gọi ở đâu |
|---|---|---|
| `Auth/PlatformJwtExtensions.cs` | đọc cấu hình issuer/audience/key và đăng ký JWT | service trừ Identity |
| `Correlation/CorrelationMiddleware.cs` | nhận hoặc sinh correlation ID | mọi API/Gateway |
| `Health/HealthEndpointExtensions.cs` | map `/live`, `/ready`, `/startup` | mọi API/Gateway |
| `HostingExtensions.cs` | `AddBuildingBlocks` và `UseBuildingBlocks` | `Program.cs` |
| `Http/ErrorEnvelopeMiddleware.cs` | bắt exception và trả envelope | pipeline HTTP |
| `Http/PlatformHttp.cs` | đổi `Result` thành `IResult` | endpoint |
| `OpenApiExtensions.cs` | OpenAPI JSON và Swagger CORS | mọi service |

Thứ tự middleware trong app rất quan trọng:

```csharp
app.UsePlatformSwaggerCors();
app.UseBuildingBlocks();
app.UseAuthentication();
app.UseAuthorization();
app.MapPlatformHealth();
app.MapPlatformOpenApi();
```

`UseAuthentication` luôn đứng trước `UseAuthorization`.

## 4. Project Messaging

Thêm reference/package:

```powershell
$messaging = 'src/building-blocks/BusTicketPlatform.BuildingBlocks.Messaging/BusTicketPlatform.BuildingBlocks.Messaging.csproj'
dotnet add $messaging reference src/building-blocks/BusTicketPlatform.BuildingBlocks/BusTicketPlatform.BuildingBlocks.csproj
dotnet add $messaging package RabbitMQ.Client
dotnet add $messaging package Npgsql
dotnet add $messaging package Microsoft.Extensions.Hosting
dotnet add $messaging package Microsoft.Extensions.Configuration.Abstractions
```

Tạo file theo luồng phát message:

1. `EventMessage.cs`: envelope gồm event id, type, version, occurred-at, correlation/causation và payload.
2. `IEventPublisher.cs`: port phát event.
3. `OutboxRouting.cs`: map event type sang exchange/routing key.
4. `OutboxRelay.cs`: đọc record chưa publish từ PostgreSQL và gửi RabbitMQ.
5. `OutboxDispatchHostedService.cs`: vòng lặp nền gọi relay.
6. `RabbitMqSmokeBus.cs`: kết nối/publish/consume mức thấp để smoke test.
7. `InboxDeduper.cs`: ghi event đã xử lý, chống xử lý lặp.
8. `IntegrationEventConsumerHost.cs`: consumer nền, deserialize, dedupe rồi gọi handler.

Luồng đúng:

```text
Use case + transaction DB
  -> ghi business data
  -> ghi outbox cùng transaction
  -> background relay đọc outbox
  -> RabbitMQ
  -> consumer ghi/check inbox
  -> handler cập nhật service đích
```

Không publish RabbitMQ trực tiếp trước khi transaction database commit; nếu DB rollback nhưng event đã đi, dữ liệu sẽ lệch.

## Checkpoint 03

```powershell
dotnet build
dotnet test --filter FullyQualifiedName~BuildingBlocks
```

Nếu chưa tạo test, ít nhất `dotnet build` phải xanh. Sau chương 09, quay lại chạy đầy đủ unit test cho Core và middleware.
