# Workspace PBL6

## Chạy toàn bộ hệ thống trên Windows

Từ thư mục `workspace`, chạy lệnh sau với Docker Desktop đang dùng Linux containers.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ..\Setup-PBL6.ps1
```

Setup khởi động project Docker `pbl6-operating` và nạp bộ dữ liệu vận hành giả lập của 16 nhà xe. Xem [quy trình cài đặt và khôi phục dữ liệu](./src/data-backup/README.md) nếu cần dùng snapshot riêng.

## Đăng nhập local

Các tài khoản dưới đây dùng chung mật khẩu `CustomerPass1`.

| Cổng | Tài khoản |
|---|---|
| [Khách hàng](http://localhost:5173/login) | `customer.00001@demo.blue.example.test` |
| [Nhà xe · Cánh Buồm Sông Hàn](http://localhost:5174/login) | `operator.02@demo.blue.example.test` |
| [Nhà xe · Đường Mây Kinh Bắc](http://localhost:5174/login) | `operator.03@demo.blue.example.test` |
| [Nhà xe · Hải Vân Lam](http://localhost:5174/login) | `operator.01@demo.blue.example.test` |
| [Nhà xe · Tài chính Hải Vân Lam](http://localhost:5174/login) | `finance.01@demo.blue.example.test` |
| [Quản trị](http://localhost:5175/login) | `admin@demo.blue.example.test` |

## Mã nguồn và API

- [Cấu trúc mã nguồn](./src/README.md)
- [Swagger qua Gateway](http://localhost:5080/swagger) và [đặc tả OpenAPI](../docs/contracts/openapi/platform-mvp.openapi.yaml)
- [Bộ kiểm thử API Postman](./postman/README.md)
- [Mailpit](http://localhost:8025)

## Phát triển và kiểm thử

Chạy `dotnet build BusTicketPlatform.sln` hoặc `dotnet test BusTicketPlatform.sln` từ `workspace`. Các bài kiểm thử tích hợp cần Docker.

Mã giao diện chung nằm tại [src/apps/web](./src/apps/web). Từ thư mục đó, dùng `pnpm install`, `pnpm typecheck` và `pnpm test` với phiên bản Node và pnpm trong `package.json`. Các lệnh `npm run dev:customer`, `npm run dev:operator` và `npm run dev:admin` ở `workspace` mở từng cổng để phát triển.

Tài liệu thiết kế và kế hoạch nằm tại [docs](../docs/README.md) và [task-tracking](../task-tracking/README.md).
