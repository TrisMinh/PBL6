# Phụ lục A — Thư viện và phiên bản

Nguồn quyết định là `workspace/Directory.Packages.props`, các `package.json` và `package-lock.json` của branch `fulltemplate` tại `deda437`.

## .NET production

| Package | Version | Nơi dùng | Lý do |
|---|---:|---|---|
| `Microsoft.AspNetCore.OpenApi` | 10.0.12 | ASP.NET BuildingBlocks | phát OpenAPI document |
| `Microsoft.AspNetCore.Authentication.JwtBearer` | 10.0.0 | ASP.NET/Identity | nhận và validate JWT |
| `System.IdentityModel.Tokens.Jwt` | 8.14.0 | Identity | tạo/đọc JWT |
| `Konscious.Security.Cryptography.Argon2` | 1.3.1 | Identity Infrastructure | hash password Argon2 |
| `Npgsql` | 10.0.0 | Infrastructure/Messaging | PostgreSQL driver |
| `RabbitMQ.Client` | 7.1.2 | Messaging | kết nối RabbitMQ |
| `Yarp.ReverseProxy` | 2.3.0 | Gateway | reverse proxy theo route/cluster |
| `Swashbuckle.AspNetCore.SwaggerUI` | 10.2.3 | Gateway | UI tập trung cho OpenAPI |
| `Microsoft.Extensions.Diagnostics.HealthChecks` | 10.0.0 | Infrastructure | database/dependency readiness |
| `Microsoft.Extensions.Hosting` | 10.0.0 | Infrastructure/Messaging | background hosted service |
| `Microsoft.Extensions.Configuration` | 10.0.0 | test/messaging | cấu hình runtime |
| `Microsoft.Extensions.Configuration.Abstractions` | 10.0.0 | Messaging | abstraction cấu hình |
| `Microsoft.Extensions.DependencyInjection` | 10.0.0 | test/messaging | DI container |
| `Microsoft.Extensions.Logging` | 10.0.0 | test/messaging | logging abstraction |

`SSH.NET` 2026.0.0 có trong central catalog nhưng chỉ thêm project reference khi thật sự có adapter SSH/SFTP. Không cài package chỉ vì nó xuất hiện trong catalog.

## .NET test

| Package | Version | Mục tiêu |
|---|---:|---|
| `Microsoft.NET.Test.Sdk` | 17.14.1 | test runner |
| `xunit` | 2.9.3 | test framework |
| `xunit.runner.visualstudio` | 3.1.4 | discovery/IDE runner |
| `coverlet.collector` | 6.0.4 | coverage |
| `Microsoft.AspNetCore.Mvc.Testing` | 10.0.0 | `WebApplicationFactory` |
| `Microsoft.Extensions.TimeProvider.Testing` | 10.0.0 | fake time |
| `NetArchTest.Rules` | 1.3.2 | architecture rule |
| `JsonSchema.Net` | 7.3.4 | JSON Schema validation |
| `YamlDotNet` | 16.3.0 | đọc OpenAPI/AsyncAPI YAML |
| `Testcontainers` | 4.6.0 | container test core |
| `Testcontainers.PostgreSql` | 4.6.0 | PostgreSQL integration |
| `Testcontainers.RabbitMq` | 4.6.0 | RabbitMQ integration |

## Customer Web

| Package | Version spec |
|---|---:|
| `react` | `^19.0.0` |
| `react-dom` | `^19.0.0` |
| `react-router-dom` | `^7.6.0` |
| `lucide-react` | `^1.47.0` |
| `qrcode.react` | `^4.2.0` |
| `typescript` | `~5.8.3` |
| `vite` | `^6.2.4` |
| `@vitejs/plugin-react` | `^4.4.1` |
| `@types/react` | `^19.0.0` |
| `@types/react-dom` | `^19.0.0` |

## Back-office Web

| Package | Version spec |
|---|---:|
| `react` | `^19.0.0` |
| `react-dom` | `^19.0.0` |
| `react-router-dom` | `^7.6.0` |
| `typescript` | `~5.8.3` |
| `vite` | `^6.2.4` |
| `@vitejs/plugin-react` | `^4.4.1` |
| `@types/react` | `^19.0.0` |
| `@types/react-dom` | `^19.0.0` |

## Mobile

| Package | Version spec |
|---|---:|
| `expo` | `~57.0.24` |
| `react` | `19.2.3` |
| `react-native` | `0.87.1` |
| `@react-navigation/native` | `^7.1.0` |
| `@react-navigation/native-stack` | `^7.3.0` |
| `@react-navigation/bottom-tabs` | `^7.4.0` |
| `expo-linking` | `~8.0.11` |
| `expo-secure-store` | `~15.0.8` |
| `expo-status-bar` | `~3.0.8` |
| `react-native-gesture-handler` | `~2.28.0` |
| `react-native-safe-area-context` | `~5.6.0` |
| `react-native-screens` | `~4.16.0` |
| `@types/react` | `^19.2.0` |
| `typescript` | `~5.8.3` |

## Package nội bộ

- `@busticket/api-client`: source TypeScript dùng chung, version `0.0.1`, private.
- `@busticket/ui`: design token dùng chung, version `0.0.1`, private.
- Web/Mobile tham chiếu hai package này bằng `"*"` trong npm workspace; chúng không được tải từ registry.

## Quy trình thêm thư viện mới

### .NET

1. Thêm `<PackageVersion>` vào `Directory.Packages.props`.
2. Thêm `<PackageReference Include="..." />` vào đúng `.csproj`.
3. `dotnet restore` và `dotnet build`.
4. Không thêm package vào Domain nếu đó là dependency framework/provider.

### npm

```powershell
npm install -w <workspace-name> <package>@<version>
```

Sau đó commit cả `package.json` và `package-lock.json`. Không sửa lockfile bằng tay.
