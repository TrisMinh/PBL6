# 07 — Gateway và OpenAPI

`develop` dùng đường dẫn `src/api-gateways/BusTicketPlatform.ApiGateway`; `fulltemplate` chuẩn hóa thành `src/gateway/BusTicketPlatform.Gateway`. Chỉ giữ một Gateway cuối cùng để tránh route/port trùng.

## 1. Tạo project

```powershell
dotnet new web -n BusTicketPlatform.Gateway `
  -o src/gateway/BusTicketPlatform.Gateway
dotnet sln add src/gateway/BusTicketPlatform.Gateway/BusTicketPlatform.Gateway.csproj
dotnet add src/gateway/BusTicketPlatform.Gateway/BusTicketPlatform.Gateway.csproj `
  reference src/building-blocks/BusTicketPlatform.BuildingBlocks.AspNetCore/BusTicketPlatform.BuildingBlocks.AspNetCore.csproj
dotnet add src/gateway/BusTicketPlatform.Gateway/BusTicketPlatform.Gateway.csproj package Yarp.ReverseProxy
dotnet add src/gateway/BusTicketPlatform.Gateway/BusTicketPlatform.Gateway.csproj package Swashbuckle.AspNetCore.SwaggerUI
```

## 2. File cần tạo

```text
BusTicketPlatform.Gateway/
├─ BusTicketPlatform.Gateway.csproj
├─ Program.cs
├─ appsettings.json
├─ appsettings.Development.json
└─ Properties/launchSettings.json
```

## 3. `Program.cs`

Đăng ký theo thứ tự:

1. `AddBuildingBlocks()`;
2. `AddReverseProxy().LoadFromConfig("ReverseProxy")`;
3. health check `self`;
4. CORS cho Customer Web và Back-office.

Pipeline:

1. `UseCors("clients")`;
2. `UseBuildingBlocks()`;
3. `MapPlatformHealth()`;
4. Swagger UI tập trung;
5. `/openapi.yaml` cho contract tổng;
6. `MapReverseProxy()` luôn ở cuối.

## 4. Route và cluster YARP

Trong `appsettings.json`:

```json
{
  "ReverseProxy": {
    "Routes": {
      "identity-auth": {
        "ClusterId": "identity",
        "Match": { "Path": "/api/v1/auth/{**catch-all}" }
      }
    },
    "Clusters": {
      "identity": {
        "Destinations": {
          "primary": { "Address": "http://localhost:5081" }
        }
      }
    }
  }
}
```

Tạo route cho Identity, Transport, Booking, Payment, Notification và Reporting. Route cụ thể phải có `Order` nhỏ hơn route tổng quát; ví dụ payment webhook hoặc `/trips/{id}/seats` cần ưu tiên trước catch-all.

## 5. CORS

Development cho phép đúng bốn origin:

```text
http://localhost:5173
http://localhost:5174
http://127.0.0.1:5173
http://127.0.0.1:5174
```

Cho phép header `Authorization`, `Content-Type`, `Accept`, `Idempotency-Key`, `X-Correlation-Id`; expose `X-Correlation-Id`.

Không dùng `AllowAnyOrigin` cùng credential ở production.

## 6. OpenAPI và Swagger UI

Mỗi service expose `/openapi/v1.json`. Gateway chỉ tập hợp UI:

```text
Identity     http://localhost:5081/openapi/v1.json
Transport    http://localhost:5082/openapi/v1.json
Booking      http://localhost:5083/openapi/v1.json
Payment      http://localhost:5084/openapi/v1.json
Notification http://localhost:5085/openapi/v1.json
Reporting    http://localhost:5086/openapi/v1.json
```

Contract chuẩn của toàn platform vẫn nằm ở `docs/contracts/openapi/platform-mvp.openapi.yaml`; Gateway expose thêm `/openapi.yaml` để đọc file này.

## Checkpoint 07

```powershell
dotnet build
dotnet test --filter FullyQualifiedName~Gateway
Invoke-RestMethod http://localhost:5080/live
Invoke-WebRequest http://localhost:5080/swagger/index.html
```

Sau đó gọi một route Identity qua `5080`, không gọi thẳng `5081`, để xác nhận proxy hoạt động.
