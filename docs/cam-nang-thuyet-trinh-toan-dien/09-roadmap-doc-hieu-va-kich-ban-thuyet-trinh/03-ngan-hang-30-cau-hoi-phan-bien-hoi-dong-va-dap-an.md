# Ngân Hàng 30 Câu Hỏi Phản Biện Hội Đồng & Đáp Án Chuẩn Xác Theo Mã Nguồn

> **Hướng dẫn sử dụng**: Khi hội đồng đặt câu hỏi, giảng viên không chỉ kiểm tra xem hệ thống có chạy được không, mà kiểm tra **bạn có thực sự hiểu dòng code của mình hay không**. Mỗi câu hỏi dưới đây đều gồm 3 phần:
> 1. **Ý đồ của hội đồng / Cái bẫy cần tránh**: Thầy/Cô đang gài điểm gì?
> 2. **Câu trả lời mẫu súc tích, ăn điểm trực diện**: Nói rõ ràng trong 30–45 giây.
> 3. **Bằng chứng trong Source Code**: Tên file, hàm, bảng SQL để mở ngay trên IDE nếu thầy/cô nói *"Đâu, mở code đoạn đó ra xem!"*

---

## NHÓM A — KIẾN TRÚC MICROSERVICES, CLEAN ARCHITECTURE & .NET 10 (Câu 1 $\rightarrow$ 5)

### Câu 1: Tại sao một đồ án nhóm 4 sinh viên lại chọn kiến trúc 6 Microservices thay vì làm Monolith cho đơn giản? Liệu có đang "over-engineering" không?
- **Ý đồ hội đồng**: Thử xem nhóm đua đòi công nghệ theo trào lưu hay hiểu rõ đánh đổi (trade-offs) của Microservices.
- **Đáp án chuẩn**:
  > *"Thưa thầy/cô, nhóm hoàn toàn nhận thức được chi phí vận hành của Microservices, nên đã áp dụng chiến lược **Pragmatic Microservices (Microservices thực dụng)** qua các quyết định ADR-001, ADR-005 và ADR-016:*
  > *1. **Về mặt tách miền**: 6 dịch vụ (`Identity`, `Transport`, `Booking`, `Payment`, `Notification`, `Reporting`) có đặc tính tải và mức độ nhạy cảm hoàn toàn khác nhau: `Booking` chịu tranh chấp khóa dòng cao nhất, `Payment` cần vùng cách ly bảo mật nhận Webhook từ cổng ngân hàng ngoài, còn `Reporting/Notification` là tác vụ đọc/gửi thông báo không được phép làm chậm luồng mua vé.*
  > *2. **Về mặt kiểm soát độ phức tạp cho nhóm 4 người**: Nhóm giữ toàn bộ mã nguồn trong **1 Monorepo**, dùng chung 1 cụm PostgreSQL vật lý nhưng tách **6 logical databases riêng biệt**, dùng chung 3 gói kỹ thuật `BuildingBlocks`, và không tách nhỏ vụn thêm các tính năng phụ (như Coupon vẫn đặt trong `Booking`, Organization profile vẫn đặt trong `Transport`)."*
- **Dẫn chứng code**: `docs/system-design/02-01-system-architecture/02-01-12-architecture-decisions.md` (`ADR-001`, `ADR-005`, `ADR-014`, `ADR-016`).

---

### Câu 2: Trong hình `docs/SystemArchitecture.png` của nhóm có ghi SQL Server và Entity Framework Core, nhưng trong code lại không thấy EF Core đâu. Giải thích thế nào?
- **Ý đồ hội đồng**: Bắt bài xem sinh viên có copy ảnh kiến trúc trên mạng hoặc dùng ảnh cũ mà không đọc code thật không!
- **Đáp án chuẩn**:
  > *"Bức ảnh đó là bản phác thảo ý tưởng từ giai đoạn khởi tạo ban đầu trước khi chốt Implementation Baseline. Trong quá trình hiện thực hóa mã nguồn trên **.NET 10**, nhóm đã quyết định chuyển hoàn toàn sang **PostgreSQL 17 kết hợp ADO.NET thuần qua thư viện `Npgsql` 10.0** mà không dùng EF Core. Lý do cốt lõi là các bài toán khó nhất của dự án đều cần can thiệp sâu ở tầng SQL của PostgreSQL: khóa bi quan `SELECT ... FOR UPDATE`, tránh deadlock bằng `ORDER BY id FOR UPDATE`, khóa tư vấn `pg_advisory_xact_lock`, ràng buộc loại trừ trùng lịch `EXCLUDE USING gist` trên `tstzrange`, và `SET CONSTRAINTS ALL DEFERRED`. Dùng SQL thuần kèm bộ `SqlBaselineMigrator` giúp nhóm kiểm soát 100% kế hoạch thực thi và khóa dòng."*
- **Dẫn chứng code**: `workspace/Directory.Packages.props` (`Npgsql 10.0.0`), `BookingRepository.cs`, `SePayPaymentStore.cs`, `docs/database/transport/001_initial.sql`.

---

### Câu 3: Clean Architecture 4 tầng trong mỗi service của nhóm hoạt động ra sao? Làm sao đảm bảo thành viên trong nhóm code gấp không viết thẳng SQL vào tầng API hay gọi chéo sang service khác?
- **Ý đồ hội đồng**: Kiểm tra sự hiểu biết về **Dependency Inversion** và kiểm soát chất lượng kiến trúc thực tế.
- **Đáp án chuẩn**:
  > *"Mỗi service được chia thành 4 project `.csproj`: `Domain` (luật thuần túy, không phụ thuộc ngoài), `Application` (Use Cases như `BookingService` và định nghĩa các Interface/Ports như `IBookingRepository`), `Infrastructure` (thực thi Ports bằng `Npgsql` và `RabbitMQ`), và `Api` (Minimal APIs kết nối Dependency Injection).*
  > *Điểm đặc biệt là nhóm không dựa vào nhắc nhở thủ công khi review code, mà viết bộ kiểm thử tự động bằng thư viện **`NetArchTest.Rules`** và quét XML `.csproj`: nếu tầng `Domain` hoặc `Application` tham chiếu `Npgsql`/`AspNetCore`, hoặc nếu một service tạo `<ProjectReference>` sang service khác, bộ test `ArchitectureTests` sẽ đánh trượt bản build ngay lập tức!"*
- **Dẫn chứng code**: `workspace/src/tests/architecture/BusTicketPlatform.ArchitectureTests/LayerDependencyTests.cs` và `ProjectReferenceTests.cs`.

---

### Câu 4: Tại sao các hàm Service trong dự án không ném `Exception` khi gặp lỗi nghiệp vụ (như hết ghế, sai mật khẩu) mà lại trả về kiểu `Result<T>`?
- **Ý đồ hội đồng**: Kiểm tra tư duy thiết kế phần mềm hiện đại và hiệu năng runtime .NET.
- **Đáp án chuẩn**:
  > *"Nhóm áp dụng mẫu **Railway-Oriented Programming** với kiểu `readonly record struct Result<T>` vì 3 lý do:*
  > *1. **Hiệu năng**: Trong .NET, `throw Exception` buộc CLR phải dừng luồng và quét ngược toàn bộ Call Stack (stack unwinding) rất tốn CPU; nếu 500 khách cùng tranh 1 ghế cuối thì 499 người nhận lỗi hết ghế là luồng nghiệp vụ bình thường, không phải lỗi hệ thống. Dùng `record struct` nằm trên Stack nên không tốn cấp phát bộ nhớ Heap (zero heap allocation).*
  > *2. **Tính tường minh**: Chữ ký hàm `Task<Result<SeatHoldDto>>` buộc tầng Endpoint phải kiểm tra `IsSuccess` và chuyển đổi qua `ToHttp()`.*
  > *3. **Bảo mật**: Chỉ những sự cố sập kết nối ngoài dự kiến mới đi vào `catch (Exception)` của `ErrorEnvelopeMiddleware`, nơi toàn bộ chi tiết nhạy cảm bị ẩn đi và thay bằng mã `500 INTERNAL_ERROR` kèm `correlationId`."*
- **Dẫn chứng code**: `BuildingBlocks/Results/Result.cs`, `BuildingBlocks.AspNetCore/Http/ErrorEnvelopeMiddleware.cs`.

---

### Câu 5: Tại sao dự án dùng `UUIDv7` (`Guid.CreateVersion7()`) làm khóa chính thay vì `INT IDENTITY` hay `UUIDv4` (`Guid.NewGuid()`) thông thường?
- **Ý đồ hội đồng**: Câu hỏi phân loại sinh viên Giỏi/Xuất sắc về cấu trúc dữ liệu CSDL phân tán!
- **Đáp án chuẩn**:
  > *"`INT IDENTITY` tự tăng dễ bị kẻ xấu đoán quy mô đơn hàng/vé (tấn công BOLA/enumeration) và gây nghẽn khi sinh ID phân tán trước lúc vào DB. Ngược lại, `UUIDv4` hoàn toàn ngẫu nhiên nên khi `INSERT` vào chỉ mục B-Tree của PostgreSQL, bản ghi mới chèn lung tung vào giữa các trang dữ liệu cũ, gây phân mảnh trang (Page Splits), tăng Random I/O và làm phình Write-Ahead Log (WAL).*
  > **`UUIDv7` (chuẩn RFC 9562 tích hợp sẵn trong .NET 9/10)** đặt 48-bit Unix timestamp mili-giây lên đầu rồi mới đến phần ngẫu nhiên, nên các ID sinh ra **luôn tăng dần theo thời gian (k-sortable)**: vừa không thể đoán trước phần đuôi ngẫu nhiên, vừa giúp B-Tree của PostgreSQL luôn chèn tuần tự vào cuối cây nhanh tương đương khóa số nguyên!"*
- **Dẫn chứng code**: `BuildingBlocks/Ids/UuidV7IdGenerator.cs`.

---

## NHÓM B — API GATEWAY YARP, CORS, IDEMPOTENCY & ERROR HANDLING (Câu 6 $\rightarrow$ 10)

### Câu 6: Tại sao trong file `appsettings.json` của YARP Gateway lại có những con số `"Order": -40`, `-30`, `-20` và `10`? Không để mặc định được sao?
- **Ý đồ hội đồng**: Kiểm tra xem bạn có hiểu cách YARP khớp route hay chỉ copy cấu hình.
- **Đáp án chuẩn**:
  > *"Nếu không cấu hình `Order` âm, hệ thống sẽ định tuyến sai ngay lập tức! Vì nhóm thiết kế mặt phẳng RESTful hướng tài nguyên thống nhất cho Client (ví dụ mọi thao tác nhà xe đều bắt đầu bằng `/api/v1/operator/...`, mọi thao tác chuyến xe đều bắt đầu bằng `/api/v1/trips/...`). Route bao quát `/api/v1/operator/{**catch-all}` trỏ về `Transport` được đặt `Order: 10`. Những nhánh con thuộc quyền sở hữu của service khác bắt buộc phải có `Order` nhỏ hơn để được YARP xét khớp trước: như `/operator/staff/**` có `Order: -40` đi về `Identity`, `/operator/bookings` có `Order: -30` đi về `Booking`, `/operator/refunds` có `Order: -30` đi về `Payment`. Nhờ đó Frontend có một bộ URL cực kỳ sạch sẽ mà ranh giới Bounded Context phía sau vẫn tách bạch 100%."*
- **Dẫn chứng code**: `workspace/src/gateway/BusTicketPlatform.Gateway/appsettings.json` và bài kiểm thử tự động `GatewayClientSurfaceTests.cs`.

---

### Câu 7: Tại sao YARP Gateway của nhóm KHÔNG kiểm tra chữ ký JWT ngay tại cổng mà lại để các Microservices phía sau tự kiểm tra?
- **Ý đồ hội đồng**: Kiểm tra tư duy phòng thủ chiều sâu (Zero-Trust / Defense-in-Depth) và đối chiếu thiết kế với thực tế code.
- **Đáp án chuẩn**:
  > *"Trong bản cài đặt hiện tại, Gateway đóng vai trò Stateless Reverse Proxy xử lý tập trung CORS, Correlation ID, chuẩn hóa lỗi `503 UPSTREAM_UNAVAILABLE` và gom tài liệu OpenAPI, còn việc xác thực JWT (`AddPlatformJwt`) được đặt trực tiếp tại cả 6 Microservices phía sau theo nguyên tắc `AUTHZ-002` (Defense-in-Depth): không một service nghiệp vụ nào được phép tin tưởng mù quáng rằng request đi qua mạng nội bộ là đã hợp lệ. Hơn nữa, riêng `Identity Service` cần kiểm tra sâu tới tận cột `authorization_version` và trạng thái `ACTIVE` trong DB riêng của nó qua sự kiện `OnTokenValidated`, điều mà Gateway không thể và không được phép chọc vào DB Identity để làm."*
- **Dẫn chứng code**: `Gateway/Program.cs`, `BuildingBlocks.AspNetCore/Auth/PlatformJwtExtensions.cs`, `Identity.Api/Program.cs` (dòng 44–67).

---

### Câu 8: Khi người dùng ở trên xe khách sóng 4G yếu, bấm nút "Tạo Booking" bị quay vòng rồi bấm lại lần nữa (hoặc app tự retry), hệ thống làm sao để không tạo ra 2 đơn đặt vé?
- **Ý đồ hội đồng**: Kiểm tra cơ chế **HTTP Idempotency** thực tế.
- **Đáp án chuẩn**:
  > *"Mọi API thay đổi trạng thái quan trọng (`POST/PUT/PATCH`) đều bắt buộc đính kèm header **`Idempotency-Key`** dài từ 16 đến 200 ký tự. Hàm `PlatformHttp.WithIdempotency` tính mã băm `SHA-256` của toàn bộ JSON request body và tra cứu bảng `idempotency_records` trong PostgreSQL theo bộ khóa duy nhất `(actor_scope, operation, target_reference, idempotency_key)`:*
  > *- Nếu request đầu đang chạy dở, request thứ hai nhận ngay `409 IDEMPOTENCY_IN_PROGRESS`.*
  > *- Nếu request đầu đã xong, request thứ hai nhận lại nguyên vẹn mã HTTP và JSON snapshot đã lưu (trong vòng 24 giờ) mà không chạy lại logic nghiệp vụ.*
  > *- Nếu dùng lại cùng `Idempotency-Key` nhưng sửa đổi dữ liệu trong body (khác mã băm SHA-256), hệ thống từ chối ngay với `409 IDEMPOTENCY_CONFLICT`."*
- **Dẫn chứng code**: `BuildingBlocks.AspNetCore/Http/PlatformHttp.cs` (`WithIdempotency`) và `Booking.Infrastructure/Persistence/IdempotencyStore.cs`.

---

### Câu 9: `X-Correlation-Id` dùng để làm gì? Nếu khách hàng báo lỗi thanh toán, em dùng nó để debug xuyên qua 6 services và RabbitMQ bằng cách nào?
- **Ý đồ hội đồng**: Kiểm tra khả năng vận hành và truy vết phân tán (Distributed Tracing / Observability).
- **Đáp án chuẩn**:
  > *"Trong hệ thống Microservices, một thao tác của khách đi qua nhiều tiến trình khác nhau nên không thể dò log theo luồng đơn lẻ. Khi request chạm vào hệ thống, `CorrelationMiddleware` đọc header `X-Correlation-Id` (hoặc sinh mới một `UUIDv7` nếu chưa có), gắn vào `HttpContext` và trả ngược lại trong cả header lẫn trường `error.correlationId` của JSON lỗi. Khi service phát sự kiện bất đồng bộ vào `outbox_messages` để đẩy lên RabbitMQ, chính mã `CorrelationId` này được đóng gói vào phong bì `EventMessage` và header AMQP. Nhờ vậy, khi khách chụp màn hình báo lỗi có mã `correlationId`, người vận hành chỉ cần lọc một mã duy nhất đó trên log hoặc bảng `outbox_messages` / `security_audits` là dựng lại được toàn bộ đường đi của giao dịch."*
- **Dẫn chứng code**: `CorrelationMiddleware.cs`, `ErrorEnvelope.cs`, `EventMessage.cs`, `RabbitMqSmokeBus.cs`.

---

### Câu 10: Trong Docker Compose, trình duyệt người dùng gọi API qua đường nào? Tại sao trong Docker không bị lỗi CORS dù có tới 3 cổng Web?
- **Ý đồ hội đồng**: Kiểm tra hiểu biết thực tế về mạng Container, Nginx Reverse Proxy và Browser Same-Origin Policy.
- **Đáp án chuẩn**:
  > *"Khi chạy local bằng Vite dev server (`localhost:5173`, `5174`), trình duyệt gọi sang `localhost:5080` khác port nên kích hoạt CORS — lúc này chính sách `UseCors("clients")` trên YARP Gateway sẽ cho phép các origin được khai báo kèm header `Idempotency-Key` và `Authorization`. Còn khi đóng gói vào Docker (`docker-compose.apps.yml` / `production.yml`), mỗi cổng Web chạy trên một container **Nginx unprivileged** riêng; cấu hình `nginx.conf` phục vụ file tĩnh SPA ở `/` và tự động proxy ngược các đường dẫn `/api/` cùng `/integrations/` sang `http://gateway:8080` ở mạng nội bộ Docker. Đối với trình duyệt, cả giao diện lẫn API đều có cùng một Origin (Same-Origin), vừa triệt tiêu chi phí gói tin preflight `OPTIONS` vừa không cần phơi cổng `5080` của Gateway trực tiếp ra ngoài ở bản Production!"*
- **Dẫn chứng code**: `workspace/src/apps/web/docker/nginx.conf`, `Gateway/Program.cs`, `docker-compose.production.yml`.

---

## NHÓM C — BẢO MẬT, IDENTITY, JWT, RBAC/MULTI-TENANCY & OWASP (Câu 11 $\rightarrow$ 15)

### Câu 11: Tại sao nhóm dùng thuật toán `Argon2id` để băm mật khẩu và phải dùng `FixedTimeEquals` khi kiểm tra? Dùng `BCrypt` hay `==` bình thường có sao không?
- **Ý đồ hội đồng**: Kiểm tra kiến thức mật mã học ứng dụng và tấn công kênh kề (Side-Channel Timing Attack).
- **Đáp án chuẩn**:
  > *"`Argon2id` là thuật toán tiêu chuẩn hiện đại nhất (chiến thắng cuộc thi PHC), vượt trội hơn `PBKDF2` và `BCrypt` nhờ tính chất **Memory-Hard**: nó yêu cầu cấp phát vùng nhớ RAM cố định (`8192 KiB` trong code cùng salt 16 bytes ngẫu nhiên riêng cho từng user), khiến kẻ tấn công không thể dùng hàng ngàn nhân GPU/ASIC giá rẻ để dò mật khẩu song song.*
  > *Còn khi so sánh mã băm mật khẩu, OTP hay chữ ký Webhook, toán tử `==` thông thường sẽ dừng ngay ở byte đầu tiên bị lệch (short-circuit), làm thời gian phản hồi nhanh chậm vài nano-giây tùy số byte khớp đầu — kẻ tấn công có thể đo thời gian này để đoán dần từng byte chữ ký HMAC (**Timing Attack**). Hàm `CryptographicOperations.FixedTimeEquals` luôn duyệt hết mọi byte với thời gian hằng định, triệt tiêu hoàn toàn lỗ hổng này."*
- **Dẫn chứng code**: `Identity.Infrastructure/Security/Argon2PasswordHasher.cs`, `Payment.Application/SePayIpn.cs`, `Booking.Application/TicketQr.cs`.

---

### Câu 12: JWT bản chất là Stateless (đã cấp ra là còn hạn tới lúc `exp`). Vậy nếu một nhân viên nhà xe nghỉ việc hoặc khách bị lộ Refresh Token thì hệ thống thu hồi quyền truy cập bằng cách nào?
- **Ý đồ hội đồng**: Câu hỏi kinh điển nhất về nhược điểm của JWT!
- **Đáp án chuẩn**:
  > *"Nhóm giải quyết bằng cơ chế **3 tầng bảo vệ phối hợp**:*
  > *1. **Giới hạn vòng đời ngắn**: Access Token chỉ sống **15 phút** (`AccessTokenSeconds = 900`).*
  > *2. **Xoay vòng Refresh Token & Phát hiện đánh cắp theo Gia đình phiên (`family_id`)**: Mỗi lần gọi `/auth/refresh`, token cũ bị đánh dấu `ROTATED`. Nếu kẻ gian đánh cắp được Refresh Token cũ và đem gọi lại (hoặc người dùng thật gọi sau khi kẻ gian đã xoay vòng), `AuthService.RefreshAsync` thấy `RevokedAt != null` sẽ lập tức gọi **`RevokeFamilyAsync`** hủy toàn bộ nhánh phiên đó (`401 SESSION_REUSE_DETECTED`).*
  > *3. **Kiểm tra phiên bản quyền `ver` (`AuthorizationVersion`)**: Khi Admin khóa user, đổi role hoặc user đổi mật khẩu, cột `authorization_version` tăng lên `+1` và toàn bộ `refresh_sessions` bị thu hồi; tại `Identity.Api`, sự kiện `OnTokenValidated` chặn đứng token cũ ngay lập tức."*
- **Dẫn chứng code**: `Identity.Application/AuthService.cs` (dòng 190–230), `AdminIdentityService.cs`, `Identity.Api/Program.cs` (dòng 44–67).

---

### Câu 13: Làm sao đảm bảo Nhân viên Nhà xe A không dùng Postman đổi `organizationId` trên URL hoặc trong JSON body để xem doanh thu hay sửa chuyến xe của Nhà xe B?
- **Ý đồ hội đồng**: Kiểm tra lỗ hổng **Broken Object Level Authorization / Cross-Tenant Data Leak (OWASP API1)**.
- **Đáp án chuẩn**:
  > *"Hệ thống tuân thủ nghiêm ngặt quy tắc `AUTHZ-003` và `BR-TENANT-002`: các API của Nhà xe (`/api/v1/operator/...`) **hoàn toàn không nhận `organizationId` từ tham số của Client**. Khi đăng nhập, `AuthService.TokenOrgAsync` truy vấn bảng `organization_memberships` đang `ACTIVE` và đóng dấu mã nhà xe vào claim **`"org"`** bên trong JWT đã được ký số. Khi xử lý request, ví dụ hàm `TryTenant` trong `TransportService`, hệ thống chỉ lấy `actor.OrganizationId` từ claim `"org"` đó để truyền vào mệnh đề `WHERE organization_id = @org` của mọi câu SQL. Nếu cố truyền ID chuyến xe của nhà xe khác trên URL, truy vấn không khớp `@org` sẽ trả về `404 RESOURCE_NOT_FOUND` (không lộ cả sự tồn tại của bản ghi!)."*
- **Dẫn chứng code**: `AuthService.cs` (`TokenOrgAsync`), `BuildingBlocks.AspNetCore/Http/PlatformHttp.cs` (`OrganizationId()`), `TransportService.cs` (`TryTenant` dòng 952).

---

### Câu 14: Tài xế (`DRIVER`) cũng thuộc cùng một `organizationId` với nhà xe. Vậy tài xế có xem được danh sách hành khách (Manifest) hay bấm khởi hành chuyến xe của tài xế khác cùng nhà xe không?
- **Ý đồ hội đồng**: Kiểm tra phân quyền chi tiết ở mức phân công tài nguyên (Fine-grained Resource Assignment).
- **Đáp án chuẩn**:
  > *"Không được phép ạ (`AUTHZ-005`, `BR-TRIP-003`). Với vai trò `DRIVER`, hệ thống kiểm tra **2 lớp liên tiếp**: lớp thứ nhất là phải khớp `OrganizationId` của nhà xe; lớp thứ hai là kiểm tra trực tiếp phân công chuyến xe: bên `TransportService.TransitionTripAsync` gọi `store.IsDriverAssignedToTripAsync(actor.UserId, tripId)`, còn bên `BookingService.ManifestAsync` và `CanCheckInAsync` đối chiếu `trip.DriverUserId == actor.UserId` được lưu trong bản chụp chuyến xe. Ngoài ra, dữ liệu Manifest trả về cho tài xế cũng được tối giản PII (chỉ gồm tên hành khách, mã ghế, loại điểm đón và trạng thái vé — không trả email, SĐT hay số CCCD của khách)."*
- **Dẫn chứng code**: `TransportService.cs` (dòng 843–847), `BookingService.cs` (dòng 665–670, 787–788), `BookingRepository.cs` (`GetManifestAsync` dòng 787).

---

### Câu 15: Trong thư mục `docs/security/` có báo cáo OWASP API Audit ghi nhận một số lỗ hổng `F01..F06`. Tại sao trong kho code vẫn còn những điểm này?
- **Ý đồ hội đồng**: Thử bản lĩnh trung thực và tư duy kỹ sư bảo mật của nhóm!
- **Đáp án chuẩn**:
  > *"Đó là đợt **kiểm toán bảo mật chủ động (Internal Red-Team / OWASP API Security Audit)** do chính nhóm thực hiện vào ngày 16/11/2026 kèm bộ regression tests gắn nhãn `[Trait("Category", "SecurityAudit")]` để đánh giá khách quan khoảng cách giữa bản MVP học thuật và môi trường Production thương mại. Nhờ tự kiểm toán, nhóm đã chỉ ra chính xác 6 hạng mục cần đóng trước khi go-live thật — tiêu biểu như gắn xác thực service-to-service cho các endpoint `/internal/*` (`F01`), cưỡng bức thay khóa ký JWT mặc định khi chạy container (`F02`), và chặn trường hợp operator thiếu claim `org` ở 3 hàm search (`F03`). Việc giữ đầy đủ báo cáo bằng chứng và backlog khắc phục `SECURITY-REMEDIATION-TASKS.md` tuân theo nguyên tắc minh bạch kỹ thuật tuyệt đối của dự án."*
- **Dẫn chứng code**: `docs/security/owasp-api-2026-11-16/README.md`, `docs/security/SECURITY-REMEDIATION-TASKS.md`, `Reporting.Api.IntegrationTests/SecurityAuditTests.cs`.

---

## NHÓM D — POSTGRESQL NÂNG CAO, CHỐNG DOUBLE-BOOKING, DEADLOCK & REDIS (Câu 16 $\rightarrow$ 20)

### Câu 16: Trong Docker Compose của nhóm có chạy container `Redis` cổng `6379`. Em hãy giải thích nhóm đang dùng Redis để khóa ghế và cache ở file C# nào?
- **Ý đồ hội đồng**: **CÂU HỎI BẪY NGUY HIỂM NHẤT BUỔI BẢO VỆ!** Nếu bạn trả lời *"Dạ tụi em dùng `StackExchange.Redis` để `SETNX` khóa ghế 10 phút"*, giảng viên mở `Directory.Packages.props` ra sẽ đánh rớt điểm hiểu bài ngay vì không hề có dòng code C# nào gọi Redis!
- **Đáp án chuẩn (Điểm 10 tuyệt đối)**:
  > *"Thưa thầy/cô, trong mã nguồn C# của bản MVP hiện tại **hoàn toàn không gọi tới Redis**, và đây là quyết định kiến trúc có chủ đích đã được ghi nhận tại **ADR-008**!*
  > *Ban đầu nhóm có dựng container `redis:7-alpine` trong Docker Compose cho mục tiêu mở rộng Read-Cache và Distributed Rate Limit ở giai đoạn sau (`infra/README.md` ghi rõ 'Booking hold/cache later'). Tuy nhiên, đối với bài toán **giữ ghế và chống bán trùng**, ADR-008 bác bỏ việc dùng Redis Distributed Lock làm nguồn sự thật vì nếu Redis mất đồng bộ khi failover hoặc khóa tự hết hạn TTL trong lúc giao dịch DB bị trễ GC/mạng, hai khách sẽ đặt trùng một ghế. Do đó, 100% cơ chế giữ ghế 10 phút, dọn ghế quá hạn, chống gửi lặp `Idempotency-Key` và quản lý phiên đều do **giao dịch ACID và khóa dòng của PostgreSQL** đảm nhiệm."*
- **Dẫn chứng code**: `docs/system-design/02-01-system-architecture/02-01-12-architecture-decisions.md` (`ADR-008`), `workspace/src/infra/README.md` (dòng 65), `BookingRepository.cs`.

---

### Câu 17: Nếu không dùng cronjob hay Redis TTL để xóa ghế hết hạn, vậy khi khách giữ ghế rồi tắt trình duyệt bỏ đi, làm sao sau 10 phút người khác vào nhìn thấy ghế đó đã trống (`AVAILABLE`)?
- **Ý đồ hội đồng**: Kiểm tra cơ chế **Lazy / On-Demand Atomic Expiration** trong `BookingRepository.cs`.
- **Đáp án chuẩn**:
  > *"Nhóm sử dụng cơ chế **Thu hồi lười nguyên tử ngay trên đường dẫn truy vấn/giao dịch (`Lazy Atomic CTE Expiration`)** qua hàm `BookingRepository.ExpireHoldsAsync`. Ngay đầu mọi hàm đọc sơ đồ ghế (`GetSeatsAsync`, `AvailableSeatsAsync`), tạo giữ chỗ mới (`CreateHoldAsync`), đổi ghế (`ReplaceHoldAsync`) hay tạo đơn (`CreateBookingAsync`), hệ thống đều chạy một giao dịch gồm 2 câu lệnh Common Table Expression (`WITH expired AS (UPDATE ... WHERE expires_at <= NOW() RETURNING id) UPDATE trip_seats SET status = 'AVAILABLE' ...`).*
  > *Ưu điểm vượt trội của cách này là **độ chính xác tuyệt đối đến từng mili-giây**: ngay giây thứ `10:00.001` khi khách B mở sơ đồ ghế hoặc bấm đặt ghế đó, ghế quá hạn của khách A được giải phóng tức thì mà không bao giờ bị trễ nhịp 5–10 giây như khi chờ một tiến trình cronjob chạy ngầm!"*
- **Dẫn chứng code**: `BookingRepository.cs` (`ExpireHoldsAsync`, dòng 159–200) và `BookingService.cs` (gọi ở đầu 12 phương thức).

---

### Câu 18: Giả sử Khách A đang giữ ghế `(1A, 1B)` bấm đổi sang `(1B, 1C)`, đúng mili-giây đó Khách B đang giữ `(1C, 1D)` bấm đổi sang `(1A, 1D)`. Hệ thống làm sao không bị treo Deadlock trong PostgreSQL?
- **Ý đồ hội đồng**: Kiểm tra kiến thức hệ điều hành & CSDL sâu về **Deadlock Prevention (Điều kiện Circular Wait của Coffman)**.
- **Đáp án chuẩn**:
  > *"Deadlock chỉ xảy ra khi hai giao dịch khóa các dòng dữ liệu theo thứ tự ngược chiều nhau (A khóa `1A` rồi chờ `1C`, trong khi B khóa `1C` rồi chờ `1A`). Trong hàm `BookingRepository.ReplaceHoldAsync`, nhóm đã gom toàn bộ tập ghế cũ đang giữ và tập ghế mới muốn đổi vào **một câu lệnh `SELECT` duy nhất có mệnh đề `ORDER BY id FOR UPDATE`**!*
  > *Việc ép PostgreSQL luôn khóa các dòng `trip_seats` theo thứ tự tăng dần của khóa chính `id` phá vỡ hoàn toàn điều kiện 'chờ đợi vòng tròn' (Circular Wait): một giao dịch sẽ lấy đủ khóa trước và chạy xong, giao dịch còn lại xếp hàng chờ ngay ở dòng `id` nhỏ nhất, tuyệt đối không thể xảy ra Deadlock!"*
- **Dẫn chứng code**: `BookingRepository.cs` (dòng 337: `SELECT id,price,status,active_hold_id FROM trip_seats WHERE trip_id=@trip AND (id=ANY(@ids) OR active_hold_id=@hold) ORDER BY id FOR UPDATE`).

---

### Câu 19: Tại sao trong bảng `trip_seats` lại có khóa ngoại `DEFERRABLE INITIALLY DEFERRED` và trong hàm `CreateBookingAsync` lại phải chạy lệnh `SET CONSTRAINTS ALL DEFERRED;`?
- **Ý đồ hội đồng**: Kiểm tra xem bạn có tự viết/hiểu thiết kế bảng nâng cao của `booking/001_initial.sql` không!
- **Đáp án chuẩn**:
  > *"Đây là kỹ thuật giải quyết bài toán **vừa giữ lịch sử hủy vé, vừa đảm bảo tại một thời điểm mỗi ghế chỉ thuộc tối đa 1 đơn sống**:*
  > *- Một ghế có thể từng được đặt ở đơn cũ rồi bị hủy, sau đó bán lại cho đơn mới, nên bảng `booking_items` có thể chứa nhiều dòng lịch sử cùng trỏ về 1 `trip_seat_id`. Để đảm bảo ghế đang `BOOKED` chỉ có đúng 1 chủ sở hữu hiện hành, bảng `trip_seats` có cột `active_booking_item_id` trỏ ngược lại `booking_items(id)` kết hợp ràng buộc `ck_trip_seat_owner`.*
  > *- Điều này tạo ra **tham chiếu vòng hai chiều** giữa `trip_seats` và `booking_items`. Nhờ khai báo khóa ngoại là `DEFERRABLE INITIALLY DEFERRED` và gọi `SET CONSTRAINTS ALL DEFERRED` đầu giao dịch `CreateBookingAsync`, PostgreSQL cho phép chúng em tiêu thụ `seat_holds`, chèn `bookings` + `booking_items` rồi cập nhật `trip_seats` mượt mà, và chỉ kiểm tra tính toàn vẹn khóa ngoại một lần duy nhất ngay trước thời điểm `COMMIT`!"*
- **Dẫn chứng code**: `docs/database/booking/001_initial.sql` (dòng 48–54 & 257–265), `docs/database/booking/012_rebook_after_cancel.sql`, `BookingRepository.cs` (dòng 431).

---

### Câu 20: Làm sao hệ thống chặn được việc hai nhân viên điều độ xếp cùng một chiếc xe (hoặc cùng một tài xế) chạy hai chuyến bị gối đầu giờ nhau chỉ 15 phút?
- **Ý đồ hội đồng**: Kiểm tra lỗ hổng **Write Skew** dưới mức cô lập `READ COMMITTED` mặc định của PostgreSQL.
- **Đáp án chuẩn**:
  > *"Nếu chỉ viết câu lệnh `SELECT COUNT(*)` kiểm tra trùng giờ trong C#, hai giao dịch chạy song song ở mức cô lập `READ COMMITTED` sẽ không nhìn thấy dòng dữ liệu chưa commit của nhau và cả hai đều `INSERT` thành công! Để chặn tuyệt đối ở tầng vật lý CSDL, nhóm nạp extension **`btree_gist`** và định nghĩa ràng buộc loại trừ **`EXCLUDE USING gist`** trên cột `tstzrange`:*
  > *- Trên bảng `trips`: `ex_bus_schedule` chặn cùng `bus_id` (`=`) có `operating_window` giao nhau (`&&`).*
  > *- Trên bảng `driver_assignments`: `ex_driver_schedule` chặn cùng `driver_profile_id` (`=`) có `assignment_window` (đã cộng khoảng đệm nghỉ 1 tiếng trước giờ đi và 1 tiếng sau giờ đến) giao nhau (`&&`). PostgreSQL tự động khóa ở mức trang chỉ mục GiST, buộc giao dịch thứ hai nhận lỗi `23P01` và chuyển thành mã lỗi chuẩn `409 SCHEDULE_CONFLICT`!"*
- **Dẫn chứng code**: `docs/database/transport/001_initial.sql` (dòng 1, 190–192, 217–219) và `TransportService.cs` (dòng 669–670, 792–795).

---

## NHÓM E — RABBITMQ, TRANSACTIONAL OUTBOX/INBOX & SAGA CHOREOGRAPHY (Câu 21 $\rightarrow$ 25)

### Câu 21: Tại sao khi lưu DB xong nhóm không gọi thẳng hàm `RabbitMQ.BasicPublish()` ngay tại đó cho nhanh mà phải ghi vào bảng `outbox_messages` rồi dùng Background Service quét mỗi 2 giây?
- **Ý đồ hội đồng**: Kiểm tra bản chất **Bài toán Ghi Kép (Dual-Write Problem)** trong hệ thống phân tán.
- **Đáp án chuẩn**:
  > *"Vì PostgreSQL và RabbitMQ là hai hệ thống lưu trữ tách biệt, không dùng chung một giao dịch nguyên tử. Nếu ta `COMMIT` PostgreSQL xong rồi mới gọi `BasicPublish()` qua mạng: giả sử đúng mili-giây đó container mất mạng hoặc RabbitMQ khởi động lại, đơn hàng đã chuyển sang `PAID` trong DB của `Payment`, nhưng sự kiện `PaymentSucceeded` bị mất vĩnh viễn trên RAM $\rightarrow$ `Booking` không bao giờ xuất vé cho khách!*
  > *Khi ghi sự kiện vào bảng `outbox_messages` ngay trong PostgreSQL (như trong `SePayPaymentStore.ApplySePayAsync` và `BookingRepository.ApplyPaidAsync`), cả trạng thái nghiệp vụ lẫn sự kiện cùng `COMMIT` hoặc cùng `ROLLBACK` 100%. Sau đó `OutboxDispatchHostedService` quét mỗi 2 giây: nếu RabbitMQ đang tắt, bản ghi vẫn nằm an toàn với `published_at IS NULL` và tự động được gửi bù ngay khi RabbitMQ sống lại!"*
- **Dẫn chứng code**: `SePayPaymentStore.cs` (dòng 89–98), `BookingRepository.cs` (dòng 620–639), `OutboxRelay.cs`, `OutboxDispatchHostedService.cs`, `MessagingSmokeTests.cs`.

---

### Câu 22: RabbitMQ có thể gửi lặp lại cùng 1 message nếu đứt mạng trước khi nhận `ACK`. Hệ thống làm sao không xử lý 2 lần? Và nếu gặp 1 message bị hỏng dữ liệu (Poison Message) thì có làm kẹt cứng hàng đợi không?
- **Ý đồ hội đồng**: Kiểm tra cơ chế **Idempotent Consumer** và **Dead-Letter Queue (DLQ)**.
- **Đáp án chuẩn**:
  > *"Ở đầu nhận (`IntegrationEventConsumerHost`), nhóm tắt chế độ `autoAck` và xử lý theo 2 cơ chế an toàn:*
  > *1. **Chống xử lý lặp bằng `InboxDeduper`**: Trước khi gọi hàm nghiệp vụ, hệ thống thực thi `INSERT INTO inbox_messages (consumer_name, message_id, ...) ON CONFLICT ON CONSTRAINT uq_inbox_consumer_message DO NOTHING RETURNING id`. Nếu trả về `null` (tức consumer này đã xử lý `EventId` đó rồi), hệ thống bỏ qua hàm nghiệp vụ và gửi `BasicAck` ngay.*
  > *2. **Chống kẹt hàng đợi bằng Dead-Letter Exchange (`platform.dlx`)**: Mọi hàng đợi đều gắn tham số `x-dead-letter-exchange: platform.dlx`. Nếu quá trình giải mã JSON hoặc xử lý nghiệp vụ ném ngoại lệ, consumer gọi **`BasicNack(requeue: false)`** — tin nhắn lỗi không bị nhét ngược lại đầu hàng đợi gây lặp vô tận, mà được RabbitMQ chuyển thẳng sang `platform.dlx` đi vào hàng đợi thư chết `booking.trip-events.dlq` để kỹ sư kiểm tra!"*
- **Dẫn chứng code**: `IntegrationEventConsumerHost.cs`, `InboxDeduper.cs`, `workspace/src/infra/rabbitmq/definitions.json`, `MessagingSmokeTests.cs` (`Publish_consume_dedupes_and_poison_goes_to_dlq`).

---

### Câu 23: Tại sao nhóm chọn Saga Choreography (các service tự lắng nghe sự kiện của nhau) thay vì Saga Orchestration (có 1 service nhạc trưởng điều phối ở giữa)?
- **Ý đồ hội đồng**: Kiểm tra lý do đằng sau quyết định **ADR-007**.
- **Đáp án chuẩn**:
  > *"Theo **ADR-007**, các luồng liên miền trong MVP (như Mở bán chuyến 2 pha hoặc Thanh toán $\rightarrow$ Xuất vé $\rightarrow$ Thông báo/Báo cáo) có chiều luồng sự kiện rất tuyến tính và rõ ràng (từ 2 đến 3 bước chuyển tiếp). Dùng **Saga Choreography** qua Topic Exchange `platform.events` giúp:*
  > *1. Không tạo ra một điểm nghẽn/điểm chết trung tâm (Single Point of Failure) ở bộ điều phối.*
  > *2. Các service phụ trợ như `Notification` và `Reporting` có thể tự đăng ký lắng nghe sự kiện (`Fan-out`) hoàn toàn độc lập mà `Booking` hay `Payment` không hề cần biết tới sự tồn tại của chúng.*
  > *Để khắc phục nhược điểm khó theo dõi của Choreography, nhóm gắn xuyên suốt `CorrelationId` vào mọi sự kiện và có sẵn các sự kiện bù trừ tường minh như `RefundRequested`."*
- **Dẫn chứng code**: `ADR-007` trong `02-01-12-architecture-decisions.md`, `BookingEventHandlers.cs`, `PaymentEventHandlers.cs`, `TransportEventHandlers.cs`.

---

### Câu 24: Tại sao khi Nhà xe bấm "Publish Trip" ở `Transport Service`, chuyến xe không được mở bán (`sellable = true`) ngay lập tức mà phải đợi vòng sự kiện đi sang `Booking` rồi quay ngược về `Transport`?
- **Ý đồ hội đồng**: Kiểm tra hiểu biết về **Consistency liên miền trong Saga Mở bán chuyến xe**.
- **Đáp án chuẩn**:
  > *"Nếu `Transport` bật `sellable = true` ngay lúc vừa bấm Publish, khách hàng tìm kiếm trên trang chủ sẽ thấy ngay chuyến xe đó trong vòng vài trăm mili-giây **trước khi** sự kiện `TripPublished` kịp qua RabbitMQ sang `Booking Service` để khởi tạo các dòng ghế trong bảng `trip_seats`! Kết quả là khách bấm vào xem chuyến sẽ thấy 0 ghế trống hoặc nhận lỗi `404`.*
  > *Nhờ thiết kế bắt tay 2 pha: `Transport` chuyển sang `SCHEDULED` nhưng giữ `sellable = false` $\rightarrow$ phát `TripPublished` $\rightarrow$ `Booking` tạo xong toàn bộ ghế trong `trip_seats` mới phát ngược `TripInventoryReady` $\rightarrow$ `Transport` nhận được mới bật `sellable = true`. Nhờ vậy, bất kỳ chuyến xe nào xuất hiện trên kết quả tìm kiếm đều đảm bảo 100% đã sẵn sàng tồn kho ghế để bán!"*
- **Dẫn chứng code**: `TransportService.PublishTripAsync` (dòng 748), `BookingService.ImportPublishedTripAsync` (dòng 57), `TransportEventHandlers.HandleInventoryReadyAsync` (dòng 9).

---

### Câu 25: `Payment Service` không được phép kết nối vào DB của `Booking Service` và cũng không gọi HTTP sang `Booking`. Vậy khi khách gọi `POST /api/v1/bookings/{id}/payments`, làm sao `Payment` biết đơn đó của ai và cần thu đúng bao nhiêu tiền?
- **Ý đồ hội đồng**: Câu hỏi rất sâu về cách truyền dữ liệu chuẩn giá giữa các Bounded Contexts độc lập!
- **Đáp án chuẩn**:
  > *"Ngay khi khách hàng tạo đơn đặt vé thành công ở `Booking Service`, `Booking` phát sự kiện `BookingCreated` mang theo `bookingId`, `customerId`, `organizationId`, tổng tiền sau giảm giá `grossAmount`, tỷ lệ hoa hồng `commissionRate` và thời hạn `expiresAt`. `PaymentEventHandlers` hứng sự kiện này và lưu vào bảng cục bộ **`booking_quotes`** của riêng `Payment DB`.*
  > *Thậm chí để xử lý độ trễ vài trăm mili-giây khi khách vừa tạo đơn xong đã lập tức bấm Thanh toán ngay trước khi message kịp qua RabbitMQ, hàm `PaymentService.CreateAsync` có cơ chế **`WaitForQuoteAsync`** tự động thăm dò ngắn hạn chờ bản ghi `booking_quotes` xuất hiện rồi mới lấy đúng số tiền do Server chốt để tạo giao dịch thanh toán — tuyệt đối không nhận số tiền từ request của Client!"*
- **Dẫn chứng code**: `PaymentEventHandlers.cs` (dòng 19–60), `PaymentService.cs` (`CreateAsync` dòng 121 & `WaitForQuoteAsync`).

---

## NHÓM F — THANH TOÁN SEPAY, COUPON, CQRS REPORTING, POWER BI & FRONTEND/MOBILE (Câu 26 $\rightarrow$ 30)

### Câu 26: Khi áp dụng mã giảm giá (ví dụ giảm `50.000đ` cho đơn gồm 3 ghế đồng giá `100.000đ`), `50.000` chia `3` bị lẻ thập phân. Hệ thống lưu tiền kiểu số nguyên `bigint` VND thì làm sao tổng tiền các vé không bị lệch mất `1đ` hay `2đ`?
- **Ý đồ hội đồng**: Kiểm tra sự tỉ mỉ trong kỹ thuật lập trình tài chính/kế toán (Penny Rounding Allocation)!
- **Đáp án chuẩn**:
  > *"Nếu chia riêng lẻ từng ghế `floor(50000 / 3) = 16666`, tổng giảm giá của 3 ghế chỉ là `49.998đ`, lệch mất `2đ` so với tổng đơn và vi phạm hằng đẳng thức kế toán khi khách hủy lẻ từng vé! Trong `BookingService.CreateBookingAsync` (dòng 313–320), nhóm dùng thuật toán **Phân bổ làm tròn lũy kế (`Cumulative Rounding Allocation`)**: tính tổng phụ cộng dồn tới ghế thứ $i$, tính tổng chiết khấu lũy kế `floor(runningSubtotal * discount / subtotal)` rồi trừ đi phần chiết khấu đã phân bổ cho các ghế trước đó. Với ví dụ trên, 3 ghế sẽ nhận mức giảm lần lượt là `16.666đ`, `16.667đ`, và `16.667đ` — đảm bảo mọi vé đều không âm và tổng tiền ròng của các vé cộng lại khớp **chính xác tuyệt đối 100%** với tổng tiền đơn hàng!"*
- **Dẫn chứng code**: `BookingService.cs` (dòng 313–320) và tài liệu `docs/implementation/coupons-contract.md`.

---

### Câu 27: PBL6 xác nhận thanh toán và hoàn tiền qua SePay thế nào?

> Checkout mở trang SePay bằng biểu mẫu đã ký. Payment xác thực IPN và đối chiếu hóa đơn, số tiền trước khi ghi nhận. Khi chờ hoàn tiền, hệ thống lưu `REQUESTED` / `REFUND_PENDING` để tài chính theo dõi xử lý.


### Câu 28: Tại `Reporting Service`, nếu sự kiện `RefundSucceeded` (đã hoàn tiền) vì lý do mạng lại bay tới trước sự kiện `BookingCancelled` (báo hủy vé với `refundedAmount = 0`), báo cáo doanh thu có bị ghi đè mất số tiền hoàn về `0` không?
- **Ý đồ hội đồng**: Kiểm tra bài toán kinh điển của CQRS / Event-Driven: **Out-of-Order Events (Sự kiện đến ngược thứ tự)**!
- **Đáp án chuẩn**:
  > *"Không bị ghi đè sai ạ! Trong `ReportingRepository.UpsertBookingAsync`, câu lệnh `INSERT INTO booking_projections ... ON CONFLICT (booking_id) DO UPDATE` không gán đè mù quáng bằng `EXCLUDED.refunded_amount`, mà sử dụng hàm **`GREATEST(booking_projections.refunded_amount, EXCLUDED.refunded_amount)`** cùng biểu thức `CASE WHEN booking_projections.refunded_amount > 0 AND EXCLUDED.refunded_amount = 0 THEN booking_projections.status ELSE EXCLUDED.status`. Ngay sau đó, câu lệnh thứ hai tính toán lại toàn bộ bảng tổng hợp ngày `revenue_projections` từ trạng thái chuẩn của `booking_projections` theo múi giờ `Asia/Ho_Chi_Minh`. Nhờ tính chất giao hoán và lũy đẳng này, dù sự kiện đến xuôi hay ngược thứ tự, con số doanh thu ròng cuối cùng vẫn khớp 100% — và đã được kiểm chứng bằng Integration Test!"*
- **Dẫn chứng code**: `ReportingRepository.cs` (`UpsertBookingAsync` & `ApplyRefundAsync`) và `ReportingHealthTests.cs` (`Refund_updates_booking_and_revenue_projections_once`).

---

### Câu 29: Tài liệu dự án có nhắc đến `Power BI Analytics` (mục `3.8` / `ADR-018`). Hiện tại Power BI đã chạy trong code chưa, và nếu tích hợp thì làm sao nhà xe A không xem được biểu đồ của nhà xe B trên Power BI?
- **Ý đồ hội đồng**: Kiểm tra ranh giới giữa phạm vi `MUST` (đã code) và thiết kế mở rộng `SHOULD` hậu MVP (`ADR-018`).
- **Đáp án chuẩn**:
  > *"Trong SRS 2.1.0, các API báo cáo cơ bản và biểu đồ trên Back-office thuộc phạm vi `MUST` và **đã được cài đặt hoàn chỉnh** tại `Reporting Service`. Còn **Power BI Embedded (`FR-REPORT-004`, `ADR-018`)** thuộc phạm vi `SHOULD` hậu MVP nên hiện ở trạng thái **Thiết kế chi tiết sẵn sàng triển khai (Proposed Detailed Design)** chứ chưa gắn file `.pbip` vào runtime.*
  > *Về kiến trúc bảo mật đa nhà xe đã thiết kế sẵn cho Power BI: thứ nhất, Power BI dùng chế độ **Import** chỉ đọc từ các `bi.vw_fact_*` chỉ đọc trên `reporting_db` (tuyệt đối không đọc vào DB giao dịch hay chứa PII). Thứ hai, sử dụng mô hình **App-Owns-Data (Service Principal)**: Backend kiểm tra JWT, lấy `OrganizationId` từ ngữ cảnh tin cậy và cấp Embed Token ngắn hạn gắn vai trò **Dynamic Row-Level Security (`TenantViewer`)** với biểu thức DAX `DimOrganization[OrganizationId] = CUSTOMDATA()`, đảm bảo cô lập tuyệt đối dữ liệu giữa các nhà xe ngay bên trong Semantic Model."*
- **Dẫn chứng code**: `docs/detailed-design/03-08-power-bi-analytics/README.md` và `ADR-018`.

---

### Câu 30: Ở phía Frontend Web, giả sử Access Token 15 phút vừa hết hạn đúng lúc người dùng mở trang Dashboard khiến trình duyệt bắn 5 request API cùng lúc và cả 5 đều nhận `401`. Chuyện gì xảy ra nếu cả 5 cùng gọi `/api/v1/auth/refresh`?
- **Ý đồ hội đồng**: Câu hỏi nối kết hoàn hảo giữa cơ chế bảo mật Backend (Câu 12) và kỹ thuật lập trình bất đồng bộ trên Frontend!
- **Đáp án chuẩn**:
  > *"Câu hỏi rất hay ạ! Vì Backend cài đặt cơ chế **Refresh Token Reuse Detection** cực gắt: nếu cả 5 request trên Frontend đều cầm cùng một `RefreshToken R1` gọi song song lên `/api/v1/auth/refresh`, request đầu tiên sẽ xoay vòng `R1 -> R2`, còn 4 request đến chậm vài mili-giây sau sẽ bị Backend coi là hành vi dùng lại token cũ đã thu hồi (`ROTATED`) và lập tức gọi `RevokeFamilyAsync` đá văng người dùng ra ngoài với lỗi `401 SESSION_REUSE_DETECTED`!*
  > *Để giải quyết triệt để sự phối hợp FE–BE này, tầng HTTP client (`client.ts` trên Web và `@busticket/api-client` trên Mobile) cài đặt cơ chế **Single-Flight 401 Refresh (Khóa đơn luồng bằng Promise dùng chung)**: request đầu tiên gặp `401` sẽ khởi tạo 1 biến `refreshPromise` gọi `/auth/refresh`; 4 request gặp `401` còn lại thấy `refreshPromise` đang chạy sẽ cùng `await` chung đúng Promise đó, sau đó cả 5 cùng lấy Access Token mới để tự động gửi lại request ban đầu một cách mượt mà!"*
- **Dẫn chứng code**: `workspace/src/apps/web/docs/technical/BACKEND_INTEGRATION.md`, `workspace/src/apps/web/src/shared/api/client.ts`, `workspace/src/packages/api-client/src/index.ts`.
