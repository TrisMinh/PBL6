# 09 — Kiểm thử

## 1. Tạo project test đúng loại

| Nhóm | Mục tiêu | Công cụ chính |
|---|---|---|
| Building Blocks Unit | primitive, mapper, middleware | xUnit, coverlet |
| Architecture | chiều dependency | NetArchTest |
| Contract | OpenAPI/AsyncAPI/JSON Schema/SQL | JsonSchema.Net, YamlDotNet |
| Gateway Integration | health, route, error surface | WebApplicationFactory |
| Service Integration | API + PostgreSQL thật | WebApplicationFactory, Testcontainers |
| Messaging Integration | PostgreSQL + RabbitMQ thật | Testcontainers PostgreSql/RabbitMq |

## 2. Quy ước chung

Mỗi test project có:

- `.csproj` với `<IsTestProject>true</IsTestProject>`;
- `GlobalUsings.cs` cho xUnit;
- project reference tới system under test;
- package version lấy từ `Directory.Packages.props`;
- không phụ thuộc thứ tự test;
- dữ liệu test riêng, có cleanup/idempotency.

## 3. Unit test

Tạo các file như template:

- `ResultTests.cs`;
- `PrimitiveTests.cs`;
- `ErrorMapperTests.cs`;
- `LogRedactionTests.cs`;
- `CorrelationMiddlewareTests.cs`.

Mỗi test theo Arrange–Act–Assert và chỉ kiểm tra một hành vi.

## 4. Architecture test

Tạo:

- `LayerDependencyTests.cs`: Domain không phụ thuộc Api/Infrastructure; Application không phụ thuộc Api/Infrastructure.
- `ProjectReferenceTests.cs`: đọc reference thực tế và chặn dependency ngược.

Architecture test giúp ngăn một chỉnh sửa nhỏ phá kiến trúc mà build thông thường vẫn cho qua.

## 5. Contract test

Tạo:

- `ContractGateTests.cs`: parse OpenAPI/AsyncAPI và validate file SQL bắt buộc;
- `MessageSchemaTests.cs`: validate example/event payload bằng JSON Schema;
- `Fixtures/invalid-openapi.yaml` và `invalid-sql.sql`: chứng minh gate thật sự bắt lỗi.

Test âm tính rất quan trọng: nếu fixture sai vẫn pass, validator đang không có tác dụng.

## 6. API integration test

Mỗi service có test project riêng. Mẫu file:

- `<Feature>FlowTests.cs` hoặc `<Service>HealthTests.cs`;
- `TestJwt.cs` cho service cần claim/role;
- `GlobalUsings.cs`;
- `.csproj`.

Quy trình test:

1. khởi động PostgreSQL bằng Testcontainers;
2. override connection string trong `WebApplicationFactory`;
3. app tự áp baseline;
4. tạo JWT test nếu cần;
5. gọi HTTP thật trong memory;
6. assert status, body và database side effect.

Không mock repository trong integration test vì mục tiêu là bắt lỗi SQL, DI, serialization và middleware.

## 7. Messaging test

Khởi động PostgreSQL và RabbitMQ containers. Kiểm tra:

- publish/consume smoke;
- outbox được relay và đánh dấu sent;
- inbox không xử lý event trùng;
- event version/type/routing đúng;
- consumer retry/failure không làm mất message.

## 8. Chạy test theo vòng nhỏ

```powershell
dotnet test --filter FullyQualifiedName~BuildingBlocks
dotnet test --filter FullyQualifiedName~Architecture
dotnet test --filter FullyQualifiedName~Contract
dotnet test --filter FullyQualifiedName~Identity
dotnet test --filter FullyQualifiedName~Transport
dotnet test --filter FullyQualifiedName~Booking
dotnet test --filter FullyQualifiedName~Payment
dotnet test --filter FullyQualifiedName~Notification
dotnet test --filter FullyQualifiedName~Reporting
dotnet test --filter FullyQualifiedName~Messaging
dotnet test
```

Nếu Testcontainers báo không kết nối được, mở Docker Desktop và chạy `docker info` trước khi sửa code test.

## Checkpoint 09

```powershell
dotnet test --no-restore
```

Không bỏ qua test đỏ để đi tiếp. Ghi lại test nào đỏ, lỗi đầu tiên và thay đổi vừa thực hiện; sửa nguyên nhân gốc trước.
