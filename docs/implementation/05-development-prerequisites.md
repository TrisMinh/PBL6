# Development Prerequisites

## Toolchain bắt buộc

| Tool | Baseline | Mục đích |
|---|---|---|
| .NET Target Framework | `net8.0` cho mọi project | ASP.NET Core, EF Core, test/build cùng một runtime contract |
| .NET SDK | SDK có khả năng build `net8.0`; pin một feature band trong `global.json` khi tạo source | SDK build có thể mới hơn Target Framework; không trộn TFM giữa service |
| Node.js | 24.x LTS | React/Vite/React Native toolchain |
| npm | Đi kèm Node 24; pin `packageManager` ở root | Workspaces và một lockfile |
| Docker engine + Compose v2 | Bản còn hỗ trợ | PostgreSQL, RabbitMQ, Redis, Mailpit, provider simulator, observability |
| Git | Bản còn hỗ trợ | Source/version workflow |
| Android toolchain | JDK/Android SDK tương thích React Native 0.87 | Chỉ bắt buộc khi chạy Mobile Android |

## Trạng thái workstation kiểm tra ngày 2026-09-09

| Check | Kết quả |
|---|---|
| Node.js | Có `v24.18.0`; đạt dòng LTS đã chọn |
| npm | Có `11.16.0` |
| .NET SDK | Có `9.0.316`; lệnh template dry-run đã xác minh có thể tạo project target `net8.0` |
| .NET 8 runtime | Có `Microsoft.NETCore.App` và `Microsoft.AspNetCore.App 8.0.29`; đạt target runtime local |
| Docker/Compose | Không tìm thấy command; **chưa đạt** integration/local stack |

Workstation hiện có thể scaffold và build project `net8.0`. Trước khi chạy migration/integration test hoặc full local stack, cài Docker Desktop/engine có Compose v2. Việc cài tool là thay đổi máy người dùng nên không được tự động thực hiện như một phần chỉnh tài liệu.

## Bootstrap gate

1. `dotnet build` thành công với toàn bộ `.csproj` target `net8.0`; `global.json` resolve đúng SDK đã pin cho nhóm/CI.
2. `node --version` trả 24.x; `npm --version` chạy được.
3. `docker version` và `docker compose version` thành công trước integration test.
4. OpenAPI, AsyncAPI và JSON Schema lint/validate sạch.
5. Không có secret thật trong repository; local secret đi qua user-secrets hoặc `.env` đã ignore.
