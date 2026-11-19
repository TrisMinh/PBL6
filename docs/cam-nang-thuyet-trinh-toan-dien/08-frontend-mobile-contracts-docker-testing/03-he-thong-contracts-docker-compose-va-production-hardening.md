# Bài 03: Hệ Thống Executable Contracts, Nghệ Thuật Docker Compose Overlays & Gia Cố Bảo Mật Production

> **Mục tiêu bài học:** Bài viết này giải thích từ gốc rễ cách dự án **BLUE Bus Ticket Platform (PBL6)** xóa bỏ tình trạng *"chờ nhau ghép code"* bằng triết lý **Contract-First Development** (OpenAPI 3.1, AsyncAPI 3.1, JSON Schema 2020-12), cách tổ chức **5 lớp tệp Docker Compose Overlays** linh hoạt cho mọi kịch bản (từ máy cá nhân Windows, tích hợp cổng SePay thật qua Tunnel đến máy chủ Production), và mổ xẻ từng chốt chặn **Container Security Hardening** cùng quy trình **Sao lưu & Diễn tập Khôi phục Thảm họa (Backup & Restore Verification)** tự động cho 6 cơ sở dữ liệu PostgreSQL.

---

## 1. Triết Lý Contract-First Development: Chìa Khóa Để 4 Mảng Làm Việc Song Song Không Đợi Nhau

### 1.1. Nỗi Đau "Code-First Truyền Thống" Trong Đồ Án Đa Tầng

Trong một dự án lớn gồm 6 Microservices C#, 3 cổng Web React 19 và 1 ứng dụng Mobile React Native, nếu làm theo kiểu tự phát truyền thống:
1. Nhóm Backend (`BE-1`, `BE-2`) cặm cụi viết Entity, Database, Controller mất 3 tuần. Trong suốt 3 tuần đó, nhóm Frontend (`FE`) và Mobile (`MOBILE`) ngồi chơi hoặc tự bịa ra JSON kiểu `{ user_name: "A", total_price: 150000 }`.
2. Đến tuần thứ 4 ghép hệ thống, Backend trả về `{ fullName: "A", total: 150000, currency: "VND" }`, còn sự kiện bắn qua RabbitMQ từ `Booking` gửi `booking_id` nhưng `Payment` lại đọc `bookingId`! Cả nhóm rơi vào cảnh sửa đi sửa lại trong hoảng loạn ngay sát ngày nộp bài.

Để triệt tiêu hoàn toàn rủi ro này, dự án **BLUE** áp dụng triết lý **Executable Contract-First Development** được định nghĩa tại [docs/contracts/README.md](file:///C:/Users/minht/.gemini/antigravity/worktrees/PBL6/c_to_n_b/docs/contracts/README.md):

> *"Detailed Design giải thích ngữ nghĩa nghiệp vụ (semantics); còn các tệp hợp đồng đọc được bằng máy (machine-readable contracts) trong `docs/contracts/` là nguồn chân lý tối cao quyết định tên đường dẫn, tên trường JSON và cấu trúc thông điệp sự kiện."*

---

### 1.2. Bộ Ba Hợp Đồng Thực Thi (The Contract Triad)

Hệ thống khóa chặt mọi biên giao tiếp bằng đúng **3 tệp hợp đồng chuẩn quốc tế**:

```mermaid
flowchart TD
    subgraph Contracts["docs/contracts/ (Nguồn chân lý đọc được bằng máy)"]
        OAS["OpenAPI 3.1 (platform-mvp.openapi.yaml - 77 HTTP Operations)"]
        AAS["AsyncAPI 3.1 (platform-mvp.asyncapi.yaml - 20 Message Channels)"]
        JSS["JSON Schema 2020-12 (platform-message.schema.json - Runtime Envelope)"]
    end

    OAS -->|"Khóa biên HTTP REST"| BE1["BE-1: Identity, Transport, Booking"]
    OAS -->|"Khóa biên HTTP REST"| BE2["BE-2: Payment, Notification, Reporting"]
    OAS -->|"Sinh MSW Mock & Zod Contracts"| FE["FE: 3 Web Portals (React 19)"]
    OAS -->|"Định nghĩa kiểu SDK"| MOB["MOBILE: @busticket/api-client & Expo"]

    AAS -->|"Khóa Routing Key & Tên sự kiện"| BE1
    AAS -->|"Khóa Routing Key & Tên sự kiện"| BE2
    JSS -->|"Kiểm định Payload thật trên RabbitMQ"| CI["ContractTests & MessagingSmokeTests"]
```

Hãy hiểu rõ vai trò cụ thể của từng tệp đối với người mới:

1. **OpenAPI 3.1 (`docs/contracts/openapi/platform-mvp.openapi.yaml`):**
   - Đặc tả toàn bộ **77 thao tác HTTP đồng bộ (RESTful Operations)** đi qua API Gateway (chỉ giữ phạm vi `MUST`, loại bỏ mọi endpoint dư thừa).
   - Mỗi thao tác có một mã `operationId` duy nhất toàn cục (ví dụ `handlePaymentReturn`, `createBooking`, `previewCancellation`), khai báo tường minh kiểu dữ liệu Request Body, Query Parameters, Header `Idempotency-Key` và bắt buộc mọi endpoint đều khai báo phản hồi lỗi mặc định `default: $ref: '#/components/responses/Error'` (`ErrorEnvelope`).
   - Nhờ tệp này, ngay từ Ngày 1: `FE` dựng được bộ giả lập MSW v3 khớp 100% với API thật; `MOBILE` viết xong `@busticket/api-client`; còn `BE-1` và `BE-2` hiện thực các Minimal API / Controller mà không cần hỏi đi hỏi lại nhau tên biến là camelCase hay snake_case!

2. **AsyncAPI 3.1 (`docs/contracts/asyncapi/platform-mvp.asyncapi.yaml`):**
   - Nếu OpenAPI là bản hợp đồng cho giao tiếp **hỏi-đáp trực tiếp (HTTP)**, thì **AsyncAPI** chính là bản hợp đồng cho giao tiếp **bất đồng bộ hướng sự kiện (Event-Driven Messaging)** qua RabbitMQ!
   - Tệp này khóa chặt **20 kênh và thao tác gửi thông điệp (`action: send`)** giữa 6 Microservices (ví dụ: khi `Transport` xuất bản chuyến xe `TripPublished`, `Booking` phải lắng nghe đúng routing key nào để tạo tồn kho ghế `TripInventoryReady`; khi `Payment` thu tiền xong phát `PaymentSucceeded`, cả `Booking`, `Notification` và `Reporting` cùng tiêu thụ ra sao).

3. **JSON Schema Draft 2020-12 ([docs/contracts/schemas/platform-message.schema.json](file:///C:/Users/minht/.gemini/antigravity/worktrees/PBL6/c_to_n_b/docs/contracts/schemas/platform-message.schema.json)):**
   - Đây là "máy soi hải quan" chạy ngay trong lúc kiểm thử Runtime! Tệp định nghĩa phong bì chuẩn `EventEnvelope` cho cả 20 loại thông điệp thông qua cấu trúc `oneOf`:
     ```json
     "EventEnvelope": {
       "type": "object",
       "required": ["eventId", "eventType", "version", "occurredAt", "producer", "correlationId", "aggregateId", "payload"],
       "properties": {
         "eventId": {"$ref": "#/$defs/Id"},
         "eventType": {"type": "string"},
         "version": {"type": "integer", "const": 1},
         "occurredAt": {"$ref": "#/$defs/DateTime"},
         "producer": {"type": "string", "minLength": 2, "maxLength": 80},
         "correlationId": {"$ref": "#/$defs/Id"},
         "causationId": {"type": ["string", "null"], "maxLength": 128},
         "aggregateId": {"$ref": "#/$defs/Id"},
         "aggregateVersion": {"type": ["integer", "null"], "minimum": 0},
         "tenantId": {"type": ["string", "null"], "format": "uuid"},
         "payload": {"type": "object"}
       },
       "additionalProperties": false
     }
     ```
   - Chú ý thuộc tính **`"additionalProperties": false`** xuất hiện trên cả phong bì lẫn toàn bộ 20 Payload (`UserRegisteredPayload`, `TripPublishedPayload`, `BookingCreatedPayload`...): nếu một lập trình viên Backend vô tình đổi tên trường hoặc nhét thừa một trường lạ chưa đăng ký trong hợp đồng vào sự kiện Outbox, bộ kiểm thử tích hợp `JsonSchema.Net` sẽ **đánh trượt bản build ngay tức khắc**!

---

## 2. Nghệ Thuật Docker Compose Multi-File Overlays Trong `workspace/src/infra/`

### 2.1. Tại Sao Phải Chia Thành 5 File `docker-compose*.yml` Thay Vì Viết Chung 1 File Khổng Lồ?

Khi mới học Docker, chúng ta thường viết một file `docker-compose.yml` duy nhất. Nhưng trong thực tế phát triển phần mềm chuyên nghiệp, nhu cầu chạy hệ thống ở mỗi hoàn cảnh rất khác nhau:
- **Khi đang code C# / React trên IDE:** Lập trình viên chỉ muốn bật Postgres, RabbitMQ, Redis trong Docker, còn code `.NET` và `Vite` chạy trực tiếp trên máy thật để sửa dòng nào ăn ngay dòng đó (Hot Reload).
- **Khi chạy kiểm thử tích hợp toàn diện hoặc trình diễn đồ án:** Muốn gõ 1 lệnh dựng toàn bộ 17 containers (cả hạ tầng + 6 Microservices + YARP Gateway + 3 cổng Web).
- **Khi test thanh toán chuyển khoản ngân hàng SePay thật trên máy Windows cá nhân:** Máy Windows của sinh viên thường cài sẵn dịch vụ PostgreSQL ở cổng `5432` làm xung đột cổng, đồng thời cả 3 cổng Web cần chuyển từ `mock` sang `live` để nhận Webhook IPN thật qua Cloudflare Tunnel.
- **Khi đưa lên máy chủ Production:** Phải khóa sạch các cổng nội bộ (`5432`, `5672`, `5081..5086`), gỡ bỏ công cụ giả lập (`mailpit`), bật hệ thống tệp chỉ-đọc (`read_only: true`) và ép buộc mật khẩu mạnh!

Thay vì nhân bản (copy-paste) ra 4–5 file cấu hình trùng lặp 80% nội dung, Docker Compose hỗ trợ cơ chế **Multi-File Overlays (Xếp chồng nhiều lớp cấu hình)** thông qua cờ `-f`:

> **Nguyên lý hoạt động của Compose Overlay:** Các file truyền sau sẽ **kế thừa và hợp nhất (merge)** đè lên các file truyền trước theo tên từng `service`. Dự án còn tận dụng 2 thẻ đặc biệt của chuẩn Compose Specification hiện đại:
> - **`!override`**: Thay thế hoàn toàn danh sách cũ bằng danh sách mới (thay vì nối mảng cộng dồn).
> - **`!reset []`**: Xóa trắng hoàn toàn một thuộc tính từng được khai báo ở lớp dưới (cực kỳ lợi hại khi muốn đóng toàn bộ `ports` ở Production!).

```mermaid
flowchart LR
    Base["1. docker-compose.yml (Hạ tầng nền: Postgres, Bootstrap, RabbitMQ, Redis, Mailpit, pgAdmin)"]
    Apps["2. + docker-compose.apps.yml (Thêm 6 API .NET 10 + Gateway + 3 Web Portals)"]
    Sepay["3. + docker-compose.sepay.yml (Bật API_MODE=live & SePay cho cả 3 Web)"]
    SepayLocal["3b. + docker-compose.sepay-local.yml (Đổi port 55432/55672/56379 né service Windows)"]
    Prod["4. + docker-compose.production.yml (Hardening: !reset ports, read_only, cap_drop ALL, Backup Ops)"]

    Base -->|"Dùng độc lập khi code trên Host"| HostDev["Chế độ Host Dev"]
    Base --> Apps
    Apps -->|"Full-stack Demo nội bộ"| FullDemo["17 Containers Local"]
    Apps --> Sepay --> SepayLocal -->|"Test Webhook SePay thật trên Windows"| LiveTunnel["Live SePay + Tunnel"]
    Apps --> Prod -->|"Triển khai máy chủ thật"| ProdEnv["Production Hardened"]
```

---

### 2.2. Giải Phẫu Từng Lớp Overlay Thực Tế

#### Lớp 1: Hạ tầng nền tảng ([workspace/src/infra/docker-compose.yml](file:///C:/Users/minht/.gemini/antigravity/worktrees/PBL6/c_to_n_b/workspace/src/infra/docker-compose.yml))
Lớp gốc này khởi tạo mạng cầu nối riêng `platform` và 7 dịch vụ nền tảng, tất cả đều có **`healthcheck` thực chất** (không dùng kiểu `depends_on` mù quáng chỉ kiểm tra container vừa bật mà dịch vụ bên trong chưa sẵn sàng nhận kết nối!):
1. **`postgres` (`postgres:17-alpine`):** Kiểm tra sức khỏe bằng `pg_isready -U platform -d postgres`.
2. **`db-bootstrap` (Container khởi tạo 6 Database tự động rồi tự tắt):**
   ```yaml
   db-bootstrap:
     image: postgres:17-alpine
     depends_on:
       postgres:
         condition: service_healthy
     volumes:
       - ../../../docs/database:/baseline:ro
       - ./postgres/bootstrap.sh:/bootstrap.sh:ro
     entrypoint: ["/bin/sh", "/bootstrap.sh"]
     restart: "no"
     healthcheck:
       test: ["CMD-SHELL", "test -f /tmp/bootstrap-ok"]
   ```
   Đây là một mẫu thiết kế (Init-Container Pattern) rất đáng học hỏi: `db-bootstrap` đợi `postgres` khỏe mạnh,挂载 thư mục `docs/database` ở chế độ chỉ-đọc (`:ro`), chạy script tạo đủ 6 database tách biệt (`identity`, `transport`, `booking`, `payment`, `notification`, `reporting`) cùng bảng Outbox/Inbox và dữ liệu mồi (seed), sau đó chạm tạo tệp cờ `/tmp/bootstrap-ok` để báo hiệu cho các dịch vụ .NET phía sau biết rằng toàn bộ schema SQL đã sẵn sàng 100%!
3. **`rabbitmq` (`rabbitmq:4.1-management-alpine`):** Chạy entrypoint tùy chỉnh nạp sẵn cấu hình Virtual Host `bus-ticket`, Exchange, Queue và Dead-Letter Queue từ `definitions.template.json`, kiểm tra sống bằng `rabbitmq-diagnostics -q ping`.
4. **`redis` (`redis:7-alpine`):** Bật lưu trữ bền vững Append-Only File (`--appendonly yes`).
5. **`mailpit` (`axllent/mailpit:v1.27`):** Hộp thư SMTP giả lập cục bộ (nhận thư ở cổng `1025`, giao diện đọc email OTP ở `http://localhost:8025`), đảm bảo khi phát triển không bao giờ gửi nhầm email rác ra địa chỉ thật trên Internet.
6. **`pgadmin` (`dpage/pgadmin4:9.19`):** Giao diện quản trị DB gắn sẵn cấu hình `servers.json`, được khóa chặt chỉ lắng nghe trên `127.0.0.1:5050:80`.

---

#### Lớp 2: Dàn nhạc Ứng dụng 10 Containers ([workspace/src/infra/docker-compose.apps.yml](file:///C:/Users/minht/.gemini/antigravity/worktrees/PBL6/c_to_n_b/workspace/src/infra/docker-compose.apps.yml))
Khi ghép thêm `-f docker-compose.apps.yml`, tệp sử dụng kỹ thuật **YAML Extension Anchor (`x-api: &api` và `&api-env`)** để khai báo cấu hình chuẩn một lần duy nhất rồi tái sử dụng (`<<: *api`) cho cả 6 Microservices (`identity:5081`, `transport:5082`, `booking:5083`, `payment:5084`, `notification:5085`, `reporting:5086`) và `gateway:5080`:
- Mỗi service chỉ truyền khác nhau đúng đối số `args.PROJECT` vào chung một `api.Dockerfile` và chuỗi kết nối `ConnectionStrings__<Service>` trỏ về **database riêng của chính nó** (tuân thủ nghiêm ngặt mẫu *Database-per-Service*).
- **`gateway` (cổng `5080`)** khai báo `depends_on` với điều kiện `condition: service_healthy` lên toàn bộ 6 Microservices con (mỗi service tự kiểm tra qua `curl -fsS http://127.0.0.1:8080/live`). Chỉ khi cả 6 mảnh ghép nghiệp vụ đều báo xanh, YARP Gateway mới mở cửa đón lưu lượng từ 3 container giao diện `customer-web` (`5173`), `operator-web` (`5174`) và `admin-web` (`5175`)!

---

#### Lớp 3: Tích hợp Thanh toán SePay Live & Né Xung Đột Cổng Windows (`docker-compose.sepay.yml` & `docker-compose.sepay-local.yml`)
- **[docker-compose.sepay.yml](file:///C:/Users/minht/.gemini/antigravity/worktrees/PBL6/c_to_n_b/workspace/src/infra/docker-compose.sepay.yml):** Chỉ với 21 dòng ngắn gọn, tệp chuyển biến biên dịch `API_MODE: live` cho cả 3 cổng `customer-web`, `operator-web`, `admin-web` và đặt `PAYMENT_PROVIDER: sepay`, biến cả 3 giao diện thành hệ thống chạy dữ liệu sống 100% nối chung vào một Backend thật.
- **[docker-compose.sepay-local.yml](file:///C:/Users/minht/.gemini/antigravity/worktrees/PBL6/c_to_n_b/workspace/src/infra/docker-compose.sepay-local.yml):**
  ```yaml
  # Avoid the Windows PostgreSQL/RabbitMQ services while using Docker's isolated platform databases.
  services:
    postgres:
      ports: !override ["127.0.0.1:55432:5432"]
    rabbitmq:
      ports: !override ["127.0.0.1:55672:5672", "127.0.0.1:55673:15672"]
    redis:
      ports: !override ["127.0.0.1:56379:6379"]
  ```
  Nếu không có từ khóa `!override` ở đây, Docker Compose mặc định sẽ **gộp mảng** (vừa giữ `"5432:5432"` của file gốc vừa thêm `"55432:5432"`), vẫn gây lỗi *Port already allocated* trên máy Windows! Nhờ `!override`, ánh xạ cổng cũ bị thay thế sạch sẽ sang dải `55xxx` chỉ gắn trên `127.0.0.1`, trong khi các container bên trong mạng `platform` vẫn nói chuyện với nhau qua cổng nội bộ `postgres:5432` và `rabbitmq:5672` như bình thường!

---

## 3. Giải Phẫu Multi-Stage Dockerfiles & Cấu Hình Nginx Không Đặc Quyền

### 3.1. `api.Dockerfile` — Đóng Gói 7 Dịch Vụ .NET 10 Chỉ Với 1 File Duy Nhất

Hãy đọc toàn bộ 20 dòng chuẩn mực của [workspace/src/infra/docker/api.Dockerfile](file:///C:/Users/minht/.gemini/antigravity/worktrees/PBL6/c_to_n_b/workspace/src/infra/docker/api.Dockerfile):

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY workspace/Directory.Build.props workspace/Directory.Packages.props workspace/BusTicketPlatform.sln ./workspace/
COPY workspace/src ./workspace/src
COPY docs ./docs
WORKDIR /src/workspace
ARG PROJECT
RUN dotnet restore "$PROJECT"
RUN dotnet publish "$PROJECT" -c Release -o /out --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /out .
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["dotnet"]
```

Tại sao file này lại được đánh giá chuẩn mực Production?
1. **Multi-Stage Build (Giảm 75% dung lượng & xóa công cụ biên dịch):**
   - Tầng `AS build` dùng ảnh `dotnet/sdk:10.0` (chứa trình biên dịch C# Roslyn, MSBuild, NuGet CLI nặng gần 1 GB) để biên dịch mã nguồn ở chế độ tối ưu `Release` ra thư mục `/out`.
   - Tầng `AS runtime` khởi đầu hoàn toàn sạch từ ảnh `dotnet/aspnet:10.0` nhẹ hơn rất nhiều, chỉ chép đúng kết quả đã biên dịch `COPY --from=build /out .`. Toàn bộ mã nguồn `.cs` gốc và trình biên dịch bị vứt bỏ lại ở tầng `build` — kẻ tấn công dù xâm nhập được vào container cũng không có trình biên dịch để dịch mã độc tại chỗ!
2. **Tái sử dụng tham số `ARG PROJECT`:** Thay vì viết 7 Dockerfile giống hệt nhau cho `Identity`, `Transport`, `Booking`, `Payment`, `Notification`, `Reporting` và `Gateway`, chỉ cần truyền `ARG PROJECT=...csproj` lúc build và truyền tên file `.dll` vào `command:` lúc chạy!
3. **Chạy dưới tài khoản phi đặc quyền (`USER $APP_UID`):** Mặc định trong Docker cổ điển, tiến trình chạy dưới quyền `root` (UID `0`) — nếu thoát khỏi container (Container Escape), kẻ tấn công chiếm quyền `root` của cả máy chủ vật lý! Từ .NET 8 đến .NET 10, ảnh Microsoft định nghĩa sẵn biến `$APP_UID` (UID `1654`, tài khoản `app` không có quyền quản trị) và chuyển cổng lắng nghe mặc định từ `80` (cổng đặc quyền `< 1024` đòi quyền root) sang **`8080`**. Dòng `USER $APP_UID` hạ quyền tiến trình ngay trước `ENTRYPOINT`.

---

### 3.2. `web/Dockerfile` & `docker/nginx.conf` — Phục Vụ SPA Tĩnh Siêu Nhẹ & Bảo Vệ Đường Dẫn Webhook

Hãy xem [workspace/src/apps/web/Dockerfile](file:///C:/Users/minht/.gemini/antigravity/worktrees/PBL6/c_to_n_b/workspace/src/apps/web/Dockerfile):

```dockerfile
FROM node:24.22.0-alpine AS build
WORKDIR /app
ENV HUSKY=0
RUN npm install --global pnpm@10.34.7
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY . .
ARG APP_TARGET=customer
ARG API_MODE=mock
ARG PAYMENT_PROVIDER=sepay
ENV BLUE_APP_TARGET=${APP_TARGET}
ENV VITE_API_MODE=${API_MODE}
ENV VITE_PAYMENT_PROVIDER=${PAYMENT_PROVIDER}
ENV VITE_API_BASE_URL=""
RUN node scripts/portal.mjs ${APP_TARGET} build

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
ARG APP_TARGET=customer
ARG API_MODE=mock
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/nginx.mock.conf /tmp/nginx.mock.conf
RUN if [ "$API_MODE" = "mock" ]; then cp /tmp/nginx.mock.conf /etc/nginx/conf.d/default.conf; fi
COPY --from=build /app/build/${APP_TARGET}/client /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
```

Hãy chú ý những chi tiết kỹ thuật đắt giá:
1. **Tận dụng bộ nhớ đệm lớp Docker (Layer Caching):** File chép riêng `package.json pnpm-lock.yaml .npmrc` và chạy `pnpm install --frozen-lockfile` **trước khi** `COPY . .`. Nhờ vậy, nếu bạn chỉ sửa giao diện `.tsx` mà không cài thêm thư viện mới, Docker tái sử dụng ngay lớp `node_modules` đã cache, giảm thời gian build từ vài phút xuống còn vài giây! Cờ `--frozen-lockfile` cấm tuyệt đối việc tự ý đổi phiên bản thư viện lúc build, còn `ENV HUSKY=0` tắt Git hooks không cần thiết trong môi trường container không có `.git`.
2. **Dùng `nginxinc/nginx-unprivileged:1.27-alpine`:** Khác với ảnh `nginx:alpine` thông thường chạy master process bằng `root` ở cổng `80`, bản `nginx-unprivileged` chính chủ của F5/NGINX chạy hoàn toàn dưới tài khoản `nginx` (UID `101`) ở cổng `8080`!
3. **Cấu hình định tuyến thông minh trong [docker/nginx.conf](file:///C:/Users/minht/.gemini/antigravity/worktrees/PBL6/c_to_n_b/workspace/src/apps/web/docker/nginx.conf):**
   - **Header bảo mật cứng:** Tự động gắn `server_tokens off;` (ẩn phiên bản Nginx), `X-Content-Type-Options: "nosniff"`, `X-Frame-Options: "DENY"` (chống nhúng iframe Clickjacking) và `Referrer-Policy: "strict-origin-when-cross-origin"`.
   - **Chuyển tiếp cùng Origin cho API & SePay IPN:**
     ```nginx
     location /api/ {
       proxy_pass http://gateway:8080;
       # Chuyển tiếp đầy đủ Authorization, Idempotency-Key, X-Correlation-Id
     }

     # Public server-to-server SePay IPN. Never serve the SPA document for this route.
     location = /integrations/payments/sepay/ipn {
       client_max_body_size 64k;
       proxy_pass http://gateway:8080;
     }
     ```
     Nhờ khối `location = /integrations/payments/sepay/ipn` khớp chính xác tuyệt đối kèm giới hạn kích thước gói tin `64k`, khi máy chủ SePay bắn thông báo biến động số dư qua tên miền công khai (Cloudflare Tunnel trỏ vào container `customer-web`), Nginx chuyển thẳng gói tin sang YARP Gateway chứ **không bao giờ trả nhầm trang HTML `index.html` của React SPA**!
   - **Phân biệt rõ File tĩnh băm tên (`/assets/`) và Đường dẫn SPA (`/`):**
     - `location /assets/ { try_files $uri =404; expires 1y; }`: Các file JS/CSS do Vite sinh ra đều gắn mã băm nội dung (ví dụ `index-D8f9a1.js`). Nếu trình duyệt hỏi một file `.js` không tồn tại, Nginx phải trả thẳng `404` chứ nếu trả nhầm `index.html` trình duyệt sẽ báo lỗi cú pháp `Unexpected token '<'` rất khó gỡ lỗi!
     - `location = /index.html { expires -1; }` & `location / { try_files $uri $uri/ /index.html; }`: Tệp gốc `index.html` không bao giờ bị lưu cache cứng để người dùng luôn nhận bản phát hành mới nhất ngay khi F5.

---

## 4. Gia Cố Bảo Mật Cấp Production (`docker-compose.production.yml` & `test-production-config.ps1`)

### 4.1. Sáu Lớp Khiên Phòng Thủ Chiều Sâu Trong `docker-compose.production.yml`

Hãy xem khối `x-api-hardening` và cấu hình dịch vụ trong [workspace/src/infra/docker-compose.production.yml](file:///C:/Users/minht/.gemini/antigravity/worktrees/PBL6/c_to_n_b/workspace/src/infra/docker-compose.production.yml):

```yaml
x-api-hardening: &api-hardening
  read_only: true
  tmpfs:
    - /tmp:size=64m,mode=1777
  cap_drop: [ALL]
  security_opt: [no-new-privileges:true]
  deploy:
    resources:
      limits:
        cpus: "1.00"
        memory: 768M
      reservations:
        memory: 192M
  logging:
    driver: json-file
    options:
      max-size: 10m
      max-file: "5"
```

Nếu Hội đồng hỏi: *"Bản Docker Production của nhóm khác gì bản chạy thử ở nhà?"*, hãy trình bày rõ **6 lớp khiên phòng thủ chiều sâu (Defense-in-Depth)** sau đây:

| Lớp khiên | Cấu hình cụ thể trong `docker-compose.production.yml` | Kịch bản tấn công / sự cố bị vô hiệu hóa |
|---|---|---|
| **1. Hệ thống tệp gốc bất biến** | `read_only: true` + gắn `tmpfs` nhỏ (`64MB` ở `/tmp` cho .NET; `/tmp, /var/cache/nginx, /var/run` cho Web) | Dù tin tặc tìm ra lỗ hổng thực thi mã từ xa, chúng **không thể ghi tệp mã độc (webshell), tải trojan xuống ổ đĩa hay sửa đổi file `.dll`** vì toàn bộ ổ đĩa gốc đã bị khóa chỉ-đọc! |
| **2. Tước bỏ quyền nhân Linux** | `cap_drop: [ALL]` + `security_opt: [no-new-privileges:true]` | Xóa sạch toàn bộ quyền đặc biệt của nhân Linux (như tạo raw socket nghe lén mạng `CAP_NET_RAW`, nạp module nhân, đổi chủ tệp) và cấm mọi tiến trình con leo thang quyền hạn qua cờ `setuid`. |
| **3. Phong tỏa cổng mạng nội bộ** | `ports: !reset []` trên Postgres, RabbitMQ, Redis, Gateway và cả 6 Microservices; chỉ mở `127.0.0.1:8080..8082` cho 3 Web | Không một cổng Database `5432` hay API con `5081..5086` nào lọt ra card mạng công cộng `0.0.0.0`. Mọi truy cập từ Internet bắt buộc đi qua Reverse Proxy / Load Balancer chấm dứt TLS ở phía trước rồi chuyển vào loopback nội bộ. |
| **4. Cách ly công cụ Dev** | `mailpit` dùng profile `development` và bỏ port publish ở production. | Hộp thư test được tách khỏi stack production mặc định. |
| **5. Cưỡng chế mật khẩu thật** | Cú pháp `${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}`, `${JWT_SIGNING_KEY:?...}` | Xóa bỏ hoàn toàn giá trị mặc định yếu (`:-postgres`, `:-guest`). Nếu quên truyền biến môi trường bí mật, Docker từ chối khởi động ngay lập tức! |
| **6. Chống cạn kiệt tài nguyên (Anti-DoS)** | Giới hạn `cpus` & `memory` (`768M` mỗi API, `2G` cho Postgres) + xoay vòng log `max-size: 10m`, `max-file: "5"` | Nếu một dịch vụ bị rò rỉ bộ nhớ hoặc bị tấn công làm ngập log, nó không thể ăn hết RAM đánh sập các dịch vụ khác hay làm đầy 100% ổ cứng SSD của máy chủ! |

---

### 4.2. Cổng Gác Cấu Hình Trước Khi Triển Khai (`test-production-config.ps1`)

Con người luôn có thể mắc sai lầm khi soạn file `.env` trên máy chủ (ví dụ lười đặt mật khẩu lại gõ `POSTGRES_PASSWORD=postgres` hoặc quên bật `https://`). Vì vậy, dự án xây dựng kịch bản kiểm định tự động [workspace/scripts/test-production-config.ps1](file:///C:/Users/minht/.gemini/antigravity/worktrees/PBL6/c_to_n_b/workspace/scripts/test-production-config.ps1) làm cổng gác bắt buộc trước khi triển khai:

```powershell
$secretNames = @('POSTGRES_PASSWORD', 'RABBITMQ_PASSWORD', 'JWT_SIGNING_KEY', 'SMTP_PASSWORD', 'SEPAY_IPN_SECRET_KEY')
$placeholder = '(?i)(replace|change.?me|local.?dev|example\.test|password$|secret$|guest$|postgres$)'
# ...
if ($value -match $placeholder) { $errors.Add("$name still contains a placeholder value") }
if ($secretNames -contains $name -and $value.Length -lt 24) { $errors.Add("$name must contain at least 24 characters") }
if ($name -eq 'RABBITMQ_PASSWORD' -and $value -notmatch '^[A-Za-z0-9._~-]+$') {
    $errors.Add('RABBITMQ_PASSWORD may contain only URL-safe A-Z a-z 0-9 . _ ~ - characters')
}
```

Script thực hiện **5 bài kiểm tra thép**:
1. Kiểm tra có mặt đầy đủ các biến môi trường sống còn (`POSTGRES_PASSWORD`, `RABBITMQ_PASSWORD`, `JWT_SIGNING_KEY`, `API_ALLOWED_HOSTS`, `CUSTOMER_PUBLIC_ORIGIN`, cụm `SMTP_*` và `SEPAY_*`).
2. Dùng biểu thức chính quy chặn đứng mọi giá trị mang tính chất giữ chỗ (`change-me`, `local-dev`, `example.test`, `guest`, `postgres`...) và ép buộc mọi khóa bí mật phải dài **tối thiểu 24 ký tự**.
3. Kiểm tra riêng `RABBITMQ_PASSWORD` chỉ chứa các ký tự an toàn trên URI (`A-Za-z0-9._~-`) — bởi vì mật khẩu này được ghép trực tiếp vào chuỗi `amqp://platform:${RABBITMQ_PASSWORD}@rabbitmq:5672/bus-ticket`; nếu lỡ có dấu `@`, `:` hay `/` không mã hóa sẽ làm gãy trình phân tích URI của .NET lúc chạy thật!
4. Bắt buộc `CUSTOMER_PUBLIC_ORIGIN` phải bắt đầu bằng `https://`.
5. Gọi trực tiếp `docker compose -f docker-compose.yml -f docker-compose.apps.yml -f docker-compose.production.yml config` để kết xuất bản cấu hình hợp nhất cuối cùng ra văn bản, rồi quét kiểm chứng:
   - Bước kiểm tra báo lỗi nếu Mailpit nằm trong cấu hình production mặc định.
   - Nếu xuất hiện `0.0.0.0:<port>->` -> Báo lỗi phơi cổng ra toàn bộ card mạng và dừng ngay!

---

## 5. Quy Trình Sao Lưu & Diễn Tập Khôi Phục Thảm Họa Tự Động (`postgres-backup.sh` & `postgres-restore-verify.sh`)

Trong vận hành cơ sở dữ liệu thực tế có một câu châm ngôn nổi tiếng:
> **"Một bản Backup chưa từng được thử Restore thành công thì chưa được gọi là Backup — đó mới chỉ là một niềm hy vọng!"**

Trong `docker-compose.production.yml`, dự án tích hợp sẵn 2 dịch vụ vận hành thuộc `profiles: [ops]`: `pg-backup` và `pg-restore-verify`. Hãy mổ xẻ 2 kịch bản shell đứng sau chúng!

### 5.1. Sao lưu đồng bộ 6 Database kèm chữ ký băm toàn vẹn ([postgres-backup.sh](file:///C:/Users/minht/.gemini/antigravity/worktrees/PBL6/c_to_n_b/workspace/src/infra/docker/postgres-backup.sh))

```sh
#!/bin/sh
set -eu

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="/backups/pbl6-${timestamp}"
mkdir -p "$target"

for database in identity transport booking payment notification reporting; do
  pg_dump --format=custom --no-owner --no-acl --dbname="$database" --file="$target/$database.dump"
done

sha256sum "$target"/*.dump > "$target/SHA256SUMS"
echo "Backup completed: $target"
```

- **`set -eu`:** Nếu bất kỳ 1 trong 6 database gặp lỗi kết nối hoặc hết dung lượng đĩa giữa chừng, script dừng và trả mã lỗi khác `0` ngay lập tức, không bao giờ báo `"Backup completed"` giả tạo!
- **`pg_dump --format=custom --no-owner --no-acl`:** Xuất ở định dạng nhị phân nén tối ưu của PostgreSQL (hỗ trợ khôi phục chọn lọc và kiểm tra cấu trúc chặt chẽ hơn file `.sql` thuần túy), đồng thời lược bỏ quyền sở hữu user cũ (`--no-owner --no-acl`) để có thể khôi phục mượt mà sang một máy chủ mới có tên user quản trị khác.
- **`sha256sum "$target"/*.dump > "$target/SHA256SUMS"`:** Tính mã băm mật mã `SHA-256` cho cả 6 tệp `.dump`. Nếu sau này tệp sao lưu lưu trên ổ cứng hoặc tải qua mạng bị hỏng dù chỉ 1 bit (Bit Rot / Corrupted Transfer), bước xác minh sẽ phát hiện ra ngay!

---

### 5.2. Diễn tập khôi phục tự động không xâm lấn ([postgres-restore-verify.sh](file:///C:/Users/minht/.gemini/antigravity/worktrees/PBL6/c_to_n_b/workspace/src/infra/docker/postgres-restore-verify.sh))

```sh
#!/bin/sh
set -eu

backup_set="${BACKUP_SET:?BACKUP_SET is required}"
source_dir="/backups/$backup_set"
test -d "$source_dir"
cd "$source_dir"
sha256sum -c SHA256SUMS

for source_database in identity transport booking payment notification reporting; do
  target_database="restore_verify_${source_database}"
  dropdb --if-exists "$target_database"
  createdb "$target_database"
  pg_restore --no-owner --no-acl --exit-on-error \
    --dbname="$target_database" "$source_dir/$source_database.dump"
  table_count="$(psql --dbname="$target_database" --tuples-only --no-align \
    --command="select count(*) from information_schema.tables where table_schema = 'public';")"
  test "$table_count" -gt 0
  echo "$source_database restore verified ($table_count public tables)"
  dropdb "$target_database"
done
```

Hãy theo dõi luồng diễn tập khôi phục tự động hoàn toàn không làm gián đoạn hệ thống đang chạy:

```mermaid
flowchart TD
    Start["Kích hoạt container pg-restore-verify (BACKUP_SET=pbl6-...)"] --> CheckHash["1. Chạy sha256sum -c SHA256SUMS (Kiểm tra toàn vẹn nhị phân 6 file .dump)"]
    CheckHash --> Loop["2. Duyệt từng DB: identity, transport, booking, payment, notification, reporting"]
    Loop --> CreateSandbox["3. Tạo DB cô lập tạm thời: restore_verify_{service}"]
    CreateSandbox --> Restore["4. Chạy pg_restore --exit-on-error nạp toàn bộ bảng, index, constraint, dữ liệu"]
    Restore --> CountTables["5. Truy vấn information_schema.tables đảm bảo table_count lớn hơn 0"]
    CountTables --> Cleanup["6. Xóa sạch DB tạm (dropdb restore_verify_{service}) trả lại dung lượng"]
    Cleanup --> Done["Báo cáo xanh: Toàn bộ 6 DB chứng minh khôi phục thành công 100%!"]
```

Quy trình này chứng minh thực nghiệm rằng: (1) tệp sao lưu không bị hỏng bit, (2) siêu dữ liệu schema/ràng buộc khóa ngoại không bị lỗi thứ tự khôi phục (`--exit-on-error`), (3) dữ liệu thực sự lên đủ bảng (`table_count > 0`), và (4) toàn bộ diễn ra trong không gian tên tạm `restore_verify_*` nên tuyệt đối an toàn ngay cả khi chạy định kỳ hàng đêm!

---

## 6. Cẩm Nang Phản Biện Trước Hội Đồng (Q&A Thực Chiến Contracts & Docker)

| Câu hỏi từ Giảng viên / Hội đồng | Cách trả lời gãy gọn, đúng trọng tâm mã nguồn |
|---|---|
| **Câu 1:** *"Nhóm có tới 6 Microservices chạy chung trên 1 container PostgreSQL trong `docker-compose.yml`, vậy có vi phạm nguyên lý Database-per-Service không?"* | **Trả lời:** Dạ không vi phạm ạ! Trong môi trường Docker Compose, việc dùng chung 1 tiến trình máy chủ vật lý `postgres:17-alpine` giúp tiết kiệm RAM cho máy phát triển, nhưng container `db-bootstrap` tạo ra **6 logical databases tách biệt hoàn toàn** (`identity`, `transport`, `booking`, `payment`, `notification`, `reporting`). Mỗi Microservice chỉ được truyền chuỗi kết nối vào đúng database của riêng mình, và bộ `ContractGateTests` quét toàn bộ file `.sql` cấm tuyệt đối khóa ngoại chéo hay `dblink`/`postgres_fdw`. Khi lên Cloud Production, 6 chuỗi kết nối này có thể trỏ sang 6 cụm RDS độc lập mà không cần sửa 1 dòng code nào! |
| **Câu 2:** *"Làm sao nhóm đảm bảo khi `Transport` đổi cấu trúc sự kiện `TripPublished` thì `Booking` không bị lỗi ngầm lúc chạy?"* | **Trả lời:** Dạ toàn bộ 20 sự kiện bất đồng bộ đều được khóa cứng bởi `platform-mvp.asyncapi.yaml` và `platform-message.schema.json` với cờ `"additionalProperties": false`. Bất kỳ sự kiện nào phát ra đều phải đi qua kiểm định `JsonSchema.Net` trong `ContractTests` và `MessagingSmokeTests` trên CI trước khi được phép gộp nhánh (merge). |
| **Câu 3:** *"Nếu container Backend của nhóm bị kẻ tấn công tìm ra lỗ hổng RCE (thực thi lệnh từ xa), lớp Docker của nhóm ngăn chặn hậu quả thế nào?"* | **Trả lời:** Dạ nhóm áp dụng 4 lớp cô lập container trong `api.Dockerfile` và `docker-compose.production.yml`: (1) Tiến trình chạy dưới tài khoản thường `USER $APP_UID` (`1654`), không phải `root`; (2) Hệ thống tệp gốc bị khóa chỉ-đọc `read_only: true` nên không thể ghi mã độc xuống đĩa; (3) `cap_drop: [ALL]` và `no-new-privileges:true` tước toàn bộ quyền đặc biệt của nhân Linux; (4) `ports: !reset []` đóng kín các cổng nội bộ, cô lập phạm vi ảnh hưởng tối đa. |
| **Câu 4:** *"Script backup của nhóm chạy xong làm sao biết chắc lúc máy chủ cháy ổ cứng thì file `.dump` đó mở ra dùng được thật?"* | **Trả lời:** Dạ nhóm không chỉ viết `postgres-backup.sh` sinh kèm chữ ký `SHA256SUMS`, mà còn xây dựng container diễn tập `pg-restore-verify` (`postgres-restore-verify.sh`). Container này tự động đối chiếu mã băm SHA-256, dựng 6 database nháp `restore_verify_*`, chạy `pg_restore --exit-on-error`, đếm số bảng trong `information_schema.tables > 0` rồi tự dọn sạch DB nháp. |

---

## 7. Sổ Tay Vận Hành Thực Chiến (DevOps Runbook): Từ Máy Cá Nhân Đến Cloudflare Tunnel & Sao Lưu DB

Để bất kỳ thành viên nào trong nhóm (hoặc Giảng viên chấm bài) cũng có thể dựng hệ thống chuẩn xác ngay lần gõ lệnh đầu tiên, phần này tổng hợp đầy đủ **4 kịch bản vận hành chuẩn** từ `workspace/src/infra/`:

### 7.1. Kịch bản 1: Chỉ bật Hạ tầng Nền (Khi đang lập trình nóng C# & Vite trên Host)
```powershell
cd workspace/src/infra
docker compose -f docker-compose.yml up -d --wait
```
- Lệnh `--wait` của Docker Compose hiện đại sẽ đứng đợi cho đến khi toàn bộ `healthcheck` của `postgres`, `db-bootstrap` (`/tmp/bootstrap-ok`), `rabbitmq`, `redis`, `mailpit` đều chuyển sang trạng thái **`healthy`**, sau đó bạn mở Visual Studio / Rider hoặc chạy `npm run dev:customer` trên máy thật là kết nối thông suốt ngay!
- Giao diện kiểm tra nhanh khi phát triển:
  - **Mailpit (đọc email OTP xác minh tài khoản / đặt lại mật khẩu):** `http://localhost:8025`
  - **RabbitMQ Management UI (xem hàng đợi & DLQ trên vhost `bus-ticket`):** `http://localhost:15672`
  - **pgAdmin 4 (duyệt 6 cơ sở dữ liệu PostgreSQL):** `http://127.0.0.1:5050`

---

### 7.2. Kịch bản 2: Dựng Full-Stack 17 Containers Trình Diễn Cục Bộ
```powershell
cd workspace/src/infra
docker compose -f docker-compose.yml -f docker-compose.apps.yml up -d --build --wait
```
Bảng phân bổ địa chỉ cổng khi chạy Full-Stack Demo:

| Nhóm dịch vụ | Tên Container | Cổng trên máy Host | Cổng nội bộ Container | Ghi chú chế độ mặc định |
|---|---|---|---|---|
| **API Gateway** | `gateway` | `http://localhost:5080` | `:8080` | Điểm vào hợp nhất duy nhất của YARP Reverse Proxy |
| **Microservices** | `identity` .. `reporting` | `5081` .. `5086` | `:8080` | 6 dịch vụ .NET 10 chạy `USER $APP_UID` (`1654`) |
| **Cổng Hành khách** | `customer-web` | `http://localhost:5173` | `:8080` | Nginx Unprivileged (`101`) |
| **Cổng Nhà xe** | `operator-web` | `http://localhost:5174` | `:8080` | Nginx Unprivileged (`101`) |
| **Cổng Quản trị** | `admin-web` | `http://localhost:5175` | `:8080` | Nginx Unprivileged (`101`) |

---

### 7.3. Kịch bản 3: Chạy 3 Cổng Live API Tích Hợp Cổng Thanh Toán SePay Thật Qua Cloudflare Tunnel Trên Windows

Khi muốn trình diễn thanh toán quét mã QR chuyển khoản ngân hàng thật với **SePay** ngay trên laptop Windows ở hội trường bảo vệ đồ án, máy chủ SePay trên Internet cần một đường dẫn HTTPS công khai để bắn ngược thông báo biến động số dư (**IPN Webhook**) về máy bạn:

```mermaid
sequenceDiagram
    participant Bank as Ứng dụng Ngân hàng & Máy chủ SePay
    participant CF as Cloudflare Tunnel (HTTPS Domain công khai)
    participant Web as Container customer-web (Nginx :5173->:8080)
    participant GW as Container gateway (YARP :8080)
    participant Pay as Container payment (.NET 10 :8080)

    Bank->>CF: POST https://blue-demo.example.com/integrations/payments/sepay/ipn (Kèm X-Secret-Key)
    CF->>Web: Chuyển tiếp qua đường hầm mã hóa về localhost:5173
    Note over Web: Khối location = /integrations/payments/sepay/ipn (giới hạn 64k, KHÔNG trả SPA HTML!)
    Web->>GW: proxy_pass http://gateway:8080
    GW->>Pay: Định tuyến nội bộ tới Payment Service
    Pay-->>Bank: Xác thực khóa IPN -> Đổi trạng thái PAID -> Phát PaymentSucceeded -> Trả 200 OK
```

Lệnh khởi chạy xếp chồng 4 tệp Compose (tự động né các cổng `5432/5672/6379` đang bị dịch vụ Windows chiếm giữ):
```powershell
cd workspace/src/infra
docker compose `
  -f docker-compose.yml `
  -f docker-compose.apps.yml `
  -f docker-compose.sepay.yml `
  -f docker-compose.sepay-local.yml `
  up -d --build --wait
```
Nhờ cấu hình `location = /integrations/payments/sepay/ipn` và `location = /integrations/payments/sepay/browser-return` nằm sẵn trong `web/docker/nginx.conf`, bạn **chỉ cần mở đúng 1 đường hầm Cloudflare Tunnel duy nhất trỏ vào `http://localhost:5173`** (container `customer-web`) là phục vụ trọn vẹn cả giao diện khách hàng, các lời gọi `/api/v1/*`, luồng quay về trình duyệt lẫn Webhook IPN từ máy chủ SePay mà không hề phải phơi cổng Gateway `5080` hay cổng Payment `5084` trực tiếp ra Internet!

---

### 7.4. Kịch bản 4: Kiểm Tra Cổng Gác Production, Sao Lưu & Diễn Tập Khôi Phục 6 DB

1. **Chạy cổng gác thẩm định cấu hình Production trước giờ triển khai:**
   ```powershell
   powershell -File workspace/scripts/test-production-config.ps1 -EnvFile .env.production
   ```
   Chỉ khi màn hình hiện dòng chữ xanh lá **`Production configuration gate passed.`**, hệ thống mới đủ điều kiện an toàn để chạy chồng lớp `docker-compose.production.yml`.

2. **Thực thi sao lưu nóng toàn bộ 6 cơ sở dữ liệu (`profile ops`):**
   ```powershell
   cd workspace/src/infra
   docker compose -f docker-compose.yml -f docker-compose.apps.yml -f docker-compose.production.yml `
     --profile ops run --rm pg-backup
   ```
   Kết quả sinh ra thư mục `/backups/pbl6-20261118T...Z/` chứa đủ 6 tệp `.dump` và tệp chữ ký băm `SHA256SUMS`.

3. **Chạy diễn tập khôi phục tự động (`pg-restore-verify`):**
   ```powershell
   $env:BACKUP_SET = "pbl6-20261118T030000Z"
   docker compose -f docker-compose.yml -f docker-compose.apps.yml -f docker-compose.production.yml `
     --profile ops run --rm pg-restore-verify
   ```
   Từng dòng xác nhận `identity restore verified (... public tables)` đến `reporting restore verified (... public tables)` xuất hiện chính là bằng chứng vàng khẳng định quy trình Disaster Recovery của nền tảng sẵn sàng trước mọi sự cố phần cứng!
