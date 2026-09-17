# Development Prerequisites

## Toolchain bắt buộc

| Tool | Baseline | Mục đích |
|---|---|---|
| .NET Target Framework | `net10.0` cho mọi project | ASP.NET Core, EF Core, test/build cùng một runtime contract |
| .NET SDK | .NET SDK `10.0.4xx`; pin feature band trong `workspace/global.json` | Dùng dòng .NET 10 LTS thống nhất; không trộn TFM giữa service |
| Node.js | 24.x LTS | React/Vite/React Native toolchain |
| npm | Đi kèm Node 24; pin `packageManager` trong `workspace/package.json` | Workspaces và một lockfile |
| Docker engine + Compose v2 | Bản còn hỗ trợ | PostgreSQL, RabbitMQ, Redis, Mailpit, provider simulator, observability |
| Git | Bản còn hỗ trợ | Source/version workflow |
| Android toolchain | JDK/Android SDK tương thích React Native 0.87 | Chỉ bắt buộc khi chạy Mobile Android |

## Trạng thái workstation cập nhật ngày 2026-09-17

| Check | Kết quả |
|---|---|
| Node.js | Có `v24.18.0`; đạt dòng LTS đã chọn |
| npm | Có `11.16.0` |
| .NET SDK | Cài và pin `10.0.401` trong `workspace/global.json` |
| .NET 10 runtime | Có `Microsoft.NETCore.App` và `Microsoft.AspNetCore.App 10.0.12`; đạt target runtime local |
| Docker/Compose | Docker client `29.7.2`, Compose `5.5.1` đã cài; Docker Desktop Linux engine chưa chạy nên **chưa đạt** integration/local stack |

Workstation hiện có thể scaffold và build project `net10.0`. Trước khi chạy migration/integration test hoặc full local stack, khởi động Docker Desktop và xác nhận `docker version` có cả Client lẫn Server section; việc chỉ có CLI/Compose chưa đủ.

## Bootstrap gate

1. Từ `workspace/`, `dotnet build` thành công với toàn bộ `.csproj` target `net10.0`; `workspace/global.json` resolve đúng SDK đã pin cho nhóm/CI.
2. `node --version` trả 24.x; `npm --version` chạy được.
3. `docker version` và `docker compose version` thành công trước integration test.
4. OpenAPI, AsyncAPI và JSON Schema lint/validate sạch.
5. Không có secret thật trong repository; local secret đi qua user-secrets hoặc `.env` đã ignore.
