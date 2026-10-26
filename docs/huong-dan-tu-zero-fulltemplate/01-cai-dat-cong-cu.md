# 01 — Cài đặt công cụ

## 1. Công cụ bắt buộc

| Công cụ | Phiên bản mục tiêu | Dùng để làm gì |
|---|---:|---|
| Git | bản ổn định hiện hành | branch, commit, so sánh template |
| .NET SDK | `10.0.401` | build toàn bộ backend |
| Node.js | 20 LTS trở lên | React, Vite, Expo |
| npm | đi kèm Node | npm workspaces và package lock |
| Docker Desktop | Compose v2 | PostgreSQL, RabbitMQ, Redis, Mailpit |
| Visual Studio 2026 hoặc VS Code | tùy chọn | viết và debug code |
| PowerShell 7 | khuyến nghị | chạy script trong `workspace/scripts` |

`workspace/global.json` khóa SDK ở `10.0.401` và cho phép `latestPatch`. Nếu máy chỉ có SDK cũ hơn, build sẽ không đáng tin cậy.

## 2. Kiểm tra sau khi cài

```powershell
git --version
dotnet --version
node --version
npm --version
docker --version
docker compose version
```

Kỳ vọng:

- `dotnet --version` trả về `10.0.401` hoặc patch tương thích;
- `node` không thấp hơn 20;
- `docker compose version` chạy được, không phải lệnh `docker-compose` đời cũ.

## 3. Chuẩn bị repository

```powershell
git clone <URL-cua-repository> PBL6
Set-Location PBL6
git fetch --all --prune
git switch -c learning/rebuild-fulltemplate origin/develop
```

Nếu repository đã có sẵn, chỉ chạy ba lệnh cuối.

## 4. Kiểm tra port trước khi chạy

| Port | Thành phần |
|---:|---|
| 5080 | Gateway |
| 5081–5086 | 6 API service |
| 5173 | Customer Web |
| 5174 | Back-office |
| 5432 | PostgreSQL |
| 5672 / 15672 | RabbitMQ / management |
| 6379 | Redis |
| 8025 / 1025 | Mailpit web / SMTP |
| 8099 | VNPay simulator |

Kiểm tra ví dụ:

```powershell
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object LocalPort -In 5080,5081,5082,5083,5084,5085,5086,5173,5174,5432,5672,6379,8025,8099
```

## 5. Kiến thức tối thiểu trước khi code

Bạn chỉ cần hiểu các ý sau; không cần học hết framework trước:

- project `.csproj` là đơn vị build của .NET;
- solution `.sln` nhóm nhiều project;
- dependency injection đăng ký object trước, framework tạo object khi chạy;
- HTTP endpoint nhận request và trả response;
- database migration tạo cấu trúc dữ liệu;
- Docker Compose chạy nhiều container cùng lúc;
- `package.json` mô tả thư viện và script JavaScript;
- TypeScript là JavaScript có kiểm tra kiểu.

## Checkpoint 01

```powershell
dotnet --info
docker run --rm hello-world
node -e "console.log('Node OK')"
```

Chỉ sang chương 02 khi cả ba lệnh đều thành công.
