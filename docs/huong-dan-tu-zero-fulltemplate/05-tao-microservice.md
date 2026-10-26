# 05 — Tạo microservice bốn tầng

## 1. Ma trận service

| Slug | Tên .NET | Port | Database | Trách nhiệm |
|---|---|---:|---|---|
| `identity` | Identity | 5081 | identity | user, auth, role, organization |
| `transport` | Transport | 5082 | transport | operator, route, trip, coach, seat |
| `booking` | Booking | 5083 | booking | hold, booking, ticket, manifest |
| `payment` | Payment | 5084 | payment | checkout, payment, refund, settlement |
| `notification` | Notification | 5085 | notification | email/message và delivery log |
| `reporting` | Reporting | 5086 | reporting | read model và báo cáo |

Identity làm riêng ở chương 06. Năm service còn lại dùng cùng công thức dưới đây.

## 2. Tạo bốn project cho một service

Ví dụ Booking, chạy từ `workspace`:

```powershell
$root = 'src/services/booking'
dotnet new classlib -n BusTicketPlatform.Booking.Domain -o "$root/BusTicketPlatform.Booking.Domain"
dotnet new classlib -n BusTicketPlatform.Booking.Application -o "$root/BusTicketPlatform.Booking.Application"
dotnet new classlib -n BusTicketPlatform.Booking.Infrastructure -o "$root/BusTicketPlatform.Booking.Infrastructure"
dotnet new web -n BusTicketPlatform.Booking.Api -o "$root/BusTicketPlatform.Booking.Api"
Get-ChildItem $root -Filter Class1.cs -Recurse | Remove-Item
dotnet sln add "$root/**/*.csproj"
```

Nếu wildcard không được PowerShell/.NET CLI chấp nhận, thêm từng `.csproj` bằng đường dẫn đầy đủ.

## 3. Thiết lập dependency đúng hướng

```powershell
$domain = "$root/BusTicketPlatform.Booking.Domain/BusTicketPlatform.Booking.Domain.csproj"
$app = "$root/BusTicketPlatform.Booking.Application/BusTicketPlatform.Booking.Application.csproj"
$infra = "$root/BusTicketPlatform.Booking.Infrastructure/BusTicketPlatform.Booking.Infrastructure.csproj"
$api = "$root/BusTicketPlatform.Booking.Api/BusTicketPlatform.Booking.Api.csproj"

dotnet add $app reference $domain
dotnet add $app reference src/building-blocks/BusTicketPlatform.BuildingBlocks/BusTicketPlatform.BuildingBlocks.csproj
dotnet add $infra reference $app
dotnet add $infra reference src/building-blocks/BusTicketPlatform.BuildingBlocks.Messaging/BusTicketPlatform.BuildingBlocks.Messaging.csproj
dotnet add $api reference $app $infra
dotnet add $api reference src/building-blocks/BusTicketPlatform.BuildingBlocks.AspNetCore/BusTicketPlatform.BuildingBlocks.AspNetCore.csproj

dotnet add $infra package Npgsql
dotnet add $infra package Microsoft.Extensions.Hosting
dotnet add $infra package Microsoft.Extensions.Diagnostics.HealthChecks
```

Tuyệt đối không cho Domain reference Infrastructure hoặc Api.

## 4. File tối thiểu cần tạo

### Domain

- `AssemblyMarker.cs`: marker cho architecture test.
- file entity/value object/constant nghiệp vụ nếu có; ví dụ Transport có `Roles.cs`.

Domain không cần nhiều file nếu logic chủ yếu nằm ở application service, nhưng không được đặt dependency công nghệ vào đây.

### Application

- `AssemblyMarker.cs`.
- `Contracts.cs`: request/response DTO và port repository/publisher cần cho use case.
- `<ServiceName>Service.cs`: điều phối use case, validate rule, gọi port và trả `Result<T>`.
- file chuyên biệt nếu cần, ví dụ Booking `TicketQr.cs`, Payment `VnPayCheckout.cs`.

### Infrastructure

- `AssemblyMarker.cs`.
- `<Name>DatabaseOptions.cs`: connection string name và `IsConfigured`.
- `<Name>InfrastructureExtensions.cs`: đăng ký DI, repository, health check, hosted service.
- `Persistence/<Name>Repository.cs`: SQL/Npgsql implementation.
- `Persistence/IdempotencyStore.cs`: chống xử lý request lặp.
- `SqlBaselineMigrator.cs`: đọc embedded SQL và ghi `schema_migrations`.
- `SqlBaselineHostedService.cs`: chạy migrator khi app khởi động.
- `PostgresHealthCheck.cs`: kiểm tra kết nối.
- `OutboxWriter.cs`: ghi event trong transaction.
- `<Name>Events.cs`: event contract do service phát, nếu có.
- `<Name>EventHandlers.cs`: xử lý event service khác, nếu có.

Trong `.csproj` Infrastructure, embed SQL:

```xml
<ItemGroup>
  <EmbeddedResource Include="..\..\..\..\..\docs\database\_shared\000_integration_tables.sql"
                    LogicalName="sql.shared" />
  <EmbeddedResource Include="..\..\..\..\..\docs\database\booking\001_initial.sql"
                    LogicalName="sql.booking" />
</ItemGroup>
```

### Api

- `Program.cs`: chỉ composition root và middleware pipeline.
- `<Name>Endpoints.cs`: map endpoint, bind request, gọi application service, đổi Result thành HTTP.
- `appsettings.json`: logging, connection string key, auth, messaging.
- `appsettings.Development.json`: override an toàn cho local; không commit secret thật.
- `Properties/launchSettings.json`: port local.

Khung `Program.cs` chuẩn:

```csharp
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddBuildingBlocks();
builder.Services.AddBookingInfrastructure(builder.Configuration);
builder.Services.AddPlatformJwt(builder.Configuration);
builder.Services.AddPlatformOpenApi();
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase);
builder.Services.AddHealthChecks()
    .AddCheck("self", () => HealthCheckResult.Healthy(), tags: ["live", "ready", "startup"])
    .AddBookingDatabaseCheck();
builder.Services.AddPlatformSwaggerCors();

var app = builder.Build();
app.UsePlatformSwaggerCors();
app.UseBuildingBlocks();
app.UseAuthentication();
app.UseAuthorization();
app.MapPlatformHealth();
app.MapPlatformOpenApi();
app.MapBookingEndpoints();
app.Run();

public partial class Program;
```

`partial Program` là để `WebApplicationFactory<Program>` trong integration test truy cập entry point.

## 5. Dùng generator có sẵn

`workspace/scripts/gen_service_skeleton.py` sinh skeleton cho Transport, Booking, Payment, Notification và Reporting. Trước khi chạy, sửa hằng `ROOT` vì script hiện chứa đường dẫn tuyệt đối của máy đã tạo template.

Nên dùng script để học cấu trúc, không xem output là nghiệp vụ hoàn chỉnh. Sau khi sinh, vẫn phải:

1. kiểm tra namespace và project reference;
2. viết contract/use case;
3. viết repository SQL;
4. map endpoint;
5. bổ sung event/handler;
6. thêm test.

## 6. Thứ tự triển khai năm service

1. Transport: cung cấp trip/seat cho booking.
2. Booking: giữ ghế, tạo booking/ticket.
3. Payment: tạo thanh toán và webhook.
4. Notification: consume event để gửi thông báo.
5. Reporting: consume event để tạo read model.

Sau mỗi service:

```powershell
dotnet build
dotnet test --filter FullyQualifiedName~Booking
```

Đổi `Booking` theo service vừa làm.

## Checkpoint 05

```powershell
dotnet sln BusTicketPlatform.sln list
dotnet build
```

Solution phải có đủ 24 project service: 6 service × 4 tầng. Architecture test ở chương 09 sẽ xác nhận dependency không đi ngược.
