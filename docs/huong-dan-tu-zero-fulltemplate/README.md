# Hướng dẫn từ số 0 đến `fulltemplate`

Tài liệu này dành cho người chưa quen .NET, React, Docker hay kiến trúc microservice. Mục tiêu không phải chép nguyên branch `fulltemplate`, mà là tự dựng lại hệ thống theo thứ tự có thể hiểu, chạy và kiểm tra sau từng chặng.

## Baseline được dùng

- Điểm xuất phát: `origin/develop` tại commit `c2b7ff8`.
- Đích tham chiếu: `fulltemplate` tại commit `deda437`.
- Tên "develope" trong yêu cầu được hiểu là branch `origin/develop`, vì repository không có branch `develope`.
- Mọi lệnh trong tài liệu chạy bằng PowerShell trên Windows, trừ khi có ghi chú khác.
- Thư mục làm việc của mã nguồn là `PBL6/workspace`.

Không checkout hoặc copy đè `fulltemplate` trong lúc học. Hãy tạo branch học tập từ `develop`, hoàn thành từng checkpoint rồi mới so sánh với `fulltemplate`.

## Cách học đúng bộ tài liệu này

1. Đọc một chương, không đọc nhảy.
2. Gõ lại lệnh thay vì copy cả thư mục từ `fulltemplate`.
3. Sau mỗi nhóm file, chạy checkpoint được ghi ở cuối chương.
4. Chỉ chuyển chương khi checkpoint xanh.
5. Commit sau mỗi checkpoint để có điểm quay lại.
6. Khi bí, so sánh đúng file với `fulltemplate`, không merge toàn bộ branch.

Ví dụ so sánh một file:

```powershell
git diff origin/develop fulltemplate -- workspace/src/gateway/BusTicketPlatform.Gateway/Program.cs
git show fulltemplate:workspace/src/gateway/BusTicketPlatform.Gateway/Program.cs
```

## Thứ tự thực hiện

| Chặng | Kết quả phải đạt | Tài liệu |
|---|---|---|
| 0 | Hiểu `develop` có gì và `fulltemplate` thêm gì | [00](./00-ban-do-develop-den-fulltemplate.md) |
| 1 | Cài đủ công cụ, chạy được lệnh kiểm tra | [01](./01-cai-dat-cong-cu.md) |
| 2 | Tạo solution, cấu hình chung và npm workspace | [02](./02-khoi-tao-workspace.md) |
| 3 | Tạo primitive, error, middleware và messaging dùng chung | [03](./03-building-blocks.md) |
| 4 | Chạy PostgreSQL, RabbitMQ, Redis, Mailpit và simulator | [04](./04-ha-tang-database-messaging.md) |
| 5 | Tạo đúng cấu trúc bốn tầng cho sáu service | [05](./05-tao-microservice.md) |
| 6 | Hoàn thiện Identity, JWT, Argon2 và seed user | [06](./06-identity-va-bao-mat.md) |
| 7 | Dựng Gateway, YARP, CORS và OpenAPI | [07](./07-gateway-va-openapi.md) |
| 8 | Dựng Customer Web, Back-office và Mobile | [08](./08-web-va-mobile.md) |
| 9 | Viết unit, architecture, contract và integration test | [09](./09-kiem-thu.md) |
| 10 | Chạy toàn hệ thống và nghiệm thu | [10](./10-chay-debug-nghiem-thu.md) |

Tài liệu tra cứu:

- [Danh sách thư viện và lý do sử dụng](./PHU-LUC-A-THU-VIEN.md)
- [Danh mục file cần có](./PHU-LUC-B-DANH-MUC-FILE.md)
- [Checklist hoàn thành](./CHECKLIST.md)

## Quy ước kiến trúc cần nhớ

Mỗi service có bốn project:

```text
Api -> Application -> Domain
 |          ^
 v          |
Infrastructure
```

- `Domain`: quy tắc nghiệp vụ thuần, không biết HTTP, PostgreSQL hay RabbitMQ.
- `Application`: use case, DTO và port/interface.
- `Infrastructure`: PostgreSQL, RabbitMQ, mã hóa, adapter bên ngoài.
- `Api`: endpoint, authentication, middleware và composition root.
- `BuildingBlocks`: phần dùng chung nhưng không chứa nghiệp vụ riêng của service.

Nếu một file không biết đặt ở đâu, hãy hỏi: "Nó thay đổi vì nghiệp vụ, vì công nghệ lưu trữ, hay vì cách giao tiếp HTTP?" Câu trả lời lần lượt dẫn tới Domain/Application, Infrastructure hoặc Api.

## Definition of Done của toàn bộ lộ trình

```powershell
Set-Location workspace
dotnet restore
dotnet build
dotnet test
npm install
npm run build:web
docker compose -f src/infra/docker-compose.yml config
```

Sau đó chạy stack và kiểm tra các URL ở chương 10. Chỉ được xem là giống `fulltemplate` khi cả build, test, health check, đăng nhập seed và luồng tìm chuyến/đặt vé cơ bản đều hoạt động.
