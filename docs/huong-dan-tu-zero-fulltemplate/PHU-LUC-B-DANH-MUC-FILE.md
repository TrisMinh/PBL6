# Phụ lục B — Danh mục file cần có

Danh mục này là checklist cấu trúc của `fulltemplate`. `node_modules`, `bin`, `obj` và output build không được liệt kê.

## 1. Root và workspace

```text
/.dockerignore                 bỏ file không cần khỏi Docker context
/.env.example                 mẫu biến môi trường, không chứa secret thật
/.gitattributes               quy ước line ending/text
/.gitignore                   bỏ secret, output và dependency cache
/README.md                    điểm vào repository
/workspace/BusTicketPlatform.sln
/workspace/global.json
/workspace/Directory.Build.props
/workspace/Directory.Packages.props
/workspace/package.json
/workspace/package-lock.json
/workspace/redocly.yaml
/workspace/README.md
/workspace/src/README.md
```

## 2. Building Blocks

```text
src/building-blocks/BusTicketPlatform.BuildingBlocks/
├─ BusTicketPlatform.BuildingBlocks.csproj
├─ AssemblyMarker.cs
├─ Correlation/CorrelationDefaults.cs
├─ Errors/AppError.cs
├─ Errors/ErrorCodes.cs
├─ Errors/ErrorMapper.cs
├─ Errors/PlatformErrors.cs
├─ Http/ErrorEnvelope.cs
├─ Idempotency/IIdempotencyStore.cs
├─ Ids/IIdGenerator.cs
├─ Ids/UuidV7IdGenerator.cs
├─ Logging/LogRedaction.cs
├─ Results/Result.cs
├─ Telemetry/TelemetryConventions.cs
├─ Time/IClock.cs
└─ Time/SystemClock.cs

src/building-blocks/BusTicketPlatform.BuildingBlocks.AspNetCore/
├─ BusTicketPlatform.BuildingBlocks.AspNetCore.csproj
├─ Auth/PlatformJwtExtensions.cs
├─ Correlation/CorrelationMiddleware.cs
├─ Health/HealthEndpointExtensions.cs
├─ HostingExtensions.cs
├─ Http/ErrorEnvelopeMiddleware.cs
├─ Http/PlatformHttp.cs
└─ OpenApiExtensions.cs

src/building-blocks/BusTicketPlatform.BuildingBlocks.Messaging/
├─ BusTicketPlatform.BuildingBlocks.Messaging.csproj
├─ EventMessage.cs
├─ IEventPublisher.cs
├─ InboxDeduper.cs
├─ IntegrationEventConsumerHost.cs
├─ OutboxDispatchHostedService.cs
├─ OutboxRelay.cs
├─ OutboxRouting.cs
└─ RabbitMqSmokeBus.cs
```

## 3. Mẫu file lặp cho mỗi service

Mỗi `{Name}`/`{slug}` có:

```text
src/services/{slug}/BusTicketPlatform.{Name}.Domain/
├─ BusTicketPlatform.{Name}.Domain.csproj
└─ AssemblyMarker.cs

src/services/{slug}/BusTicketPlatform.{Name}.Application/
├─ BusTicketPlatform.{Name}.Application.csproj
└─ AssemblyMarker.cs

src/services/{slug}/BusTicketPlatform.{Name}.Infrastructure/
├─ BusTicketPlatform.{Name}.Infrastructure.csproj
├─ AssemblyMarker.cs
├─ {Name}DatabaseOptions.cs
├─ {Name}InfrastructureExtensions.cs
├─ OutboxWriter.cs
├─ Persistence/IdempotencyStore.cs
├─ Persistence/{Name}Repository.cs
├─ PostgresHealthCheck.cs
├─ SqlBaselineHostedService.cs
└─ SqlBaselineMigrator.cs

src/services/{slug}/BusTicketPlatform.{Name}.Api/
├─ BusTicketPlatform.{Name}.Api.csproj
├─ Program.cs
├─ appsettings.json
├─ appsettings.Development.json
└─ Properties/launchSettings.json
```

## 4. File nghiệp vụ riêng từng service

### Identity

```text
Api/HttpResults.cs
Api/IdentityEndpoints.cs
Application/AdminIdentityService.cs
Application/AuthService.cs
Application/Contracts.cs
Application/IdentityErrors.cs
Application/Ports.cs
Application/ProfileService.cs
Domain/IdentityNormalizer.cs
Domain/PasswordPolicy.cs
Domain/UserStatuses.cs
Infrastructure/InboxDeduper.cs
Infrastructure/OutboxPublisher.cs
Infrastructure/RegistrationEvents.cs
Infrastructure/Security/Argon2PasswordHasher.cs
Infrastructure/Security/ChallengeNotifier.cs
Infrastructure/Security/JwtTokenService.cs
```

Identity dùng `OutboxPublisher.cs` thay cho mẫu `OutboxWriter.cs` và đăng ký JWT riêng trong Api.

### Transport

```text
Api/TransportEndpoints.cs
Application/Contracts.cs
Application/TransportService.cs
Domain/Roles.cs
Infrastructure/TransportEventHandlers.cs
Infrastructure/TransportEvents.cs
```

### Booking

```text
Api/BookingEndpoints.cs
Application/BookingService.cs
Application/Contracts.cs
Application/TicketQr.cs
Infrastructure/BookingEventHandlers.cs
Infrastructure/BookingEvents.cs
```

### Payment

```text
Api/PaymentEndpoints.cs
Application/PaymentService.cs
Application/VnPayCheckout.cs
Infrastructure/PaymentEventHandlers.cs
Infrastructure/PaymentEvents.cs
```

### Notification

```text
Application/NotificationService.cs
Infrastructure/NotificationEventHandlers.cs
```

Notification Api hiện chỉ cần `Program.cs`; event consumer là đầu vào chính.

### Reporting

```text
Application/ReportingService.cs
Infrastructure/ReportingEventHandlers.cs
```

Reporting Api hiện map route trong `Program.cs`; read model được cập nhật từ event.

## 5. Gateway

```text
src/gateway/BusTicketPlatform.Gateway/
├─ BusTicketPlatform.Gateway.csproj
├─ Program.cs
├─ appsettings.json
├─ appsettings.Development.json
└─ Properties/launchSettings.json
```

## 6. Apps và package TypeScript

```text
src/packages/api-client/package.json
src/packages/api-client/src/index.ts
src/packages/ui/package.json
src/packages/ui/theme.ts
src/packages/ui/tokens.css

src/apps/customer-web/
├─ package.json
├─ index.html
├─ tsconfig.json
├─ vite.config.ts
├─ src/App.tsx
├─ src/main.tsx
├─ src/session.tsx
├─ src/styles.css
├─ src/vite-env.d.ts
└─ public/images/{coach-cabin,coach-night,coach-seats,coach-side,hero-highway}.jpg

src/apps/backoffice-web/
├─ package.json
├─ index.html
├─ tsconfig.json
├─ vite.config.ts
├─ src/App.tsx
├─ src/main.tsx
├─ src/session.tsx
├─ src/styles.css
└─ src/vite-env.d.ts

src/apps/mobile/
├─ package.json
├─ app.json
├─ babel.config.js
├─ metro.config.js
├─ index.ts
├─ tsconfig.json
├─ src/session.ts
├─ src/types.ts
├─ src/ui.tsx
└─ src/screens/Auth.tsx
```

## 7. Infra và script

```text
src/infra/README.md
src/infra/docker-compose.yml
src/infra/docker-compose.apps.yml
src/infra/docker/api.Dockerfile
src/infra/docker/web.Dockerfile
src/infra/docker/web-package.json
src/infra/docker/nginx-web.conf
src/infra/payment-simulator/Dockerfile
src/infra/payment-simulator/simulator.py
src/infra/postgres/bootstrap.sh
src/infra/postgres/init/00-create-databases.sql
src/infra/rabbitmq/definitions.json
src/infra/rabbitmq/rabbitmq.conf

scripts/apply-dev-seed.ps1
scripts/dev-docker.ps1
scripts/dev-env.ps1
scripts/dev-host.ps1
scripts/gen_service_skeleton.py
scripts/hash-password.cs
scripts/verify-contracts.ps1
scripts/verify-s0.ps1
```

## 8. Test projects

```text
src/tests/architecture/BusTicketPlatform.ArchitectureTests/
├─ BusTicketPlatform.ArchitectureTests.csproj
├─ GlobalUsings.cs
├─ LayerDependencyTests.cs
└─ ProjectReferenceTests.cs

src/tests/building-blocks/BusTicketPlatform.BuildingBlocks.UnitTests/
├─ BusTicketPlatform.BuildingBlocks.UnitTests.csproj
├─ GlobalUsings.cs
├─ CorrelationMiddlewareTests.cs
├─ ErrorMapperTests.cs
├─ LogRedactionTests.cs
├─ PrimitiveTests.cs
└─ ResultTests.cs

src/tests/contracts/BusTicketPlatform.ContractTests/
├─ BusTicketPlatform.ContractTests.csproj
├─ GlobalUsings.cs
├─ ContractGateTests.cs
├─ MessageSchemaTests.cs
└─ Fixtures/{invalid-openapi.yaml,invalid-sql.sql}

src/tests/gateway/BusTicketPlatform.Gateway.IntegrationTests/
├─ BusTicketPlatform.Gateway.IntegrationTests.csproj
├─ GlobalUsings.cs
├─ GatewayClientSurfaceTests.cs
└─ GatewayHealthAndErrorTests.cs

src/tests/identity/BusTicketPlatform.Identity.Api.IntegrationTests/
├─ BusTicketPlatform.Identity.Api.IntegrationTests.csproj
├─ GlobalUsings.cs
├─ AuthFlowTests.cs
├─ IdentityHealthTests.cs
├─ IdentitySqlBaselineTests.cs
├─ PasswordPolicyTests.cs
└─ SecurityAndAdminTests.cs

src/tests/messaging/BusTicketPlatform.Messaging.IntegrationTests/
├─ BusTicketPlatform.Messaging.IntegrationTests.csproj
├─ GlobalUsings.cs
├─ IntegrationEventConsumerTests.cs
└─ MessagingSmokeTests.cs
```

Service test còn lại:

| Service | Test chính | File token phụ |
|---|---|---|
| Booking | `BookingFlowTests.cs` | `TestJwt.cs` |
| Transport | `TransportFlowTests.cs` | `TestJwt.cs` |
| Payment | `PaymentFlowTests.cs` | `TestJwt.cs` |
| Notification | `NotificationHealthTests.cs` | `TestJwt.cs` |
| Reporting | `ReportingHealthTests.cs` | `TestJwt.cs` |

Mỗi thư mục trên còn có `.csproj` và `GlobalUsings.cs` theo đúng tên service.

## 9. Database

```text
docs/database/_shared/000_integration_tables.sql
docs/database/identity/{001_initial,010_synthetic_seed,011_dev_login_seed}.sql
docs/database/transport/{001_initial,010_synthetic_seed,011_more_seed_seats,012_seed_driver,013_seed_amenities}.sql
docs/database/booking/{001_initial,010_synthetic_seed,012_rebook_after_cancel,013_more_seed_seats}.sql
docs/database/payment/001_initial.sql
docs/database/notification/001_initial.sql
docs/database/reporting/{001_initial,011_seed_occupancy}.sql
docs/database/README.md
```

## 10. File không được có ở kết quả cuối

```text
**/Class1.cs
**/WeatherForecast.cs
**/WeatherForecastController.cs
**/node_modules (trong Git)
**/bin (trong Git)
**/obj (trong Git)
**/.env chứa secret thật
```
