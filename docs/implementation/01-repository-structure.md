# Cấu trúc repository và dependency rule

## Monorepo mục tiêu

```text
PBL6/
├── .gitignore
├── README.md
├── docs/
│   ├── srs/
│   │   ├── v1/
│   │   ├── v2/
│   │   └── word/
│   ├── system-design/
│   ├── detailed-design/
│   ├── implementation/
│   ├── diagrams/
│   ├── contracts/
│   └── database/
├── task-tracking/
│   ├── people/
│   ├── board/
│   ├── registers/
│   └── templates/
└── workspace/
    ├── BusTicketPlatform.sln
    ├── global.json
    ├── Directory.Build.props
    ├── Directory.Packages.props
    ├── package.json
    ├── package-lock.json
    ├── tsconfig.base.json
    ├── redocly.yaml
    └── src/
        ├── apps/
        │   ├── customer-web/
        │   ├── backoffice-web/
        │   └── mobile/
        ├── gateway/
        ├── services/
        │   ├── identity/
        │   ├── transport/
        │   ├── booking/
        │   ├── payment/
        │   ├── notification/
        │   └── reporting/
        ├── building-blocks/
        ├── infra/
        └── tests/
```

## Cấu trúc một service

```text
workspace/src/services/<service>/
├── BusTicketPlatform.<Service>.Api/
├── BusTicketPlatform.<Service>.Application/
├── BusTicketPlatform.<Service>.Domain/
├── BusTicketPlatform.<Service>.Infrastructure/
├── BusTicketPlatform.<Service>.Worker/
└── README.md

workspace/src/tests/services/<service>/
├── BusTicketPlatform.<Service>.UnitTests/
├── BusTicketPlatform.<Service>.IntegrationTests/
└── BusTicketPlatform.<Service>.ContractTests/
```

Worker project chỉ tạo khi service có outbox publisher, consumer hoặc scheduled job; không tạo deployable rỗng.

## Dependency rule

- `Domain` không tham chiếu ASP.NET Core, EF Core, RabbitMQ, Redis hoặc provider SDK.
- `Application` tham chiếu Domain và khai báo ports/use cases; không chứa controller/ORM mapping.
- `Infrastructure` triển khai persistence, messaging, provider và security adapters.
- `Api/Worker` là composition root; không đặt business rule trong controller/consumer.
- Service không project-reference code của service khác.
- `building-blocks` chỉ chứa primitive kỹ thuật: correlation, event envelope, safe error, telemetry và test fixture. Không chứa entity/DTO/rule nghiệp vụ dùng chung.
- Client type được sinh từ OpenAPI; không viết lại DTO bằng tay.

## Build và ownership

- Mỗi service/app có thể restore, build, test và tạo image độc lập.
- `workspace/package.json` dùng npm workspaces cho `workspace/src/apps/*` và package UI/contract client; chỉ commit một `workspace/package-lock.json`, không trộn npm/pnpm/yarn.
- `workspace/global.json` pin SDK feature band mà nhóm/CI thống nhất và cho phép roll-forward patch an toàn; mọi `.csproj` bắt buộc target `net8.0`. SDK mới hơn có thể build `net8.0` nhưng không được tự đổi Target Framework.
- Migration/credential/database history thuộc đúng service.
- `docs/contracts` và `docs/database` là baseline có thể kiểm định; EF Core migration chạy thật vẫn thuộc `Infrastructure` của từng service.
- Pull request đổi contract phải chạy producer/consumer compatibility test.
- `CODEOWNERS` theo workstream được thêm khi nhóm gán tên thành viên; không tự suy đoán người sở hữu từ báo cáo Word.

## Naming

- Namespace: `BusTicketPlatform.<BoundedContext>.<Layer>`.
- Assembly và container dùng tên service ổn định, chữ thường/kebab-case ở hạ tầng.
- Public JSON dùng `camelCase`; C# dùng PascalCase; mapping explicit ở serialization contract.
- ID nội bộ/correlation/message là UUIDv7 do application tạo; external provider reference dùng string riêng, không ép thành UUID.
