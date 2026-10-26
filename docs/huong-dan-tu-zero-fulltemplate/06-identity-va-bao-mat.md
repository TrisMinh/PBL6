# 06 — Identity và bảo mật

Identity là service nên làm đầu tiên vì Gateway, web và các service còn lại đều cần access token.

## 1. Dọn scaffold từ `develop`

Xóa các file mẫu:

```text
Identity.Api/Controllers/WeatherForecastController.cs
Identity.Api/WeatherForecast.cs
Identity.Api/BusTicketPlatform.Identity.Api.http
Identity.Application/Class1.cs
Identity.Domain/Class1.cs
Identity.Infrastructure/Class1.cs
```

Giữ bốn `.csproj`, rồi thiết lập dependency theo chương 05.

## 2. Domain

Tạo:

- `AssemblyMarker.cs`;
- `IdentityNormalizer.cs`: normalize email/username trước khi so sánh;
- `PasswordPolicy.cs`: kiểm tra độ dài và nhóm ký tự;
- `UserStatuses.cs`: trạng thái hợp lệ của tài khoản.

Không hash password trong Domain vì Argon2 là chi tiết công nghệ. Domain chỉ quyết định password có đạt policy hay không.

## 3. Application

Tạo theo thứ tự:

1. `Contracts.cs`: DTO register, verify, login, refresh, profile và admin.
2. `Ports.cs`: repository, password hasher, token service, notifier, event publisher.
3. `IdentityErrors.cs`: mã lỗi như invalid credentials, duplicate email, locked user.
4. `AuthService.cs`: register, verify, login, refresh/revoke.
5. `ProfileService.cs`: xem/cập nhật profile.
6. `AdminIdentityService.cs`: member/role/status cho admin.
7. `AssemblyMarker.cs`.

Application chỉ gọi interface trong `Ports.cs`; không `new NpgsqlConnection`, không dùng `HttpContext`.

## 4. Infrastructure

Package riêng của Identity:

```powershell
$identityInfra = 'src/services/identity/BusTicketPlatform.Identity.Infrastructure/BusTicketPlatform.Identity.Infrastructure.csproj'
dotnet add $identityInfra package Konscious.Security.Cryptography.Argon2
dotnet add $identityInfra package System.IdentityModel.Tokens.Jwt
dotnet add $identityInfra package Npgsql
```

Tạo file:

| File | Trách nhiệm |
|---|---|
| `Persistence/IdentityRepository.cs` | query user, challenge, refresh token, role/membership |
| `Persistence/IdempotencyStore.cs` | lưu response theo key |
| `Security/Argon2PasswordHasher.cs` | hash/verify password với salt |
| `Security/JwtTokenService.cs` | tạo access/refresh token và claim |
| `Security/ChallengeNotifier.cs` | gửi mã verify/reset qua adapter local |
| `RegistrationEvents.cs` | event sau khi đăng ký/xác minh |
| `OutboxPublisher.cs` | ghi event vào outbox |
| `InboxDeduper.cs` | bỏ event trùng |
| `IdentityInfrastructureExtensions.cs` | đăng ký toàn bộ dependency |
| `IdentityDatabaseOptions.cs` | đọc `ConnectionStrings:Identity` |
| `SqlBaselineMigrator.cs` | áp SQL embedded |
| `SqlBaselineHostedService.cs` | gọi migrator lúc startup |
| `PostgresHealthCheck.cs` | health database |

Không lưu plain-text password hoặc refresh token. Với refresh token, lưu hash/token identifier để có thể revoke an toàn.

## 5. API

Tạo:

- `HttpResults.cs`: helper chuyển lỗi Identity sang HTTP;
- `IdentityEndpoints.cs`: nhóm `/api/v1/auth`, `/api/v1/users`, `/api/v1/admin`;
- `Program.cs`: đăng ký DI, JWT, authorization, health, OpenAPI;
- `appsettings*.json` và `launchSettings.json`.

Các endpoint tối thiểu:

```text
POST /api/v1/auth/register
POST /api/v1/auth/verify
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/users/me
PATCH /api/v1/users/me
GET/PATCH các route admin/membership theo OpenAPI
```

## 6. Cấu hình JWT

Các service phải dùng cùng issuer, audience và signing key trong local development. Production phải lấy key từ secret manager, không commit vào Git.

Validation bắt buộc:

- issuer;
- audience;
- signing key;
- lifetime;
- role claim;
- `sub` làm name/user id.

Clock skew trong template là 30 giây.

## 7. Seed account local

`docs/database/identity/011_dev_login_seed.sql` tạo account chỉ dành cho local/test:

| Vai trò | Email | Password |
|---|---|---|
| Customer | `seed.customer@example.test` | `CustomerPass1` |
| Operator | `operator.seed@example.test` | `OperatorPass1` |
| Platform admin | `admin.seed@example.test` | `AdminPass1234` |
| Driver | `driver.seed@example.test` | `DriverPass1` |

Không tái sử dụng các credential này ngoài local/test.

## Checkpoint 06

Sau khi infra chạy:

```powershell
Set-Location workspace
./scripts/dev-host.ps1
```

Ở terminal khác:

```powershell
Invoke-RestMethod http://localhost:5081/live
Invoke-RestMethod http://localhost:5081/ready
```

Sau đó gửi request login bằng account seed. Response phải có token và dùng token gọi được `/api/v1/users/me`.
