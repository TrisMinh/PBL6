# Danh Bạ Giải Phẫu Thuần Mã Nguồn (Phần 1): `BuildingBlocks`, `AspNetCore`, `Messaging` & `YARP Gateway`

> **Mục tiêu tài liệu**: Đây là **Sổ tay giải phẫu thuần Code 100% (không lý thuyết Use Case)** đi qua **từng file `.cs` một**, chỉ rõ: **(1) Đường dẫn file**, **(2) Công nghệ / Thư viện / Namespace sử dụng**, **(3) Mọi Class / Record / Method bên trong**, và **(4) Cơ chế thực thi cấp dòng lệnh / thuật toán / bộ nhớ**.

---

## 1. Project `BusTicketPlatform.BuildingBlocks` (`workspace/src/building-blocks/BusTicketPlatform.BuildingBlocks/`)

Thư viện lõi thuần C# 13 (`net10.0`), **0 package NuGet ngoài** (chỉ dùng BCL `.NET 10`), đóng vai trò nền móng kiểu dữ liệu cho cả 38 projects.

---

### 1.1. `Results/Result.cs`
- **Kỹ thuật ngôn ngữ**: `readonly record struct` (nằm trên CPU Stack, **0 byte cấp phát Heap GC**), Generic Type `Result<T>`.
- **Cấu trúc & Phương thức**:
  ```csharp
  public readonly record struct Result(bool IsSuccess, AppError? Error)
  {
      public static Result Success() => new(true, null);
      public static Result Failure(AppError error) => new(false, error ?? throw new ArgumentNullException(nameof(error)));
  }

  public readonly record struct Result<T>(bool IsSuccess, T? Value, AppError? Error)
  {
      public static Result<T> Success(T value) => new(true, value, null);
      public static Result<T> Failure(AppError error) => new(false, default, error ?? throw new ArgumentNullException(nameof(error)));
  }
  ```
- **Cơ chế hoạt động**: Thay thế hoàn toàn lệnh `throw Exception` trên luồng nghiệp vụ. Mọi hàm ở tầng `Application` trả về `Result<T>`: nhánh thành công mang `Value` (`IsSuccess = true`), nhánh thất bại mang `AppError` (`IsSuccess = false`), tránh chi phí quét ngược Call Stack (`Stack Unwinding`) của CLR.

---

### 1.2. `Ids/IIdGenerator.cs` & `Ids/UuidV7IdGenerator.cs`
- **Công nghệ sử dụng**: BCL `System.Guid.CreateVersion7()` (chuẩn **RFC 9562** mới từ .NET 9/10).
- **Code thực thi**:
  ```csharp
  public sealed class UuidV7IdGenerator : IIdGenerator
  {
      public Guid NewUuidV7() => Guid.CreateVersion7();
  }
  ```
- **Bản chất kỹ thuật**: Sinh cấu trúc 128-bit gồm **48-bit Unix Timestamp mili-giây ở MSB (Most Significant Bits)** + 4-bit version (`0111`) + **74-bit ngẫu nhiên mật mã (`CSPRNG`)**. Vì 6 bytes đầu tăng đơn điệu theo thời gian thực, khi `INSERT` vào cột `uuid PRIMARY KEY` của PostgreSQL, khóa mới luôn chèn tuần tự vào trang lá phải cùng của cây **B+Tree** ($O(\log_B N)$ sequential append), triệt tiêu hiện tượng tách trang ngẫu nhiên (Page Split) của `Guid.NewGuid()` (UUIDv4).

---

### 1.3. `Errors/AppError.cs`, `ErrorCodes.cs`, `PlatformErrors.cs`, `ErrorMapper.cs` & `Http/ErrorEnvelope.cs`
- **Các kiểu dữ liệu chính**:
  - `AppError(string Code, string Message, int StatusCode, IReadOnlyDictionary<string, object>? Details = null)`: `sealed record` bất biến.
  - `StatusCodes`: Hằng số mã HTTP (`400, 401, 403, 404, 409, 410, 422, 423, 429, 500, 503`) viết tách riêng để project `BuildingBlocks` không cần tham chiếu `Microsoft.AspNetCore.Http`.
  - `ErrorCodes`: 33 hằng chuỗi `const string` định danh lỗi máy đọc được (ví dụ `SEAT_UNAVAILABLE`, `IDEMPOTENCY_CONFLICT`, `SESSION_REUSE_DETECTED`).
  - `ErrorMapper.FromUnknown(Exception _, Guid correlationId)`: Cố tình bỏ qua biến `_` (không đọc `ex.Message` hay `ex.StackTrace`) để chặn rò rỉ câu lệnh SQL/chuỗi kết nối ra JSON bên ngoài; trả về `500 INTERNAL_ERROR`.
  - `ErrorMapper.FromStatus(int statusCode, Guid correlationId)`: Dùng biểu thức `switch` C# ánh xạ các mã lỗi trần của HTTP/YARP (`502, 503, 504` $\rightarrow$ `503 UPSTREAM_UNAVAILABLE`, `401` $\rightarrow$ `AUTHENTICATION_REQUIRED`, `403` $\rightarrow$ `ACCESS_DENIED`, `404` $\rightarrow$ `RESOURCE_NOT_FOUND`, `429` $\rightarrow$ `RATE_LIMITED`).
  - `ErrorEnvelope`: Định nghĩa DTO phản hồi chuẩn `{"error": {"code": "...", "message": "...", "correlationId": "...", "details": {...}}}` dùng `[JsonPropertyName("correlationId")]`.

---

### 1.4. `Idempotency/IIdempotencyStore.cs`
- **Kỹ thuật mô hình hóa**: Dùng **Discriminated Union giả lập bằng `abstract record`** trong C#:
  ```csharp
  public abstract record IdempotencyOutcome
  {
      public sealed record Started : IdempotencyOutcome;
      public sealed record Completed(int StatusCode, string ResponseSnapshot) : IdempotencyOutcome;
      public sealed record InProgress : IdempotencyOutcome;
      public sealed record Conflict : IdempotencyOutcome;
  }
  ```
- **Hai cổng giao tiếp**:
  - `BeginAsync(actorScope, operation, targetReference, key, requestHash, ct)` $\rightarrow$ trả về 1 trong 4 nhánh của `IdempotencyOutcome`.
  - `CompleteAsync(actorScope, operation, targetReference, key, statusCode, responseSnapshot, ct)` $\rightarrow$ chốt JSON kết quả vào DB.

---

### 1.5. `Logging/LogRedaction.cs`, `Time/IClock.cs` (`SystemClock.cs`), `Correlation/CorrelationDefaults.cs`, `Telemetry/TelemetryConventions.cs`
- **`LogRedaction`**: Dùng tập băm `HashSet<string>(StringComparer.OrdinalIgnoreCase)` tra cứu $O(1)$ cho 11 tên trường nhạy cảm (`password`, `passwordHash`, `token`, `accessToken`, `refreshToken`, `authorization`, `email`, `phone`, `secret`, `connectionString`, `jwt`) kết hợp kiểm tra chuỗi con `.Contains("password" | "secret" | "token", OrdinalIgnoreCase)` để thay giá trị bằng `"***"`.
- **`IClock` / `SystemClock`**: Bọc `DateTimeOffset.UtcNow` qua interface để có thể giả lập thời gian (Time-travel testing) trong Unit Test.

---

## 2. Project `BusTicketPlatform.BuildingBlocks.AspNetCore` (`workspace/src/building-blocks/BusTicketPlatform.BuildingBlocks.AspNetCore/`)

Thư viện tích hợp pipeline HTTP Kestrel, JWT Bearer, Health Probes và Middleware dùng chung cho cả Gateway lẫn 6 Microservices.

---

### 2.1. `HostingExtensions.cs`
- `AddBuildingBlocks(this IServiceCollection services)`: Đăng ký `AddSingleton<IClock, SystemClock>()` và `AddSingleton<IIdGenerator, UuidV7IdGenerator>()`.
- `UseBuildingBlocks(this IApplicationBuilder app)`: Gắn 2 middleware theo thứ tự cứng:
  1. `app.UseMiddleware<CorrelationMiddleware>()`
  2. `app.UseMiddleware<ErrorEnvelopeMiddleware>()`

---

### 2.2. `Correlation/CorrelationMiddleware.cs`
- **Thuật toán thực thi trên mỗi HTTP Request**:
  1. Đọc `context.Request.Headers["X-Correlation-Id"]`.
  2. Nếu `Guid.TryParse(raw, out var parsed) && parsed != Guid.Empty` thì giữ nguyên `parsed`; ngược lại gọi `idGenerator.NewUuidV7()`.
  3. Cất vào từ điển phạm vi request: `context.Items["CorrelationId"] = correlationId`.
  4. Đăng ký callback `context.Response.OnStarting(() => { context.Response.Headers["X-Correlation-Id"] = correlationId.ToString(); return Task.CompletedTask; })` — đảm bảo header luôn được ghi ngay trước byte body đầu tiên đẩy xuống socket, kể cả khi phía sau ném Exception!

---

### 2.3. `Http/ErrorEnvelopeMiddleware.cs`
- **Cơ chế đánh chặn 2 tầng (Dual-Intercept Pipeline)**:
  - **Tầng 1 (Sau `await next(context)` không có Exception)**: Kiểm tra `!context.Response.HasStarted && context.Response.StatusCode >= 400 && IsEmptyJsonResponse(context)` (`ContentLength is null or 0` và `ContentType` rỗng). Nếu đúng (ví dụ JwtBearer trả `401` rỗng, Authorization trả `403` rỗng, hoặc YARP trả `502` rỗng), nó đổi sang JSON `ErrorEnvelope` tương ứng thông qua `ErrorMapper.FromStatus`.
  - **Tầng 2 (Khối `catch (Exception exception)`)**:
    - Nếu là `BadHttpRequestException` (lỗi cú pháp JSON body hoặc thiếu tham số bắt buộc của Minimal API) $\rightarrow$ trả `400 VALIDATION_ERROR`.
    - Mọi Exception khác $\rightarrow$ `logger.LogError(exception, ...)` rồi gọi `ErrorMapper.FromUnknown`. Chỉ khi `environment.IsDevelopment() == true` mới đính kèm tên class Exception và `exception.Message` vào `details`.

---

### 2.4. `Http/PlatformHttp.cs`
File tiện ích cực kỳ quan trọng kết nối Minimal APIs với `Result<T>`, JWT Claims và `IIdempotencyStore`:
- **Cấu hình JSON chuẩn**: `JsonSerializerOptions Json` bật `PropertyNamingPolicy = JsonNamingPolicy.CamelCase` và `DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull`.
- **Trích xuất Claims tốc độ cao**:
  - `UserId(this ClaimsPrincipal user)` $\rightarrow$ đọc claim `"sub"` hoặc `ClaimTypes.NameIdentifier` ép kiểu `Guid`.
  - `OrganizationId(this ClaimsPrincipal user)` $\rightarrow$ đọc claim **`"org"`** ép kiểu `Guid?`.
  - `HasRole(this ClaimsPrincipal user, params string[] roles)` $\rightarrow$ `roles.Any(user.IsInRole)`.
- **Hàm băm Payload chống sửa đổi `HashPayload<T>(T payload)`**:
  ```csharp
  var bytes = JsonSerializer.SerializeToUtf8Bytes(payload, Json);
  return Convert.ToHexString(SHA256.HashData(bytes));
  ```
- **Thuật toán Middleware cấp Endpoint `WithIdempotency(...)`**:
  1. Đọc header `Idempotency-Key`: nếu rỗng trả `400 IDEMPOTENCY_KEY_REQUIRED`; nếu độ dài `< 16` hoặc `> 200` trả `400 VALIDATION_ERROR`.
  2. Gọi `store.BeginAsync(scope, operation, target, key, requestHash, ct)` và phân nhánh bằng `switch`:
     - `IdempotencyOutcome.Conflict` $\rightarrow$ `409 IDEMPOTENCY_CONFLICT` (cùng key nhưng khác `requestHash`).
     - `IdempotencyOutcome.InProgress` $\rightarrow$ `409 IDEMPOTENCY_IN_PROGRESS` (request song song đang chạy).
     - `IdempotencyOutcome.Completed c` $\rightarrow$ ghi thẳng `c.StatusCode` và chuỗi JSON `c.ResponseSnapshot` đã lưu ra `Results.Content(..., "application/json")` (Zero re-execution!).
     - `IdempotencyOutcome.Started` $\rightarrow$ chạy hàm `action()`, tuần tự hóa kết quả ra JSON, nếu mã trạng thái `< 500` thì gọi `store.CompleteAsync(...)` lưu lại trong 24 giờ, rồi trả về cho client.

---

### 2.5. `Auth/PlatformJwtExtensions.cs`, `Health/HealthEndpointExtensions.cs` & `OpenApiExtensions.cs`
- **`AddPlatformJwt`**: Cấu hình `JwtBearerDefaults.AuthenticationScheme` dùng khóa đối xứng `SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey))` (thuật toán `HS256`), kiểm tra `Issuer = "busticket-identity"`, `Audience = "busticket"`, `ValidateLifetime = true`, ép **`ClockSkew = TimeSpan.FromSeconds(30)`** (mặc định của .NET là 5 phút!), ánh xạ `NameClaimType = "sub"`, `RoleClaimType = ClaimTypes.Role`.
- **`MapPlatformHealth`**: Ánh xạ 4 đường dẫn `/live`, `/health` (lọc tag `"live"`), `/ready` (lọc tag `"ready"` — kích hoạt `PostgresHealthCheck`), `/startup` (lọc tag `"startup"`).
- **`OpenApiExtensions`**: Dùng `Microsoft.AspNetCore.OpenApi` xuất `/openapi/v1.json` và mở CORS `"swagger"` cho `http://localhost:5080`.

---

## 3. Project `BusTicketPlatform.BuildingBlocks.Messaging` (`workspace/src/building-blocks/BusTicketPlatform.BuildingBlocks.Messaging/`)

Thư viện tích hợp **RabbitMQ 7 (`RabbitMQ.Client 7.1.2` thuần Async API)** thực thi mẫu **Transactional Outbox + Idempotent Inbox + DLQ**.

| Tên File | Các Class / Record / Hàm Chính | Kỹ Thuật & Thuật Toán Thực Thi Cụ Thể |
|---|---|---|
| `EventMessage.cs` | `EventMessage`, `EventMessageJson`, `EventPayload`, `Topology` | Định nghĩa phong bì chuẩn 11 trường (`EventId`, `EventType`, `Version`, `OccurredAt`, `Producer`, `CorrelationId`, `AggregateId`, `Payload` kiểu `JsonElement` zero-copy, `CausationId`, `AggregateVersion`, `TenantId`). Hằng số `Topology`: `EventsExchange = "platform.events"`, `DeadLetterExchange = "platform.dlx"`, tên các hàng đợi `.q` và `.dlq`. |
| `OutboxRouting.cs` | `OutboxRouting.KeyFor(string eventType)` | Hàm `switch` ánh xạ 18 tên sự kiện C# sang chuẩn Routing Key 4 phân đoạn `<context>.<aggregate>.<action>.v1` (ví dụ `"PaymentSucceeded" => "payment.payment.succeeded.v1"`). |
| `RabbitMqSmokeBus.cs` | `ConnectAsync`, `PublishAsync`, `EnsureConsumerAsync`, `GetAsync`, `AckAsync`, `RejectAsync` | Dùng `ConnectionFactory { Uri = new Uri(amqpUri) }`, mở `IConnection` & `IChannel` bất đồng bộ. Khi `PublishAsync`: gắn `BasicProperties` với `MessageId = EventId`, `DeliveryMode = DeliveryModes.Persistent` (ghi đĩa bền vững), `CorrelationId`, `Headers["schema-version"]`, gọi `BasicPublishAsync(exchange: "platform.events", routingKey, mandatory: true, ...)`. Khi `EnsureConsumerAsync`: khai báo Queue bền vững có tham số `"x-dead-letter-exchange": "platform.dlx"` và lặp `QueueBindAsync` cho mọi pattern routing key. |
| `OutboxRelay.cs` | `PublishPendingAsync`, `LoadPendingAsync`, `MarkPublishedAsync`, `MarkFailedAsync` | Mở `NpgsqlConnection`, truy vấn `SELECT id, payload::text FROM outbox_messages WHERE published_at IS NULL AND (next_attempt_at IS NULL OR next_attempt_at <= NOW()) ORDER BY occurred_at LIMIT 20` (khai thác Partial Index `ix_outbox_pending`). Giải mã `EventMessage`, đẩy lên `RabbitMqSmokeBus`: thành công thì `UPDATE ... SET published_at = NOW()`; lỗi mạng thì `UPDATE ... SET attempt_count = attempt_count + 1, last_error_code = 'PUBLISH_FAILED', next_attempt_at = NOW()`. |
| `OutboxDispatchHostedService.cs` | `ExecuteAsync(CancellationToken)` | Kế thừa `BackgroundService`. Giữ kết nối `RabbitMqSmokeBus` dài hạn, lặp mỗi **2.000 ms** gọi `OutboxRelay.PublishPendingAsync`. Nếu đứt kết nối RabbitMQ sẽ tự `DisposeAsync` bus cũ, nghỉ 2 giây và tự động kết nối lại ở vòng lặp kế tiếp (Self-healing loop). |
| `InboxDeduper.cs` | `TryAcceptAsync(...)` | Chạy câu SQL nguyên tử khử trùng lặp: `INSERT INTO inbox_messages (id, consumer_name, message_id, ..., payload_hash, received_at, processed_at) VALUES (...) ON CONFLICT ON CONSTRAINT uq_inbox_consumer_message DO NOTHING RETURNING id;`. Trả về `true` nếu chèn mới thành công (tin lần đầu), `false` nếu bị chặn bởi `ON CONFLICT` (tin gửi lặp!). |
| `IntegrationEventConsumerHost.cs` | `EventSubscription`, `AddEventSubscription`, `ExecuteAsync`, `PumpAsync` | Cho phép mỗi Microservice đăng ký nhiều `EventSubscription(Queue, ConsumerName, RoutingKeys, Handle)`. Khi chạy `ExecuteAsync`, dùng `subscriptions.Select(sub => PumpAsync(...))` kết hợp `await Task.WhenAll(pumps)` tạo các tác vụ tiêu thụ song song. Trong mỗi vòng `PumpAsync`: kéo tin bằng `bus.GetAsync(queue)` (`autoAck: false`), tính `SHA256.HashData(rawBytes)`, kiểm tra `InboxDeduper.TryAcceptAsync` $\rightarrow$ chạy `subscription.Handle` $\rightarrow$ gọi `bus.AckAsync(deliveryTag)`. Nếu bất kỳ bước nào ném Exception: log lỗi và gọi **`bus.RejectAsync(deliveryTag, requeue: false)`** đẩy thẳng vào Dead-Letter Exchange `platform.dlx`! |

---

## 4. Project `BusTicketPlatform.Gateway` (`workspace/src/gateway/BusTicketPlatform.Gateway/`)

- **Thư viện chính**: `Yarp.ReverseProxy 2.3.0`, `Swashbuckle.AspNetCore.SwaggerUI 10.2.3`.
- **File `Program.cs` (173 dòng)**:
  1. `builder.Services.AddBuildingBlocks()` $\rightarrow$ nạp `SystemClock` & `UuidV7IdGenerator`.
  2. `builder.Services.AddReverseProxy().LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"))` $\rightarrow$ biên dịch cây định tuyến DFA của YARP từ `appsettings.json` (gồm **58 Routes** phân cấp ưu tiên `Order: -40, -30, -20, 0, 10, 20` và **6 Clusters** `identity:5081`, `transport:5082`, `booking:5083`, `payment:5084`, `notification:5085`, `reporting:5086`).
  3. `builder.Services.AddHealthChecks().AddCheck("self", ...)` $\rightarrow$ đăng ký health probe nội tại.
  4. `builder.Services.AddCors(...)` $\rightarrow$ cấu hình policy `"clients"` đọc mảng `Cors:Origins`, mở phép gửi headers `Authorization, Content-Type, Accept, Idempotency-Key, X-Correlation-Id` và mở quyền đọc `WithExposedHeaders("X-Correlation-Id")`.
  5. Chuỗi thực thi Middleware: `UseCors("clients")` $\rightarrow$ `UseBuildingBlocks()` (`CorrelationMiddleware` + `ErrorEnvelopeMiddleware`) $\rightarrow$ `MapPlatformHealth()` $\rightarrow$ `UseSwaggerUI(...)` (trỏ tới 6 URL `/openapi/v1.json` của 6 services) $\rightarrow$ `MapGet("/openapi.yaml", ...)` $\rightarrow$ `MapReverseProxy()`.
