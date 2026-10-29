# Bus Ticket Platform — Hiểu cấu trúc dự án từ con số 0

> Tài liệu này diễn giải lại `workspace-structure-guide.md` theo hướng **dễ hiểu + có ví dụ + làm theo được**.
> Nguồn sự thật: tài liệu gốc của dự án. Các đoạn code đánh dấu **(minh họa)** chỉ để giải thích ý tưởng; tên class/file thật có thể khác, hãy đối chiếu với code trong repo.

---

## Mục lục

1. [Dự án này làm gì?](#1-dự-án-này-làm-gì)
2. [Ẩn dụ "nhà hàng" để nhớ cả hệ thống](#2-ẩn-dụ-nhà-hàng-để-nhớ-cả-hệ-thống)
3. [Monorepo và sơ đồ thư mục](#3-monorepo-và-sơ-đồ-thư-mục)
4. [Một request đi qua hệ thống như thế nào](#4-một-request-đi-qua-hệ-thống-như-thế-nào)
5. [File cấu hình ở root](#5-file-cấu-hình-ở-root)
6. [`src/apps` — thứ người dùng nhìn thấy](#6-srcapps--thứ-người-dùng-nhìn-thấy)
7. [`src/packages` — thư viện dùng chung cho frontend](#7-srcpackages--thư-viện-dùng-chung-cho-frontend)
8. [`src/gateway` — cửa vào backend](#8-srcgateway--cửa-vào-backend)
9. [`src/services` — các microservice](#9-srcservices--các-microservice)
10. [4 layer trong mỗi service](#10-4-layer-trong-mỗi-service)
11. [`src/building-blocks` — nền tảng kỹ thuật dùng chung](#11-srcbuilding-blocks--nền-tảng-kỹ-thuật-dùng-chung)
12. [`src/infra` — dựng môi trường](#12-srcinfra--dựng-môi-trường)
13. [`src/tests` — các lớp kiểm tra](#13-srctests--các-lớp-kiểm-tra)
14. [`scripts` — tự động hóa](#14-scripts--tự-động-hóa)
15. [Thực hành: thêm tính năng "Hủy vé" từ đầu đến cuối](#15-thực-hành-thêm-tính-năng-hủy-vé-từ-đầu-đến-cuối)
16. [Code mới nên đặt ở đâu?](#16-code-mới-nên-đặt-ở-đâu)
17. [Dependency rule và các lỗi hay gặp](#17-dependency-rule-và-các-lỗi-hay-gặp)
18. [Chạy dự án lần đầu](#18-chạy-dự-án-lần-đầu)
19. [Checklist trước khi tạo Pull Request](#19-checklist-trước-khi-tạo-pull-request)
20. [Bài tập tự kiểm tra](#20-bài-tập-tự-kiểm-tra)
21. [Cheat sheet 1 trang](#21-cheat-sheet-1-trang)
22. [Từ điển thuật ngữ](#22-từ-điển-thuật-ngữ)

---

## 1. Dự án này làm gì?

Một nền tảng **bán vé xe khách** có 3 nhóm người dùng:

| Ai | Làm gì | Ứng dụng |
|---|---|---|
| Hành khách | Đăng ký, tìm chuyến, chọn ghế, đặt vé, thanh toán, xem vé | `customer-web`, `mobile` |
| Nhân viên nhà xe / quản trị | Quản lý xe, tài xế, tuyến, chuyến, booking, báo cáo | `backoffice-web` |
| Hệ thống | Gửi thông báo, đối soát thanh toán, tổng hợp báo cáo | Các service chạy nền |

Vì có nhiều "vùng nghiệp vụ" khác nhau (tài khoản, chuyến xe, đặt vé, thanh toán...), dự án tách mỗi vùng thành **một service riêng** thay vì một cục code khổng lồ.

---

## 2. Ẩn dụ "nhà hàng" để nhớ cả hệ thống

| Thành phần thật | Trong nhà hàng | Ý nghĩa |
|---|---|---|
| Web / Mobile | **Khách ngồi bàn** | Người dùng gọi món, không vào bếp |
| Gateway | **Lễ tân / phục vụ** | Nhận yêu cầu, chuyển đúng quầy. Không nấu ăn |
| Service (Identity, Booking...) | **Các quầy chuyên biệt** (quầy nước, bếp nóng, thu ngân) | Mỗi quầy chỉ làm việc của mình |
| PostgreSQL | **Kho riêng của từng quầy** | Quầy này không tự ý mở kho quầy khác |
| RabbitMQ | **Loa / bảng thông báo nội bộ** | Quầy A thông báo "đơn 12 xong rồi", quầy B nghe được và làm tiếp |
| Domain | **Công thức & luật của nhà hàng** | "Món này không bán sau 22h" |
| Application | **Quy trình phục vụ một đơn** | Nhận đơn → kiểm tra luật → ghi đơn → báo bếp |
| Infrastructure | **Dụng cụ thật: tủ lạnh, bếp, máy POS** | Phần "chạm" vào thế giới bên ngoài |
| Api | **Cửa sổ nhận đơn của quầy** | Nhận yêu cầu và trả kết quả |

Nhớ câu này là đủ để hình dung: **Khách → Lễ tân → Quầy đúng chuyên môn → Kho của quầy đó; quầy nói chuyện với nhau qua loa.**

---

## 3. Monorepo và sơ đồ thư mục

**Monorepo** = toàn bộ backend, frontend, mobile, hạ tầng, test nằm trong **một repository**.

Lợi ích cho người mới: clone một lần là có tất cả; đổi API và sửa client trong cùng một Pull Request.

```text
workspace/
├── BusTicketPlatform.sln        # "Mục lục" của toàn bộ project .NET
├── Directory.Build.props        # Luật build chung
├── Directory.Packages.props     # Version NuGet tập trung
├── global.json                  # Khóa phiên bản .NET SDK
├── package.json                 # npm workspaces + script frontend
├── package-lock.json            # Khóa version npm (đừng sửa tay)
├── redocly.yaml                 # Lint OpenAPI
├── scripts/                     # Script PowerShell/Python cho dev
├── docs/                        # Tài liệu
└── src/
    ├── apps/                    # Ứng dụng người dùng (web, mobile)
    ├── packages/                # Thư viện dùng chung cho frontend
    ├── gateway/                 # Cửa vào backend (YARP)
    ├── services/                # 6 microservice nghiệp vụ
    ├── building-blocks/         # Thư viện kỹ thuật dùng chung cho backend
    ├── infra/                   # Docker, Postgres, RabbitMQ...
    └── tests/                   # Test các loại
```

**Mẹo đọc nhanh:** đi từ "gần người dùng" đến "gần dữ liệu":
`apps → packages → gateway → services → building-blocks → infra`.

---

## 4. Một request đi qua hệ thống như thế nào

Sơ đồ tổng:

```text
Web/Mobile ──► Gateway ──► Service ──► PostgreSQL
                              │
                              └──────► RabbitMQ ──► Service khác
```

**Quy tắc vàng:**
- Frontend **không bao giờ** nói chuyện trực tiếp với database.
- Mọi request từ client đều đi qua **Gateway (port 5080)**.
- Gateway chỉ **chuyển tiếp**, không chứa nghiệp vụ.

### Ví dụ: hành khách bấm "Đặt vé"

```text
1. customer-web gửi        POST http://localhost:5080/api/v1/bookings
2. Gateway đọc URL         thấy /bookings  → chuyển sang Booking service :5083
3. Booking.Api             nhận request, kiểm tra dữ liệu đầu vào
4. Booking.Application     chạy use case "CreateBooking"
5. Booking.Domain          kiểm tra luật: ghế còn trống? chuyến còn mở bán?
6. Booking.Infrastructure  ghi booking vào PostgreSQL + ghi event vào outbox
7. Outbox → RabbitMQ       phát event "BookingCreated"
8. Payment / Notification  nhận event, tạo thanh toán / gửi thông báo
```

Chú ý bước 2: client **chỉ biết** `:5080`. Việc service nằm ở port nào là chuyện nội bộ.

---

## 5. File cấu hình ở root

### Bảng tóm tắt

| File | Làm gì | Sửa khi nào |
|---|---|---|
| `BusTicketPlatform.sln` | Gom mọi project .NET để IDE/CLI build/test cả backend | Thêm/xóa project .NET |
| `Directory.Build.props` | Luật build chung: .NET 10, nullable, analyzer, warnings-as-errors | Đổi luật cho **toàn bộ** project |
| `Directory.Packages.props` | Pin version NuGet (Npgsql, YARP, RabbitMQ, xUnit...) | Thêm / nâng package .NET |
| `global.json` | Chọn .NET SDK | Cả nhóm thống nhất nâng SDK |
| `package.json` | Khai báo npm workspaces + script | Thêm app/package JS hoặc script npm |
| `package-lock.json` | Khóa chính xác dependency JS | **Không sửa tay** — `npm install` tự cập nhật |
| `redocly.yaml` | Cấu hình lint/bundle OpenAPI | Đổi quy tắc API contract |

### Hiểu `Directory.Build.props`

File này được .NET **tự động áp dụng cho mọi `.csproj` nằm bên dưới nó**. Nên một service mới **không cần** khai báo lại `TargetFramework`, nullable, analyzer.

Hệ quả thực tế: nếu bạn viết code gây cảnh báo (ví dụ quên xử lý null), build có thể **fail** vì `warnings-as-errors`. Đó là chủ đích — giữ chất lượng code từ sớm.

### Hiểu `Directory.Packages.props` (Central Package Management)

Version chỉ nằm **một nơi**. Trong `.csproj` chỉ ghi tên package:

```xml
<!-- trong .csproj (không có Version) -->
<PackageReference Include="Npgsql" />
```

```xml
<!-- trong Directory.Packages.props (version thật) -->
<PackageVersion Include="Npgsql" Version="x.y.z" />
```

### Thực hành: thêm một NuGet package mới **(minh họa)**

Giả sử cần thêm thư viện `Foo.Bar` cho `Booking.Infrastructure`:

1. Mở `Directory.Packages.props`, thêm dòng:
   ```xml
   <PackageVersion Include="Foo.Bar" Version="1.2.3" />
   ```
2. Mở `BusTicketPlatform.Booking.Infrastructure.csproj`, thêm:
   ```xml
   <PackageReference Include="Foo.Bar" />
   ```
3. Chạy `dotnet restore` rồi `dotnet build BusTicketPlatform.sln`.

> Sai thường gặp: ghi `Version="..."` ngay trong `.csproj` → build báo lỗi vì đang dùng Central Package Management.

---

## 6. `src/apps` — thứ người dùng nhìn thấy

```text
apps/
├── customer-web/       # Web cho hành khách (React + TypeScript + Vite)
├── backoffice-web/     # Web cho nhà xe/quản trị (React)
└── mobile/             # App di động (React Native)
```

| App | Dành cho | Lệnh chạy | Địa chỉ |
|---|---|---|---|
| `customer-web` | Hành khách | `npm run dev:customer` | http://localhost:5173 |
| `backoffice-web` | Nhân viên / admin | `npm run dev:backoffice` | http://localhost:5174 |
| `mobile` | Hành khách (di động) | Theo vòng đời build Android/iOS riêng | — |

Chạy lần đầu:

```powershell
cd workspace
npm install            # cài dependency cho cả workspace
npm run dev:customer   # hoặc dev:backoffice
```

### 4 quy tắc của `apps`

1. **Gọi backend qua Gateway `:5080`**, không gọi thẳng `:5081…:5086`.
2. **Không đặt business rule quan trọng chỉ ở frontend.** Frontend có thể kiểm tra để UX tốt hơn, nhưng backend **phải kiểm tra lại** (người dùng có thể bỏ qua giao diện và gọi API trực tiếp).
3. Code dùng chung giữa nhiều app → đưa vào `src/packages`.
4. Không tự gõ tay type của API nếu có thể lấy từ `api-client`.

### Ví dụ quy tắc 2

> Luật: "Không đặt quá 5 ghế một lần".
> - Frontend: disable nút khi chọn ghế thứ 6 → **để người dùng thấy ngay**.
> - Backend (`Booking.Domain`): từ chối nếu > 5 ghế → **để luật thật sự có hiệu lực**.
>
> Chỉ làm ở frontend = ai gọi API bằng Postman cũng vượt được luật.

---

## 7. `src/packages` — thư viện dùng chung cho frontend

```text
packages/
├── api-client/    # Client + type để gọi Gateway
└── ui/            # Design token: màu, spacing, theme
```

**Phân biệt:** `apps` = chương trình **chạy được**; `packages` = thư viện **được app import**, không tự chạy.

### `api-client`

Mục tiêu: Customer Web, Back-office và Mobile gọi API **cùng một cách**, dùng **cùng type** và xử lý lỗi **giống nhau**.

Ví dụ lợi ích: backend đổi tên field `seatNo` → `seatNumber`. Bạn sửa **một chỗ** trong `api-client`; cả 3 app nhận type mới và TypeScript báo ngay chỗ nào cần sửa.

### `ui`

Chứa **token** (màu chủ đạo, khoảng cách, theme). Chỉ đưa component/style vào đây khi **nhiều app thật sự dùng**. Một nút chỉ dùng ở `customer-web` thì để lại trong `customer-web`.

### Quy trình khi API thay đổi

```text
Backend đổi contract (OpenAPI)
   → cập nhật contract + test contracts
   → cập nhật src/packages/api-client
   → sửa chỗ gọi trong từng app nếu TypeScript báo lỗi
```

---

## 8. `src/gateway` — cửa vào backend

```text
gateway/
└── BusTicketPlatform.Gateway/
    ├── Program.cs
    ├── appsettings.json                  # ROUTE + địa chỉ service nằm ở đây
    └── Properties/launchSettings.json
```

Gateway dùng **YARP Reverse Proxy**: nhìn URL → chọn service → chuyển request → trả response.

### Bảng route

| Request | Service đích | Port |
|---|---|---:|
| `POST /api/v1/auth/login` | Identity | 5081 |
| `GET /api/v1/trips` | Transport | 5082 |
| `POST /api/v1/bookings` | Booking | 5083 |
| `POST /api/v1/.../payments` | Payment | 5084 |
| `GET /api/v1/notifications` | Notification | 5085 |
| `GET /api/v1/reports/revenue` | Reporting | 5086 |

### Vì sao thứ tự route quan trọng?

Route **cụ thể** phải được ưu tiên **trước** route **tổng quát**. Ví dụ **(minh họa)**:

- `/api/v1/bookings/{id}/payments` → thuộc **Payment** (cụ thể)
- `/api/v1/bookings/{id}` → thuộc **Booking** (tổng quát hơn)

Nếu route tổng quát thắng, request thanh toán sẽ bị gửi nhầm sang Booking và trả 404. Khi thêm route mới, luôn tự hỏi: *"có route nào tổng quát hơn có thể nuốt mất route của mình không?"*

### Swagger tập trung

```text
http://localhost:5080/swagger
```

- Swagger Gateway đọc OpenAPI từ mỗi service tại `/openapi/v1.json`.
- Gateway **tự khởi động được** (không dùng DB), nhưng Swagger chỉ **hiển thị đầy đủ** khi **6 service phía sau đang chạy**.

### Không được làm trong Gateway

- ❌ Business rule
- ❌ Repository / SQL
- ✅ Chỉ: routing, và những thứ mang tính "cửa vào" như error response thống nhất

---

## 9. `src/services` — các microservice

Mỗi service **sở hữu** một vùng nghiệp vụ **và dữ liệu riêng** của nó.

| Service | Port | Làm gì | Ví dụ tính năng |
|---|---:|---|---|
| `identity` | 5081 | Đăng ký, đăng nhập, token, hồ sơ, role, thành viên tổ chức | Đăng nhập, phân quyền nhân viên |
| `transport` | 5082 | Nhà xe, xe, ghế, tài xế, tuyến, điểm dừng, chuyến | Tạo chuyến Đà Nẵng → Huế |
| `booking` | 5083 | Giữ ghế, booking, vé, hủy vé, manifest, check-in | Đặt vé, hủy vé |
| `payment` | 5084 | Thanh toán, webhook, hoàn tiền, đối soát, payout | Thanh toán, hoàn tiền |
| `notification` | 5085 | Tạo/lưu thông báo, trạng thái đã đọc | "Đặt vé thành công" |
| `reporting` | 5086 | Báo cáo doanh thu, booking, tỷ lệ lấp đầy | Doanh thu theo tuần |

### Cách chọn service khi nhận một yêu cầu

Hỏi: **"Dữ liệu và luật chính của việc này thuộc về ai?"**

- "Cho phép tài xế đổi số điện thoại" → dữ liệu hồ sơ → **identity** (hoặc transport nếu tài xế thuộc quản lý của nhà xe — hãy hỏi team để chốt ownership).
- "Giữ ghế 10 phút" → **booking**.
- "Hoàn tiền khi hủy" → **payment** (booking chỉ phát event hủy).
- "Biểu đồ doanh thu" → **reporting**.

### Quy tắc cứng: service không "chui" vào code nhau

```text
❌ Booking.Application  ──project reference──►  Payment.Domain
✅ Booking  ──HTTP contract──►  Payment
✅ Booking  ──integration event (RabbitMQ)──►  Payment
```

Lý do: nếu được tham chiếu trực tiếp, các service sẽ dính chặt vào nhau và mất ý nghĩa của việc tách riêng (không thể sửa/deploy độc lập).

---

## 10. 4 layer trong mỗi service

```text
services/<service>/
├── BusTicketPlatform.<Service>.Api/             # Cửa HTTP
├── BusTicketPlatform.<Service>.Application/     # Use case
├── BusTicketPlatform.<Service>.Domain/          # Luật nghiệp vụ
└── BusTicketPlatform.<Service>.Infrastructure/  # DB, broker, dịch vụ ngoài
```

### Quan hệ phụ thuộc (ai được dùng ai)

```text
Api ───────────────┐
                   ├──► Application ──► Domain
Infrastructure ────┘

(Api tham chiếu Infrastructure chỉ để đăng ký implementation lúc khởi động)
(Domain KHÔNG tham chiếu ngược ra ngoài)
```

Đọc sơ đồ: mũi tên chỉ về **Domain** — Domain là "lõi", không biết gì về thế giới bên ngoài.

### Bảng so sánh 4 layer

| Layer | Trả lời câu hỏi | Biết HTTP? | Biết SQL? | Ví dụ nội dung |
|---|---|:-:|:-:|---|
| **Domain** | "Luật là gì?" | ❌ | ❌ | `Booking`, trạng thái, rule hủy |
| **Application** | "Việc cần làm theo thứ tự nào?" | ❌ | ❌ | `CancelBookingHandler`, interface repository |
| **Infrastructure** | "Làm thật bằng công cụ nào?" | ❌ | ✅ | Repository Npgsql, outbox, RabbitMQ, JWT |
| **Api** | "Nhận/trả qua HTTP thế nào?" | ✅ | ❌ | Endpoint, mapping, auth, OpenAPI, health |

### Ví dụ xuyên 4 layer: "Hủy booking" **(minh họa)**

**Domain** — chỉ luật, không công nghệ:

```csharp
public sealed class Booking
{
    public BookingStatus Status { get; private set; }

    public Result Cancel(DateTimeOffset now)
    {
        if (Status is BookingStatus.Cancelled)
            return Result.Failure(BookingErrors.AlreadyCancelled);

        if (Status is BookingStatus.CheckedIn)
            return Result.Failure(BookingErrors.CannotCancelAfterCheckIn);

        Status = BookingStatus.Cancelled;
        return Result.Success();
    }
}
```

**Application** — điều phối, chỉ biết **interface**:

```csharp
public interface IBookingRepository
{
    Task<Booking?> GetAsync(Guid id, CancellationToken ct);
    Task SaveAsync(Booking booking, CancellationToken ct);
}

public sealed class CancelBookingHandler(IBookingRepository repo, IClock clock)
{
    public async Task<Result> HandleAsync(Guid bookingId, CancellationToken ct)
    {
        var booking = await repo.GetAsync(bookingId, ct);
        if (booking is null)
            return Result.Failure(BookingErrors.NotFound);

        var result = booking.Cancel(clock.UtcNow);   // luật nằm ở Domain
        if (result.IsFailure) return result;

        await repo.SaveAsync(booking, ct);
        return Result.Success();
    }
}
```

**Infrastructure** — hiện thực interface bằng PostgreSQL:

```csharp
public sealed class NpgsqlBookingRepository : IBookingRepository
{
    // dùng Npgsql: SELECT/UPDATE bảng bookings,
    // ghi event "BookingCancelled" vào outbox trong cùng transaction
}
```

**Api** — nhận HTTP, gọi Application, đổi kết quả thành HTTP response:

```csharp
app.MapPost("/api/v1/bookings/{id}/cancel", async (
    Guid id, CancelBookingHandler handler, CancellationToken ct) =>
{
    var result = await handler.HandleAsync(id, ct);
    return result.IsSuccess ? Results.NoContent() : result.ToHttpProblem();
});
```

Nhận xét: nếu sau này đổi PostgreSQL sang DB khác, **chỉ Infrastructure** phải sửa. Nếu luật hủy đổi, **chỉ Domain** (và test của nó) phải sửa.

### Endpoint kỹ thuật mà mỗi service đều có

| Endpoint | Ý nghĩa |
|---|---|
| `/live` | Process còn sống không? |
| `/ready` | Dependency (DB, broker) sẵn sàng chưa? |
| `/startup` | Khởi động xong chưa? |
| `/openapi/v1.json` | Tài liệu OpenAPI của service |

Mẹo debug: service "chạy mà không hoạt động" → mở `/ready` để xem thiếu PostgreSQL hay RabbitMQ.

### Lưu ý migration

Các service **chạy migration lúc startup**. Docker không bắt buộc, nhưng **PostgreSQL phải tồn tại ở `5432`**. Luồng messaging cần **RabbitMQ ở `5672`**.

---

## 11. `src/building-blocks` — nền tảng kỹ thuật dùng chung

```text
building-blocks/
├── BusTicketPlatform.BuildingBlocks/             # Lõi, không phụ thuộc web
├── BusTicketPlatform.BuildingBlocks.AspNetCore/  # Tiện ích HTTP
└── BusTicketPlatform.BuildingBlocks.Messaging/   # Hạ tầng messaging
```

Building block là **thư viện kỹ thuật nhỏ**, không phải service, không chạy độc lập.

### `BuildingBlocks` (lõi)

| Thành phần | Giải thích dễ hiểu |
|---|---|
| `Result` + kiểu lỗi chuẩn | Thay vì ném exception cho lỗi nghiệp vụ, trả về "thành công/thất bại + mã lỗi" |
| UUIDv7 generator | Tạo ID có thứ tự theo thời gian → thân thiện với index DB |
| Clock abstraction | Lấy "giờ hiện tại" qua interface → test có thể giả giờ |
| Idempotency interface | Gửi cùng một request 2 lần không tạo 2 booking |
| Correlation, telemetry, log redaction | Gắn mã theo dõi request; che dữ liệu nhạy cảm trong log |

**Vì sao cần Clock?** Test "hủy trước giờ chạy 2 tiếng" cần giả lập thời gian. Nếu code gọi thẳng `DateTime.UtcNow`, rất khó test.

**Idempotency ví dụ:** người dùng bấm "Thanh toán" hai lần do mạng chậm → client gửi cùng một idempotency key → server nhận ra và trả lại kết quả cũ, **không trừ tiền hai lần**.

### `BuildingBlocks.AspNetCore`

Correlation middleware, error envelope thống nhất (mọi service trả lỗi cùng một hình dạng), health endpoints, JWT helper, OpenAPI + Swagger CORS.

### `BuildingBlocks.Messaging`

Event envelope, RabbitMQ publisher/consumer, **outbox relay**, **inbox deduplication**.

#### Outbox và Inbox giải thích đơn giản

**Vấn đề:** Booking vừa lưu DB xong thì RabbitMQ lỗi → event không được gửi → Payment không biết có booking mới.

**Outbox (bên gửi):**

```text
Trong CÙNG MỘT transaction:
  1. Ghi booking vào bảng bookings
  2. Ghi event vào bảng outbox
Một tiến trình nền (relay) đọc outbox → đẩy lên RabbitMQ → đánh dấu đã gửi
```

→ Nếu RabbitMQ chết, event vẫn nằm an toàn trong outbox và sẽ được gửi lại sau.

**Inbox (bên nhận):** RabbitMQ có thể giao một event **nhiều lần**. Bên nhận ghi lại ID event đã xử lý; thấy ID trùng thì **bỏ qua**. → Không thông báo/hoàn tiền hai lần.

### Khi nào được đưa code vào building-blocks?

Chỉ khi **cả hai** đúng:
1. Thật sự dùng chung bởi nhiều service.
2. **Không chứa kiến thức nghiệp vụ** riêng của Identity/Booking/...

```text
✅ Middleware đo thời gian request          → BuildingBlocks.AspNetCore
✅ Helper tạo UUIDv7                         → BuildingBlocks
❌ Enum BookingStatus "để Payment dùng cho tiện"  → sai! Dùng contract/event
❌ DTO riêng của Booking                     → giữ trong Booking
```

---

## 12. `src/infra` — dựng môi trường

```text
infra/
├── docker-compose.yml        # Dependency: PostgreSQL, RabbitMQ, Redis, Mailpit, payment simulator
├── docker-compose.apps.yml   # Ứng dụng: Gateway, 6 API, 2 web app
├── docker/                   # Dockerfile + Nginx config dùng chung
├── postgres/                 # Tạo database riêng cho từng service
├── rabbitmq/                 # Exchange, queue, tài khoản
└── payment-simulator/        # Giả lập nhà cung cấp thanh toán (chỉ để dev local)
```

`infra` **không chứa business logic**.

### Phân biệt quan trọng

- Docker chỉ là cách **tiện** để khởi động dependency.
- **PostgreSQL / RabbitMQ mới là dependency thật** của backend.
- Bạn có thể không dùng Docker nếu tự cài và cấu hình các dịch vụ tương đương.

### Công cụ phụ trong `docker-compose.yml`

| Công cụ | Dùng để |
|---|---|
| PostgreSQL | Lưu dữ liệu (mỗi service một database riêng) |
| RabbitMQ | Truyền event giữa service |
| Redis | Cache / dữ liệu tạm |
| Mailpit | Hộp thư giả: xem email dev gửi ra mà không gửi thật |
| payment-simulator | Giả lập cổng thanh toán, không cần tài khoản thật |

---

## 13. `src/tests` — các lớp kiểm tra

```text
tests/
├── architecture/      # Kiểm tra dependency rule giữa layer
├── building-blocks/   # Unit test code dùng chung
├── contracts/         # Kiểm tra OpenAPI, JSON Schema, SQL baseline
├── gateway/           # Integration test routing + error response
├── messaging/         # Integration test PostgreSQL + RabbitMQ
├── identity/ transport/ booking/ payment/ notification/ reporting/
                       # Integration test API + persistence từng service
```

| Loại test | Cần dịch vụ ngoài? | Chạy khi nào |
|---|---|---|
| Unit test (Domain, building-blocks) | Không | Liên tục khi code |
| Integration test | Có — dùng **Testcontainers** (cần **Docker**) | Trước khi push |
| Architecture test | Không | Mỗi lần build CI |
| Contract test | Không | Khi đổi API/event/SQL |

```powershell
cd workspace
dotnet test BusTicketPlatform.sln
```

### Architecture test hoạt động ra sao?

Nó **tự động bắt** các lỗi như "Domain tham chiếu Npgsql" hay "Booking tham chiếu Payment". Nếu bạn vô tình vi phạm dependency rule, test sẽ đỏ — bạn không cần nhớ hết luật.

---

## 14. `scripts` — tự động hóa

| Script | Dùng khi |
|---|---|
| `dev-host.ps1` | Dựng dependency bằng Docker + seed dữ liệu + chạy backend bằng `dotnet` (tiện khi debug code) |
| `dev-docker.ps1` | Build/chạy **toàn bộ** stack bằng Docker Compose (đơn giản nhất) |
| `dev-env.ps1` | Set biến môi trường local: connection string, RabbitMQ, SMTP, JWT |
| `apply-dev-seed.ps1` | Nạp tài khoản/chuyến mẫu |
| `verify-s0.ps1` | Kiểm tra nền tảng Slice 0 |
| `verify-contracts.ps1` | Kiểm tra OpenAPI/AsyncAPI/schema |
| `gen_service_skeleton.py` | Sinh skeleton service mới theo cấu trúc chuẩn (4 layer) |
| `hash-password.cs` | Tạo password hash cho seed data |

Khi cần tạo **service mới**: dùng `gen_service_skeleton.py` thay vì copy-paste tay, để cấu trúc luôn chuẩn.

---

## 15. Thực hành: thêm tính năng "Hủy vé" từ đầu đến cuối

> Mục tiêu: học cách một tính năng "xuyên" qua nhiều phần của monorepo. Đây là **ví dụ minh họa** — hãy đối chiếu tên file thật trong repo.

**Yêu cầu giả định:** Hành khách hủy vé trước giờ khởi hành; hệ thống hoàn tiền và gửi thông báo.

### Bước 0 — Xác định ai sở hữu việc gì

| Việc | Sở hữu |
|---|---|
| Luật "được hủy khi nào" | `booking` |
| Hoàn tiền | `payment` |
| Gửi thông báo | `notification` |
| Nút hủy trên giao diện | `customer-web` |

### Bước 1 — Domain (Booking)

Thêm/sửa luật `Cancel` trong entity `Booking` (xem ví dụ ở mục 10).
👉 Viết **unit test** cho các trường hợp: đã hủy, đã check-in, trước/sau hạn hủy.

### Bước 2 — Application (Booking)

Tạo use case `CancelBooking`: tải booking → gọi `Cancel` → lưu → phát event `BookingCancelled`.
Khai báo interface repository/publisher nếu chưa có.

### Bước 3 — Infrastructure (Booking)

Hiện thực lưu booking đã hủy; ghi event `BookingCancelled` vào **outbox** trong cùng transaction. Nếu cần cột mới → thêm SQL migration.

### Bước 4 — Api (Booking)

Thêm endpoint `POST /api/v1/bookings/{id}/cancel`, kiểm tra quyền (chỉ chủ vé hoặc nhân viên), gọi use case, map lỗi → HTTP status.

### Bước 5 — Contract

Cập nhật OpenAPI (endpoint mới) và schema của event `BookingCancelled`. Chạy:

```powershell
./scripts/verify-contracts.ps1
```

### Bước 6 — Payment (consumer)

Tạo consumer nghe `BookingCancelled` → use case `RefundPayment`. Dùng **inbox** để không hoàn tiền hai lần.

### Bước 7 — Notification (consumer)

Nghe `BookingCancelled` (hoặc `RefundCompleted`) → tạo thông báo "Vé của bạn đã được hủy".

### Bước 8 — Gateway

Kiểm tra route `/api/v1/bookings/**` đã trỏ đúng Booking (thường đã có sẵn). Nếu thêm route mới → nhớ thứ tự **cụ thể trước, tổng quát sau**.

### Bước 9 — Frontend

1. Cập nhật `src/packages/api-client` (hàm `cancelBooking` + type).
2. Thêm nút "Hủy vé" ở `customer-web`.
3. Chạy `npm run dev:customer` và thử qua Gateway.

### Bước 10 — Test & PR

```powershell
dotnet build BusTicketPlatform.sln
dotnet test  BusTicketPlatform.sln
```

Rồi đi qua [checklist PR](#19-checklist-trước-khi-tạo-pull-request).

### Tóm tắt "dấu chân" của tính năng

```text
customer-web ─► api-client ─► Gateway ─► Booking.Api ─► Booking.Application
                                                          ├─► Booking.Domain
                                                          └─► Booking.Infrastructure ─► PostgreSQL
                                                                                     └─► Outbox ─► RabbitMQ
                                                                                          ├─► Payment (hoàn tiền)
                                                                                          └─► Notification (thông báo)
```

---

## 16. Code mới nên đặt ở đâu?

### Bảng tra nhanh

| Thay đổi | Đặt ở |
|---|---|
| Màn hình đặt vé | `src/apps/customer-web` |
| Màn hình quản trị | `src/apps/backoffice-web` |
| Luật hủy booking | `Booking.Domain` |
| Use case hoàn vé | `Application` của service sở hữu nghiệp vụ |
| SQL / repository | `Infrastructure` của service sở hữu dữ liệu |
| HTTP endpoint | `Api` của service sở hữu nghiệp vụ |
| Integration event | Publisher/consumer của các service liên quan |
| Middleware HTTP dùng chung | `BuildingBlocks.AspNetCore` |
| Helper chỉ dùng trong một service | Giữ trong service đó |
| Docker / config dependency | `src/infra` |
| Integration test Identity | `src/tests/identity` |

### Cây quyết định

```text
Code này có chạm vào giao diện người dùng?
├─ Có → src/apps/<app> (dùng chung nhiều app? → src/packages)
└─ Không
    Là luật nghiệp vụ thuần ("được/không được")?
    ├─ Có → Domain của service sở hữu
    └─ Không
        Là việc điều phối các bước?
        ├─ Có → Application
        └─ Không
            Chạm DB / RabbitMQ / dịch vụ ngoài?
            ├─ Có → Infrastructure
            └─ Không
                Là nhận/trả HTTP?
                ├─ Có → Api
                └─ Không
                    Kỹ thuật dùng chung, KHÔNG có nghiệp vụ?
                    ├─ Có → building-blocks
                    └─ Không → hỏi team / giữ trong service
```

---

## 17. Dependency rule và các lỗi hay gặp

### Luật bắt buộc

1. **Domain** không tham chiếu Application, Infrastructure, Api, ASP.NET Core, Npgsql, RabbitMQ.
2. **Application** được tham chiếu Domain + building-block lõi; **không** phụ thuộc Api.
3. **Infrastructure** hiện thực adapter cho Application; được dùng DB/broker.
4. **Api** là *composition root* — nối Application, Infrastructure và ASP.NET Core.
5. Service **không** project-reference code nghiệp vụ của service khác.
6. Frontend chỉ giao tiếp qua **HTTP contract**, không truy cập DB.
7. Không đưa DTO/rule riêng của một service vào building-blocks cho tiện.
8. Version NuGet **chỉ** pin ở `Directory.Packages.props`.

Các luật quan trọng được bảo vệ bằng test trong `src/tests/architecture`.

### Lỗi hay gặp của người mới

| ❌ Lỗi | Vì sao sai | ✅ Cách đúng |
|---|---|---|
| Viết SQL trong endpoint (`Api`) | Api không nên biết DB | SQL vào repository ở Infrastructure |
| `Domain` dùng `NpgsqlConnection` | Domain phải thuần | Khai báo interface ở Application, hiện thực ở Infrastructure |
| Booking gọi thẳng class của Payment | Dính chặt 2 service | Dùng HTTP contract hoặc event |
| Kiểm tra luật chỉ ở frontend | Có thể bị bỏ qua | Luật thật ở Domain, frontend chỉ để UX |
| Frontend gọi `localhost:5083` | Bỏ qua Gateway | Luôn gọi `localhost:5080` |
| Thêm `Version=` trong `.csproj` | Dùng Central Package Management | Đặt version trong `Directory.Packages.props` |
| Sửa tay `package-lock.json` | File sinh tự động | Dùng `npm install` |
| Bỏ business logic vào Gateway | Gateway chỉ định tuyến | Đưa vào service |
| Bỏ DTO riêng của Booking vào building-blocks | Rò rỉ nghiệp vụ | Giữ trong Booking |
| Quên cập nhật contract khi đổi API | Frontend/consumer vỡ | Cập nhật OpenAPI/schema + chạy verify |

---

## 18. Chạy dự án lần đầu

### Bảng port cần nhớ

| Thành phần | Port |
|---|---:|
| Customer Web | 5173 |
| Back-office Web | 5174 |
| Gateway | 5080 |
| Identity / Transport / Booking | 5081 / 5082 / 5083 |
| Payment / Notification / Reporting | 5084 / 5085 / 5086 |
| PostgreSQL | 5432 |
| RabbitMQ | 5672 |

### Cách 1 — Full stack bằng Docker (đơn giản nhất)

Yêu cầu: máy có Docker.

```powershell
cd workspace
./scripts/dev-docker.ps1
```

Sau đó mở:
- http://localhost:5173 — Customer Web
- http://localhost:5174 — Back-office
- http://localhost:5080/swagger — Swagger tập trung

### Cách 2 — Dependency bằng Docker, backend bằng `dotnet` (tiện khi debug)

```powershell
cd workspace
./scripts/dev-host.ps1
npm install
npm run dev:customer
```

### Cách 3 — Chạy riêng từng phần

```powershell
# Restore + build backend
dotnet restore
dotnet build BusTicketPlatform.sln

# Gateway riêng (không cần DB)
dotnet run --project src/gateway/BusTicketPlatform.Gateway

# Một service riêng (ví dụ Identity) — cần PostgreSQL local
. ./scripts/dev-env.ps1
Set-PlatformEnv
dotnet run --project src/services/identity/BusTicketPlatform.Identity.Api
```

### Gặp sự cố? Kiểm tra theo thứ tự

| Triệu chứng | Nguyên nhân thường gặp | Cách kiểm tra |
|---|---|---|
| Service không lên / lỗi kết nối DB | PostgreSQL chưa chạy ở `5432` | Kiểm tra container/dịch vụ Postgres |
| Event không được xử lý | RabbitMQ chưa chạy ở `5672` | Kiểm tra RabbitMQ |
| Swagger Gateway thiếu service | Có service chưa chạy | Mở `/ready` và `/openapi/v1.json` của từng service |
| Integration test fail ngay | Chưa bật Docker (Testcontainers) | Khởi động Docker rồi chạy lại |
| Service báo thiếu connection string / JWT | Chưa nạp biến môi trường | Chạy `. ./scripts/dev-env.ps1` rồi `Set-PlatformEnv` |
| Đăng nhập thử không có tài khoản | Chưa seed | Chạy `./scripts/apply-dev-seed.ps1` |

---

## 19. Checklist trước khi tạo Pull Request

- [ ] Code nằm đúng app / service / layer.
- [ ] Không có project reference từ service này sang service khác.
- [ ] Không commit secret, `.env`, `bin`, `obj`, `node_modules`, cấu hình IDE cá nhân.
- [ ] Nếu đổi API/event: đã cập nhật contract + test tương ứng.
- [ ] `dotnet build BusTicketPlatform.sln` thành công.
- [ ] Unit test + integration test liên quan đã chạy.
- [ ] Nếu sửa frontend: đã build frontend và thử luồng qua Gateway.

---

## 20. Bài tập tự kiểm tra

**Câu hỏi** (đáp án ngay bên dưới — thử tự trả lời trước):

1. Muốn thêm luật "một booking tối đa 5 ghế". Đặt ở đâu?
2. Cần thêm cột `cancel_reason` vào bảng booking. Đụng layer nào?
3. Muốn thêm middleware ghi thời gian xử lý mọi request ở tất cả service. Đặt ở đâu?
4. `customer-web` có thể gọi `http://localhost:5084/...` trực tiếp không?
5. Service Notification cần biết trạng thái booking. Có được `ProjectReference` sang `Booking.Domain` không?
6. Gateway chạy được khi chưa có PostgreSQL không? Swagger có đầy đủ không?
7. Thêm package NuGet mới, version ghi ở đâu?
8. Thêm màu thương hiệu dùng cho cả web lẫn mobile. Đặt ở đâu?
9. Event `BookingCancelled` bị giao 2 lần, làm sao tránh hoàn tiền 2 lần?
10. Đổi hình dạng response `GET /api/v1/trips`. Cần cập nhật những gì?

**Đáp án**

1. `Booking.Domain` (luật nghiệp vụ). Frontend có thể kiểm tra thêm để UX, nhưng không thay thế.
2. Infrastructure (SQL migration + repository), có thể Domain/Application nếu entity/use case dùng field mới, Api nếu lộ ra response, kèm contract.
3. `BuildingBlocks.AspNetCore` (middleware HTTP dùng chung, không có nghiệp vụ).
4. **Không.** Client chỉ gọi Gateway `:5080`.
5. **Không.** Dùng HTTP contract hoặc nghe integration event qua RabbitMQ.
6. Gateway **chạy được** vì không dùng DB; nhưng Swagger **chỉ đầy đủ** khi 6 service phía sau chạy.
7. `Directory.Packages.props` (version) + `.csproj` (chỉ tên package).
8. `src/packages/ui` (design token dùng chung nhiều app).
9. **Inbox deduplication** (ghi ID event đã xử lý, bỏ qua nếu trùng) và/hoặc idempotency ở use case hoàn tiền.
10. Contract OpenAPI + contract test; `src/packages/api-client`; các app dùng type đó; test của Transport/Gateway nếu liên quan.

---

## 21. Cheat sheet 1 trang

```text
KHÁCH ─► GATEWAY(:5080) ─► SERVICE(:5081-5086) ─► POSTGRES(:5432)
                                  └─► RABBITMQ(:5672) ─► SERVICE khác
```

| Thư mục | Nhớ bằng 1 câu |
|---|---|
| `apps` | Thứ người dùng nhìn thấy |
| `packages` | Thư viện dùng chung cho frontend |
| `gateway` | Cửa vào + bộ định tuyến, không nghiệp vụ |
| `services` | Nghiệp vụ chia theo vùng, mỗi vùng có DB riêng |
| `Domain` | Luật |
| `Application` | Điều phối use case |
| `Infrastructure` | DB, broker, dịch vụ ngoài |
| `Api` | HTTP endpoint + ghép dependency |
| `building-blocks` | Kỹ thuật dùng chung, **không** nghiệp vụ |
| `infra` | Cách dựng môi trường |
| `tests` | Bảo vệ hành vi, contract, kiến trúc |
| `scripts` | Tự động hóa việc của dev |

**5 câu thần chú:**
1. Client → Gateway, không bao giờ vào DB.
2. Mỗi service một vùng nghiệp vụ, một DB.
3. Service nói chuyện bằng HTTP contract hoặc event, không `ProjectReference`.
4. Luật ở Domain; điều phối ở Application; công nghệ ở Infrastructure; HTTP ở Api.
5. Đổi API/event → cập nhật contract + test.

---

## 22. Từ điển thuật ngữ

| Thuật ngữ | Nghĩa dễ hiểu |
|---|---|
| **Monorepo** | Nhiều phần của hệ thống cùng nằm trong một repository |
| **Microservice** | Dịch vụ nhỏ, độc lập, sở hữu một vùng nghiệp vụ |
| **Gateway** | Cửa vào duy nhất cho client |
| **YARP** | Thư viện reverse proxy của .NET, dùng trong Gateway |
| **Reverse proxy** | Nhận request thay cho server thật rồi chuyển tiếp |
| **Domain** | Luật và khái niệm nghiệp vụ cốt lõi |
| **Use case** | Một việc người dùng muốn làm (đặt vé, hủy vé...) |
| **Composition root** | Nơi ghép các thành phần lại lúc khởi động (`Api/Program.cs`) |
| **DTO** | Đối tượng chỉ để truyền dữ liệu qua ranh giới (HTTP, event) |
| **OpenAPI / Swagger** | Tài liệu mô tả API; Swagger UI để xem/thử API |
| **Contract** | Thỏa thuận hình dạng API/event giữa các bên |
| **Integration event** | Thông báo "đã có chuyện xảy ra" giữa các service |
| **RabbitMQ** | Message broker để truyền event |
| **Outbox** | Bảng lưu event cần gửi, ghi cùng transaction với dữ liệu |
| **Inbox** | Bảng nhớ event đã xử lý để chống xử lý trùng |
| **Idempotency** | Làm nhiều lần vẫn cho cùng kết quả như làm một lần |
| **Central Package Management** | Quản lý version NuGet ở một file duy nhất |
| **Testcontainers** | Thư viện dựng container tạm (Postgres/RabbitMQ) cho test |
| **Seed** | Dữ liệu mẫu nạp sẵn cho môi trường dev |
| **Health check** | Endpoint cho biết service còn sống/sẵn sàng không |
| **Slice 0** | Giai đoạn nền tảng đầu tiên của dự án (theo tên script `verify-s0.ps1`) |