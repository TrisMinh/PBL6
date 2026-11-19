# Chương 06 — Bài 01: Lý Thuyết Kiến Trúc Hướng Sự Kiện (Event-Driven) & Giải Phẫu Topology RabbitMQ

> **Mục tiêu bài học**: Hiểu tận gốc từ con số 0 vì sao một hệ thống đặt vé xe khách phân tán (Microservices) sẽ sụp đổ dây chuyền nếu chỉ dùng giao tiếp HTTP đồng bộ nối tiếp nhau; nắm vững từng khái niệm cốt lõi của giao thức **AMQP 0-9-1** trên **RabbitMQ 4.1** thông qua ẩn dụ Bưu Điện Trung Tâm; lý giải quyết định kiến trúc **ADR-004** (tại sao chọn RabbitMQ thay vì Apache Kafka hay Redis Pub/Sub); và giải phẫu từng dòng cấu hình thực tế trong `definitions.json`, `entrypoint.sh`, `EventMessage.cs`, `OutboxRouting.cs` cùng ma trận định tuyến toàn bộ **20 thông điệp tích hợp** của **BLUE Bus Ticket Platform**.

---

## 1. Từ Con Số 0: Tại Sao Giao Tiếp HTTP Đồng Bộ Nối Tiếp Nhau Làm Sập Hệ Thống Đặt Vé?

Hãy hình dung bạn mới bắt đầu tách một hệ thống Monolith bán vé xe khách thành **6 Microservices** độc lập (mỗi service sở hữu một cơ sở dữ liệu PostgreSQL riêng theo **ADR-001** và **ADR-005**):
1. **Identity Service**: Quản lý tài khoản, xác thực và phân quyền.
2. **Transport Service**: Quản lý nhà xe, xe khách, sơ đồ ghế, tuyến đường và lịch chạy chuyến xe.
3. **Booking Service**: Quản lý tồn kho ghế theo chuyến (`trip_seats`), giữ chỗ tạm thời 10 phút (`seat_holds`), đơn đặt chỗ (`bookings`) và vé điện tử QR (`tickets`).
4. **Payment Service**: Quản lý giao dịch thanh toán (SePay), đối soát webhook/IPN, hoàn tiền (`refunds`) và quyết toán doanh thu (`booking_settlements`).
5. **Notification Service**: Quản lý hộp thư thông báo in-app và gửi email cho hành khách.
6. **Reporting Service**: Dựng các bảng tổng hợp doanh thu (`revenue_projections`) và sản lượng đặt vé (`booking_projections`) cho Dashboard quản trị.

### 1.1. Cạm bẫy đầu tiên của người mới: Chuỗi gọi HTTP nối tiếp (Synchronous HTTP Chain)

Khi hành khách quét mã VietQR chuyển khoản 500.000đ mua 2 vé xe tuyến Đà Nẵng — Sài Gòn, ngân hàng/cổng **SePay** sẽ bắn một bản tin Webhook (IPN) tới **Payment Service**. Để hoàn tất nghiệp vụ, toàn hệ thống cần thực hiện 4 việc ở 4 services khác nhau:
- **Payment Service**: Ghi nhận giao dịch `SUCCEEDED` và tính hoa hồng sàn 10%.
- **Booking Service**: Chuyển đơn từ `PENDING_PAYMENT` sang `PAID` và sinh 2 mã vé điện tử `TK...` kèm QR code.
- **Notification Service**: Gửi thông báo *"Thanh toán thành công, vé của bạn đã sẵn sàng"* tới điện thoại/email khách.
- **Reporting Service**: Cộng thêm 500.000đ vào biểu đồ doanh thu ngày hôm nay của nhà xe.

Nếu lập trình theo tư duy tuần tự quen thuộc, người mới thường viết chuỗi gọi HTTP `HttpClient.PostAsync(...)` nối đuôi nhau như sau:

```mermaid
sequenceDiagram
    autonumber
    participant PSP as Cổng SePay
    participant PAY as Payment Service
    participant BK as Booking Service
    participant NOTI as Notification Service
    participant SMTP as Máy chủ Email SMTP
    participant REP as Reporting Service

    PSP->>PAY: POST /integrations/payments/sepay/ipn
    activate PAY
    PAY->>PAY: Lưu Payment SUCCEEDED vào Payment DB
    PAY->>BK: HTTP POST /internal/bookings/confirm-paid (chờ...)
    activate BK
    BK->>BK: Lưu PAID + sinh Ticket vào Booking DB
    BK->>NOTI: HTTP POST /internal/notifications/send (chờ...)
    activate NOTI
    NOTI->>SMTP: Kết nối SMTP gửi Email vé (bị treo 15 giây!)
    SMTP-->>NOTI: Timeout 504 sau 15 giây!
    NOTI-->>BK: HTTP 500 Internal Server Error
    deactivate NOTI
    BK->>REP: Không bao giờ chạy tới hoặc bị hủy!
    BK-->>PAY: HTTP 500 / Timeout
    deactivate BK
    PAY-->>PSP: HTTP 504 Gateway Timeout!
    deactivate PAY
```

Nhìn vào sơ đồ trên, chỉ một trục trặc rất đời thường — **máy chủ gửi email SMTP bên ngoài phản hồi chậm 15 giây** hoặc **Reporting DB đang chạy câu lệnh thống kê nặng bị khóa bảng** — đã kéo sập toàn bộ luồng thanh toán cốt lõi! Trong kỹ thuật hệ thống phân tán, thiết kế này mắc phải **4 căn bệnh tử huyệt**:

### 1.2. Bốn căn bệnh tử huyệt của chuỗi gọi HTTP đồng bộ

#### Bệnh 1: Phụ thuộc thời gian chặt chẽ (Temporal Coupling)
Giao thức HTTP là giao thức đồng bộ theo thời gian thực: để lời gọi `Payment -> Booking -> Notification -> Reporting` thành công, **cả 4 tiến trình phải đang sống, khỏe mạnh và rảnh rỗi ngay tại cùng một mili-giây**. Nếu `Reporting Service` đang khởi động lại 10 giây để nâng cấp phiên bản mới (Rolling Update), mọi giao dịch thanh toán của khách hàng trên toàn quốc trong 10 giây đó đều gặp lỗi!

#### Bệnh 2: Suy giảm độ sẵn sàng theo cấp số nhân (Availability Multiplication)
Giả sử mỗi microservice được vận hành rất tốt với cam kết độ sẵn sàng (SLA Availability) đạt **99.5%** (tức chỉ ngừng hoạt động khoảng 3.6 giờ mỗi tháng). Khi một giao dịch đi xuyên qua $N = 4$ dịch vụ nối tiếp nhau, xác suất thành công tổng thể không còn là $99.5\%$ nữa mà là tích xác suất của các biến cố độc lập:

$$A_{\text{chain}} = A_{\text{Payment}} \times A_{\text{Booking}} \times A_{\text{Notification}} \times A_{\text{Reporting}} = (0.995)^4 \approx 0.9801 \text{ (chỉ còn } 98.01\% \text{)}$$

Con số $98.01\%$ đồng nghĩa hệ thống bị lỗi giao dịch gần **14.3 giờ mỗi tháng**! Càng tách thêm microservice phụ trợ (ví dụ thêm Loyalty tích điểm, Fraud kiểm tra gian lận, Invoice xuất hóa đơn đỏ), độ tin cậy của luồng thanh toán càng tụt dốc thảm hại.

#### Bệnh 3: Sập dây chuyền do cạn kiệt tài nguyên (Cascading Failure & Thread/Connection Starvation)
Khi cổng SePay bắn IPN sang `Payment Service`, cổng thanh toán chỉ cho phép phản hồi trong vòng vài giây (thường là 3–5 giây). Nếu `Notification` hoặc `Reporting` bị chậm:
- Luồng xử lý (Request/Socket/DB Connection Pool) tại `Booking` và `Payment` phải đứng chờ I/O suốt 15–30 giây.
- Vào giờ cao điểm mở bán vé Tết (hàng trăm khách thanh toán cùng lúc), toàn bộ Connection Pool tới PostgreSQL và Kestrel Worker Queue bị lấp đầy bởi các request đang đứng đợi email/báo cáo.
- Chỉ sau vài chục giây, chính `Payment Service` và `Booking Service` bị nghẽn cổ chai, không thể phục vụ cả các API đọc thông thường -> **Toàn bộ nền tảng tê liệt dây chuyền (Cascading Failure)** vì một dịch vụ phụ trợ không nằm trên đường găng!
- Tệ hơn nữa: khi `Payment Service` trả mã lỗi 504 cho SePay dù `Payment DB` hoặc `Booking DB` đã lỡ commit một nửa, SePay sẽ tưởng giao dịch chưa ghi nhận và bắn lại Webhook nhiều lần, gây nguy cơ xuất trùng vé hoặc lệch sổ cái tiền tệ.

#### Bệnh 4: Vi phạm nguyên lý Đóng/Mở (Tight Architectural Coupling)
Tại sao `Payment Service` (chuyên xử lý tiền) lại phải biết địa chỉ URL, định dạng request và sự tồn tại của `Reporting Service` hay `Notification Service`? Mỗi khi nhóm phát triển muốn thêm một dịch vụ mới nghe sự kiện thanh toán (chẳng hạn `Loyalty Service` cộng điểm thành viên), lập trình viên lại phải mở code của `Payment Service` hoặc `Booking Service` ra sửa, thêm `HttpClient`, thêm cấu hình retry, viết lại unit test và deploy lại dịch vụ lõi.

---

### 1.3. Lời giải Kiến trúc Hướng Sự Kiện (Event-Driven Architecture — EDA)

BLUE Bus Ticket Platform giải quyết triệt để cả 4 căn bệnh trên bằng nguyên tắc phân tách rạch ròi giữa **Đường găng đồng bộ (Synchronous Critical Path — ADR-003)** và **Luồng tích hợp bất đồng bộ qua Message Broker (Asynchronous Integration Flow — ADR-004)**:

1. **Khi nào VẪN dùng HTTP REST đồng bộ (ADR-003)?**
   Khi giao diện Web/Mobile của người dùng cần **câu trả lời tức thời** từ đúng **một chủ sở hữu dữ liệu (Single Authoritative Owner)**:
   - Đăng nhập lấy JWT (`POST /api/v1/auth/login` -> `Identity Service`).
   - Tìm kiếm chuyến xe (`GET /api/v1/trips` -> `Transport Service`).
   - Giữ ghế 10 phút (`POST /api/v1/trips/{tripId}/holds` -> `Booking Service` khóa dòng ghế ngay trong PostgreSQL và trả về ngay `holdToken` hoặc báo ghế đã có người nhanh tay hơn giữ mất).
   - Khởi tạo link thanh toán (`POST /api/v1/bookings/{bookingId}/payments` -> `Payment Service`).

2. **Khi nào BẮT BUỘC dùng Message Broker bất đồng bộ (ADR-004)?**
   Khi một sự thật nghiệp vụ vừa được chốt xong tại Service A và cần **lan tỏa kết quả (Fan-out / Handoff)** sang Service B, C, D mà không bắt người dùng hoặc cổng thanh toán phải đứng chờ:

```mermaid
flowchart LR
    PSP["Cổng SePay"] -->|"1. Webhook IPN"| PAY["Payment Service"]
    PAY -->|"2. Commit Payment + Outbox"| PDB[("Payment DB")]
    PAY -->|"3. Trả 200 OK ngay (dưới 50ms)"| PSP

    PDB -.->|"4. OutboxRelay đẩy bất đồng bộ"| EX{{"RabbitMQ Exchange: platform.events"}}
    EX -.->|"payment.payment.succeeded.v1"| Q1[("booking.payment-events.q")]
    EX -.->|"payment.payment.succeeded.v1"| Q2[("notification.integration-events.q")]
    EX -.->|"payment.payment.succeeded.v1"| Q3[("reporting.integration-events.q")]

    Q1 --> BK["Booking Service: Chốt PAID & Xuất Vé"]
    Q2 --> NOTI["Notification Service: Lưu Thông Báo"]
    Q3 --> REP["Reporting Service: Chiếu Doanh Thu"]
```

Hãy quan sát sự lột xác về mặt kỹ thuật:
- **Thời gian phản hồi Webhook giảm từ hàng chục giây xuống dưới 50ms**: `Payment Service` chỉ xác thực chữ ký HMAC/Secret Key, lưu trạng thái `SUCCEEDED` kèm bản ghi sự kiện vào chính `Payment DB` của nó, rồi lập tức trả `200 OK` cho SePay.
- **Cô lập lỗi tuyệt đối (Fault Isolation)**: Nếu `Notification Service` hoặc `Reporting Service` bị tắt hẳn 30 phút để bảo trì, sự kiện vẫn nằm an toàn trên đĩa cứng của hàng đợi RabbitMQ (`notification.integration-events.q`, `reporting.integration-events.q`). Luồng thanh toán của `Payment` và luồng xuất vé của `Booking` vẫn chạy mượt mà 100%, không hề hay biết `Reporting` đang bảo trì! Khi `Reporting` bật lại, nó tự động đọc bù toàn bộ tin nhắn tồn đọng và hội tụ số liệu (**Eventual Consistency — Nhất quán cuối cùng**).
- **Mở rộng không chạm code gốc (Zero-Touch Extensibility)**: Ngày mai nếu thêm `Loyalty Service`, chỉ cần tạo thêm hàng đợi `loyalty.events.q` gắn vào `platform.events` — không phải sửa dù chỉ 1 dòng code trong `Payment Service` hay `Booking Service`!

### 1.4. Phân biệt sắc bén: Integration Event vs Asynchronous Command

Trong thiết kế messaging của dự án (xem [02-01-06-message-broker.md](file:///C:/Users/minht/.gemini/antigravity/worktrees/PBL6/c_to_n_b/docs/system-design/02-01-system-architecture/02-01-06-message-broker.md) và [platform-message.schema.json](file:///C:/Users/minht/.gemini/antigravity/worktrees/PBL6/c_to_n_b/docs/contracts/schemas/platform-message.schema.json)), chúng ta phân biệt rất rõ hai loại thông điệp đi qua RabbitMQ:

| Tiêu chí so sánh | Integration Event (Sự kiện tích hợp) | Asynchronous Command (Mệnh lệnh bất đồng bộ) |
|---|---|---|
| **Bản chất ngữ nghĩa** | Kể lại một **sự thật nghiệp vụ đã xảy ra và đã commit** trong quá khứ (không ai có quyền "từ chối" sự thật lịch sử đó). | Yêu cầu một dịch vụ đích **thực hiện một hành động cụ thể** (dịch vụ đích có thể chấp nhận hoặc từ chối nếu vi phạm điều kiện). |
| **Cách đặt tên (Naming)** | Động từ ở **thì quá khứ** (`UserRegistered`, `TripPublished`, `BookingPaid`, `PaymentSucceeded`). | Động từ **mệnh lệnh / yêu cầu tác vụ** (`notification.delivery.send.v1` hoặc `PaymentCompensationRequested`). |
| **Exchange đi qua** | `platform.events` (Topic Exchange). | `platform.commands` (Topic Exchange). |
| **Mối quan hệ Producer – Consumer** | **1-nhiều (Fan-out)**: Người phát không biết và không quan tâm có 1, 3 hay 10 dịch vụ đang lắng nghe. | **1-1 theo chủ sở hữu logic (Point-to-Owner)**: Chỉ đúng một Bounded Context sở hữu nghiệp vụ đó đứng ra nhận và xử lý. |
| **Định danh trong JSON Schema** | Dùng cặp `eventId` + `eventType` (`EventEnvelope`). | Dùng cặp `commandId` + `commandType` (`CommandEnvelope`). |

---

## 2. Giải Mã RabbitMQ (AMQP 0-9-1) Bằng Hình Ảnh "Bưu Điện Trung Tâm"

Đối với người chưa từng làm việc với Message Broker, sai lầm phổ biến nhất là tưởng tượng RabbitMQ chỉ là một mảng `Queue` đơn giản: bên A nhét tin nhắn vào đầu ống, bên B rút ra ở cuối ống. Thực tế, **RabbitMQ** (triển khai chuẩn giao thức **AMQP 0-9-1**) thông minh hơn thế rất nhiều: **Producer trong RabbitMQ KHÔNG BAO GIỜ gửi tin nhắn trực tiếp vào Queue!**

Để hiểu trọn vẹn cơ chế bên trong của container `rabbitmq:4.1-management-alpine` đang chạy ở cổng `5672` (AMQP) và `15672` (Management UI), hãy hình dung RabbitMQ như một **Hệ Thống Bưu Điện Trung Tâm**:

```mermaid
flowchart LR
    subgraph AppA["Microservice phát tin (Producer)"]
        P["OutboxRelay / RabbitMqSmokeBus"]
    end

    subgraph VHost["Tòa nhà Bưu Điện riêng: Virtual Host 'bus-ticket'"]
        EX{{"Bàn phân loại thư (Topic Exchange): platform.events"}}
        B1["Luật chia thư (Binding): booking.booking.*.v1"]
        B2["Luật chia thư (Binding): booking.booking.created.v1"]

        Q1[("Hòm thư 1 (Queue): notification.integration-events.q")]
        Q2[("Hòm thư 2 (Queue): payment.refund-requests.q")]
        DLX{{"Bàn xử lý thư lỗi (DLX): platform.dlx"}}
        DLQ[("Kho lưu trữ thư chết (DLQ): booking.trip-events.dlq")]
    end

    subgraph AppB["Các Microservice nhận tin (Consumers)"]
        C1["Notification Consumer"]
        C2["Payment Consumer"]
    end

    P -->|"Gắn nhãn địa chỉ (Routing Key): booking.booking.created.v1"| EX
    EX --> B1 --> Q1
    EX --> B2 --> Q2
    Q1 -->|"Giao thư + Chờ ký nhận (Manual Ack)"| C1
    Q2 -->|"Giao thư + Chờ ký nhận (Manual Ack)"| C2
    C1 -.->|"Từ chối thư hỏng: BasicNack(requeue=false)"| DLX
    DLX -->|"Routing Key: #"| DLQ
```

Chúng ta hãy bóc tách từng khái niệm kỹ thuật tương ứng với đời thực và đối chiếu thẳng vào code C# của dự án:

### 2.1. `Producer`, `Connection` vs `Channel`, và `Virtual Host (bus-ticket)`

1. **`Producer` (Người gửi thư)**: Là thành phần phát thông điệp lên Broker. Trong dự án này, lớp `RabbitMqSmokeBus` (triển khai interface `IEventPublisher`) đóng vai trò Producer thực thi hàm `_channel.BasicPublishAsync(...)` dưới sự điều phối của `OutboxRelay`.
2. **`Connection` vs `Channel` (Đường cao tốc TCP vs Làn xe ảo)**:
   - `IConnection`: Một kết nối mạng TCP vật lý từ ứng dụng `.NET 10` tới cổng `5672` của RabbitMQ. Thiết lập kết nối TCP tốn bắt tay 3 bước (3-way handshake) và xác thực AMQP khá đắt đỏ, nên mỗi hosted service chỉ mở một `IConnection` dài hạn.
   - `IChannel`: Là một "kênh truyền tải ảo" nhẹ (multiplexed virtual connection) chạy bên trong đường ống `IConnection` đó. Mọi thao tác khai báo Exchange, Queue, Publish hay Ack đều thực hiện qua `IChannel` (trong thư viện `RabbitMQ.Client` `v7.1.2`, API cũ `IModel` đồng bộ của bản v6 đã được thay thế hoàn toàn bằng `IChannel` bất đồng bộ `async/await` chuẩn mực!).
3. **`Virtual Host` (`bus-ticket` — Tòa nhà bưu điện độc lập)**:
   Giống như một cụm PostgreSQL có nhiều database tách biệt, một cụm RabbitMQ có thể chia thành nhiều **Virtual Host (vhost)**. Mọi Exchange, Queue, Binding và quyền truy cập User trong vhost `bus-ticket` hoàn toàn tách biệt với vhost mặc định `/`. Khi kết nối qua URI `amqp://platform:guest@localhost:5672/bus-ticket`, ứng dụng được định vị thẳng vào không gian riêng của hệ thống vé xe.

### 2.2. `Exchange` (Bàn phân loại thư) và Sức mạnh của `Topic Exchange` (`*` vs `#`)

**Quy luật bất di bất dịch**: `Exchange` là nơi nhận thư từ `Producer`, đọc nhãn `Routing Key` dán ngoài phong bì, đối chiếu với danh sách luật `Binding`, rồi **nhân bản (copy) bức thư đó bỏ vào tất cả các `Queue` khớp điều kiện**. Bản thân `Exchange` hoàn toàn không có bộ nhớ lưu trữ thư — nếu một bức thư gửi vào Exchange mà không khớp bất kỳ Queue nào, nó sẽ bị tiêu hủy ngay (hoặc trả lại cho người gửi nếu bật cờ `mandatory: true`).

AMQP 0-9-1 cung cấp 4 loại Exchange chính:
- **`Fanout` (Loa phóng thanh)**: Bỏ qua hoàn toàn `Routing Key`. Cứ có bao nhiêu Queue nối vào là nhân bản gửi hết cho bấy nhiêu Queue. Quá thô sơ vì `Transport Service` không hề muốn nhận sự kiện `UserRegistered` của `Identity`!
- **`Direct` (Khớp chính xác 1-1)**: `Routing Key` trên thư phải giống hệt từng ký tự với `Binding Key` (ví dụ `"payment.payment.succeeded.v1" == "payment.payment.succeeded.v1"`). Thiếu linh hoạt khi một Consumer muốn nghe toàn bộ họ sự kiện của một thực thể.
- **`Headers`**: Định tuyến dựa trên thuộc tính Header thay vì Routing Key (ít dùng, hiệu năng kém hơn).
- **`Topic` (Định tuyến theo chủ đề phân cấp bằng dấu chấm — Trái tim của dự án!)**:
  Cho phép đặt `Routing Key` là các từ nối nhau bởi dấu chấm `.` (tối đa 255 bytes), theo quy ước chuẩn của dự án:
  ```text
  <bounded-context>.<aggregate-or-capability>.<action>.v<major>
  ```
  Ví dụ: `transport.trip.published.v1`, `transport.trip.cancelled.v1`, `booking.booking.paid.v1`.
  Khi Queue đăng ký nhận thư từ **Topic Exchange**, nó được phép dùng **2 ký tự đại diện (Wildcards)** cực mạnh:
  - **Dấu sao `*` (Star)**: Thay thế cho **ĐÚNG MỘT TỪ (1 word)** nằm giữa hai dấu chấm.
    - Ví dụ thực tế trong `definitions.json`: Queue `booking.trip-events.q` bind với khóa `transport.trip.*.v1`.
    - Khớp hoàn hảo với: `transport.trip.published.v1`, `transport.trip.updated.v1`, `transport.trip.status-changed.v1`, `transport.trip.cancelled.v1`.
    - **KHÔNG khớp** với: `transport.trip.v1` (thiếu từ ở giữa) hoặc `transport.trip.seat.locked.v1` (dư thành 2 từ ở giữa) hoặc `transport.trip.published.v2` (khác phiên bản major `v2`). Nhờ vậy khi tương lai nâng cấp breaking change lên `.v2`, Consumer `.v1` cũ hoàn toàn không bị nhận nhầm dữ liệu cấu trúc mới!
  - **Dấu thăng `#` (Hash)**: Thay thế cho **KHÔNG, MỘT HOẶC NHIỀU TỪ BẤT KỲ (0 or more words)**.
    - Ví dụ thực tế trong `definitions.json`: Queue chứa thư lỗi `booking.trip-events.dlq` bind vào `platform.dlx` với khóa `#` -> Hứng trọn 100% mọi thông điệp bị dead-letter bất kể routing key gốc của chúng dài bao nhiêu từ!
    - *Lưu ý thiết kế quan trọng*: Trong [01-topology.md](file:///C:/Users/minht/.gemini/antigravity/worktrees/PBL6/c_to_n_b/docs/system-design/02-08-rabbitmq-event-flow/01-topology.md), kiến trúc sư nghiêm cấm `Reporting Service` bind kiểu lười biếng bằng `#` trên `platform.events`! Reporting chỉ được bind tường minh những nhánh sự kiện mà nó thực sự có Projector xử lý (`booking.booking.*.v1`, `payment.payment.*.v1`, `payment.refund.*.v1`), tránh làm ngập hàng đợi và bảng `inbox_messages` bởi hàng vạn sự kiện không liên quan.

### 2.3. `Queue` & `Consumer`: Tại sao "Queue thuộc về Consumer"? (Fan-out vs Competing Consumers)

Một nguyên tắc sống còn khi thiết kế Topology RabbitMQ là: **Mỗi dịch vụ cần nhận cùng một sự kiện PHẢI sở hữu Queue riêng của mình; nhưng nhiều bản sao (Replicas) của CÙNG một dịch vụ lại đọc CHUNG một Queue đó.**

Hãy xem điều gì xảy ra khi `Booking Service` phát 1 sự kiện `BookingPaid` (`booking.booking.paid.v1`) lên `platform.events`:
1. **Giữa các dịch vụ khác nhau (Fan-out / Pub-Sub)**:
   - `notification.integration-events.q` (của Notification Service) nhận được **bản sao số 1**.
   - `reporting.integration-events.q` (của Reporting Service) nhận được **bản sao số 2**.
   - Nếu cả Notification và Reporting dùng chung 1 Queue, hễ Notification rút mất tin nhắn đó ra là Reporting sẽ mù tịt và doanh thu bị thiếu hụt ngay!
2. **Giữa nhiều container của cùng một dịch vụ (Competing Consumers / Load Balancing)**:
   - Giả sử vào dịp Tết, bạn scale ngang `Booking Service` lên **3 containers** cùng trỏ vào hàng đợi `booking.payment-events.q`.
   - Khi có 300 sự kiện `PaymentSucceeded` đổ vào hàng đợi này, RabbitMQ sẽ chia tải luân phiên (Round-Robin theo Prefetch) cho 3 containers: mỗi container xử lý 100 đơn hàng song song nhau mà không bị dẫm chân lên nhau!

### 2.4. Cơ chế Bền vững & Ký nhận Hai Đầu: `Persistent`, `Mandatory`, `BasicAck`, `BasicNack` và `DLX`

Làm sao đảm bảo một tin nhắn tiền bạc (như `PaymentSucceeded`) không bao giờ "bốc hơi" giữa đường khi mất điện máy chủ hoặc code Consumer bị crash? RabbitMQ cung cấp 5 chốt chặn an toàn được sử dụng trực tiếp trong [RabbitMqSmokeBus.cs](file:///C:/Users/minht/.gemini/antigravity/worktrees/PBL6/c_to_n_b/workspace/src/building-blocks/BusTicketPlatform.BuildingBlocks.Messaging/RabbitMqSmokeBus.cs):

1. **`durable: true` + `DeliveryModes.Persistent` (Chế độ ghi đĩa = `2`)**:
   - Nhiều người lầm tưởng chỉ khai báo Queue `durable: true` là tin nhắn an toàn khi RabbitMQ khởi động lại. Sai! `durable: true` chỉ giữ lại **cái vỏ hòm thư (metadata của Exchange/Queue)** sau khi restart; nếu tin nhắn gửi vào mang `DeliveryMode = Transient (1)`, RabbitMQ chỉ giữ nó trên RAM và mất sạch khi sập nguồn!
   - Phải kết hợp cả hai: Exchange `durable: true`, Queue `durable: true`, VÀ từng tin nhắn gắn thuộc tính `DeliveryMode = DeliveryModes.Persistent` (giá trị `2` trong AMQP, dòng 73 của `RabbitMqSmokeBus.cs`) để RabbitMQ lưu nội dung tin nhắn xuống đĩa cứng (`/var/lib/rabbitmq`).
2. **Cờ `mandatory: true` (Chống rơi thư vào hố đen — dòng 81 của `RabbitMqSmokeBus.cs`)**:
   - Nếu `mandatory: false`, khi Producer gõ nhầm routing key hoặc chưa kịp tạo Queue bind vào Exchange, Exchange sẽ âm thầm vứt bỏ tin nhắn mà không báo lỗi.
   - Khi bật `mandatory: true`, nếu không có ít nhất 1 Queue nhận được tin nhắn, RabbitMQ lập tức trả ngược bản tin đó về cho Producer thông qua khung lệnh `basic.return` thay vì nuốt mất âm thầm.
3. **`autoAck: false` & `BasicAck` (Ký nhận thủ công sau khi xử lý xong)**:
   - Nếu bật `autoAck: true` (tự động xác nhận ngay khi vừa đẩy tin qua mạng TCP tới Consumer), giả sử Consumer vừa nhận gói tin vào RAM thì bị sập nguồn `OutOfMemoryException` trước khi kịp lưu vào PostgreSQL -> Tin nhắn đã bị RabbitMQ xóa vĩnh viễn!
   - Trong `RabbitMqSmokeBus.GetAsync` (dòng 89), hệ thống luôn đặt **`autoAck: false`**. RabbitMQ chỉ đánh dấu tin nhắn ở trạng thái `Unacked` (đang giao). Chỉ khi nào Consumer ghi xong `inbox_messages` + cập nhật DB nghiệp vụ thành công và gọi tường minh `AckAsync(deliveryTag)` (`BasicAckAsync`), RabbitMQ mới xóa tin nhắn khỏi Queue. Nếu Consumer chết giữa chừng (đứt kết nối TCP), RabbitMQ lập tức thu hồi tin nhắn `Unacked` đó về lại `Ready` để giao cho Consumer khác!
4. **`BasicNack(requeue: false)` — Tại sao TUYỆT ĐỐI tránh `requeue: true` vô hạn?**:
   - Giả sử một tin nhắn bị lỗi cú pháp JSON hoặc dữ liệu rác gây `Exception` (gọi là **Poison Message — Tin nhắn độc**).
   - Nếu trong khối `catch`, bạn gọi `BasicNack(deliveryTag, requeue: true)`, RabbitMQ sẽ nhét tin nhắn độc đó ngược trở lại ngay đầu hàng đợi. Consumer đọc lại sau 1 mili-giây -> lại văng Exception -> lại `requeue: true` -> tạo thành **vòng lặp vô tận (Infinite Tight Loop)** hàng chục nghìn lần mỗi giây, đốt cháy 100% CPU, làm đầy ổ cứng bởi hàng chục GB file log lỗi và chặn đứng các tin nhắn hợp lệ phía sau!
   - Vì vậy, trong `IntegrationEventConsumerHost.cs` (dòng 92), khi gặp lỗi xử lý, hệ thống gọi `bus.RejectAsync(delivered.Value.DeliveryTag, requeue: false, stoppingToken)` (tức `BasicNack` với `requeue: false`).
5. **`Dead-Letter Exchange (DLX)` & `Dead-Letter Queue (DLQ)` (Nhà xác tin nhắn để khám nghiệm & cứu hộ)**:
   - Khi một tin nhắn bị `BasicNack(requeue: false)` (hoặc hết hạn TTL), nó không bị xóa mất! Nhờ mọi Queue chính đều khai báo tham số `"x-dead-letter-exchange": "platform.dlx"`, RabbitMQ tự động chuyển phát tin nhắn hỏng đó sang bàn phân loại `platform.dlx`, từ đó đi thẳng vào kho cách ly `booking.trip-events.dlq` (nhờ binding `#`). Quản trị viên có thể mở giao diện RabbitMQ Management (`http://localhost:15672`), đọc nguyên vẹn nội dung tin nhắn lỗi để tìm nguyên nhân gốc (Root Cause Analysis) và phát lại (Replay) sau khi đã vá lỗi!

---

### 2.5. Lý giải Quyết định Kiến trúc ADR-004: Tại sao chọn RabbitMQ thay vì Apache Kafka hay Redis Pub/Sub?

Khi bảo vệ đồ án trước hội đồng, câu hỏi kinh điển luôn xuất hiện là: *"Hiện nay nhiều công ty lớn dùng Apache Kafka hoặc có sẵn Redis trong dự án rồi sao không dùng Redis Pub/Sub cho nhẹ, tại sao nhóm lại chọn RabbitMQ?"*

Dưới đây là bảng phân tích kỹ thuật toàn diện bám sát [ADR-004](file:///C:/Users/minht/.gemini/antigravity/worktrees/PBL6/c_to_n_b/docs/system-design/02-01-system-architecture/02-01-12-architecture-decisions.md#L37-L43):

| Tiêu chí kỹ thuật | Redis Pub/Sub | Apache Kafka | RabbitMQ 4.1 (Lựa chọn của dự án — ADR-004) |
|---|---|---|---|
| **Triết lý kiến trúc** | Trạm phát sóng trên RAM (Fire-and-Forget). | Nhật ký phân tán bất biến trên đĩa (Distributed Append-Only Commit Log — Dumb Broker / Smart Consumer). | Bộ định tuyến thông điệp thông minh (Message Broker chuẩn AMQP — Smart Broker / Dumb Consumer). |
| **Độ bền thông điệp khi Consumer sập** | **Mất trắng 100%!** Nếu lúc phát sự kiện mà Consumer đang offline 1 giây, tin nhắn biến mất vĩnh viễn. Không thể dùng cho tiền bạc/vé xe! | Cực cao: lưu giữ trên đĩa cứng theo thời gian cấu hình (7 ngày, 30 ngày hoặc vĩnh viễn). | Rất cao cho hàng đợi giao dịch: lưu bền vững trên đĩa (`Persistent`) cho đến khi từng Consumer gọi `BasicAck` xác nhận đã lưu DB xong. |
| **Khả năng định tuyến linh hoạt (Routing)** | Rất hạn chế theo kênh chuỗi đơn giản. | Không có định tuyến nội dung linh hoạt ở tầng Broker; Consumer phải tự đọc cả Topic lớn rồi tự lọc (Filter) ở tầng ứng dụng. | **Xuất sắc**: `Topic Exchange` hỗ trợ định tuyến phân cấp đa chiều bằng `*` và `#` ngay tại tầng Broker, tách biệt rõ `platform.events` và `platform.commands`. |
| **Cơ chế Xử lý lỗi từng tin nhắn (Per-message Retry & DLQ)** | Không hỗ trợ (Redis Streams có consumer group nhưng thiếu hệ sinh thái DLX/TTL tự nhiên). | Khó xử lý lỗi đơn lẻ: vì Consumer đọc tuần tự theo con trỏ `Offset`, một tin nhắn lỗi ở offset #105 sẽ chặn các tin sau hoặc buộc ứng dụng tự viết Retry Topic / DLQ phức tạp. | **Hỗ trợ nguyên bản (Native)**: Ack/Nack từng `DeliveryTag` độc lập, tích hợp sẵn `x-dead-letter-exchange` (DLX), TTL delay queue và cơ chế cách ly Poison Message tức thì. |
| **Độ trễ đầu-cuối (End-to-End Latency)** | Dưới 1 ms (nhưng không an toàn). | Thường từ vài ms đến hàng chục ms (tối ưu cho gom lô Batching throughput hàng trăm nghìn msg/s). | **Cực thấp (1–5 ms)** cho từng giao dịch lẻ — rất lý tưởng cho trải nghiệm người dùng vừa chuyển khoản SePay xong thấy vé hiện lên ngay trên màn hình! |
| **Chi phí tài nguyên & Vận hành (Ops Footprint)** | Rất nhẹ (nhưng dự án chỉ dùng Redis cho Cache/Rate-limit theo ADR-008). | Rất nặng: chạy trên JVM tốn hàng GB RAM ngay khi khởi động, phải quản lý Partition, Consumer Rebalance, KRaft/ZooKeeper — dư thừa cho quy mô đặt vé xe khách. | **Gọn nhẹ & thực dụng**: Image `rabbitmq:4.1-management-alpine` chạy trên Erlang BEAM tốn chỉ ~100–200MB RAM, có sẵn Web UI trực quan ở cổng `15672` và nạp toàn bộ topology qua 1 file `definitions.json` duy nhất! |
| **Khi nào mới nên chuyển sang Kafka?** | Không bao giờ dùng cho luồng giao dịch chính. | Khi nền tảng mở rộng sang thu thập GPS thời gian thực của 50.000 xe khách mỗi giây (Telemetry Streaming) hoặc Event Sourcing toàn cục cần tua lại lịch sử 1 năm. | Phù hợp hoàn hảo 100% cho **Transactional Microservices Saga, Command/Event Routing và Fan-out thông báo/báo cáo** của nền tảng đặt vé xe! |

---

## 3. Giải Phẫu Hạ Tầng Cấu Hình RabbitMQ Thực Tế Trong Dự Án

Không chỉ dừng ở lý thuyết, BLUE Bus Ticket Platform cấu hình toàn bộ hạ tầng RabbitMQ theo triết lý **Infrastructure as Code (IaC)** — chỉ cần gõ `docker compose up -d` là toàn bộ Virtual Host, tài khoản, 4 Exchanges, 8 Queues và 17 Bindings tự động hình thành sẵn sàng 100%, không cần bất kỳ thao tác bấm chuột thủ công nào!

Hãy mở và đọc lần lượt 4 tệp cấu hình tại thư mục `workspace/src/infra/` và `BuildingBlocks.Messaging`:
- [docker-compose.yml](file:///C:/Users/minht/.gemini/antigravity/worktrees/PBL6/c_to_n_b/workspace/src/infra/docker-compose.yml#L44-L65)
- [rabbitmq.conf](file:///C:/Users/minht/.gemini/antigravity/worktrees/PBL6/c_to_n_b/workspace/src/infra/rabbitmq/rabbitmq.conf)
- [entrypoint.sh](file:///C:/Users/minht/.gemini/antigravity/worktrees/PBL6/c_to_n_b/workspace/src/infra/rabbitmq/entrypoint.sh)
- [definitions.json](file:///C:/Users/minht/.gemini/antigravity/worktrees/PBL6/c_to_n_b/workspace/src/infra/rabbitmq/definitions.json)

### 3.1. Cơ chế Khởi động An toàn: `docker-compose.yml`, `rabbitmq.conf` và `entrypoint.sh`

Trong [docker-compose.yml](file:///C:/Users/minht/.gemini/antigravity/worktrees/PBL6/c_to_n_b/workspace/src/infra/docker-compose.yml#L44-L65), dịch vụ `rabbitmq` được khai báo như sau:

```yaml
  rabbitmq:
    image: rabbitmq:4.1-management-alpine
    environment:
      RABBITMQ_DEFAULT_USER: platform
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD:-guest}
      RABBITMQ_DEFAULT_VHOST: bus-ticket
    ports:
      - "5672:5672"
      - "15672:15672"
    volumes:
      - rabbitmq-data:/var/lib/rabbitmq
      - ./rabbitmq/rabbitmq.conf:/etc/rabbitmq/rabbitmq.conf:ro
      - ./rabbitmq/definitions.json:/etc/rabbitmq/definitions.template.json:ro
      - ./rabbitmq/entrypoint.sh:/usr/local/bin/pbl6-rabbitmq-entrypoint:ro
    entrypoint: ["/bin/sh", "/usr/local/bin/pbl6-rabbitmq-entrypoint"]
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"]
      interval: 10s
      timeout: 5s
      retries: 20
```

Và bên trong [rabbitmq.conf](file:///C:/Users/minht/.gemini/antigravity/worktrees/PBL6/c_to_n_b/workspace/src/infra/rabbitmq/rabbitmq.conf) chỉ có đúng 2 dòng tinh gọn nhưng mang tính bảo mật cao:

```ini
load_definitions = /etc/rabbitmq/definitions.json
loopback_users.guest = false
```

- `load_definitions`: Ra lệnh cho RabbitMQ ngay khi khởi động phải nạp tự động toàn bộ cấu trúc vhost, user, exchange, queue và binding từ tệp JSON.
- `loopback_users.guest = false`: Mặc định RabbitMQ chặn tài khoản mặc định kết nối từ container khác qua mạng Docker bridge; cấu hình này kết hợp với user chuyên biệt `platform` giúp các container `.NET` trong mạng `platform` giao tiếp trơn tru ở môi trường local/dev, trong khi mật khẩu thực tế được tiêm động từ biến môi trường `RABBITMQ_PASSWORD`.

Nhưng tại sao không viết cứng mật khẩu vào `definitions.json` trên Git? Vì làm vậy sẽ lộ Secret trên kho mã nguồn! Nhóm đã viết script [entrypoint.sh](file:///C:/Users/minht/.gemini/antigravity/worktrees/PBL6/c_to_n_b/workspace/src/infra/rabbitmq/entrypoint.sh) cực kỳ chặt chẽ:

```sh
#!/bin/sh
set -eu

case "${RABBITMQ_DEFAULT_PASS:-}" in
  ''|*[!A-Za-z0-9._~-]*)
    echo "RABBITMQ_DEFAULT_PASS must use URL-safe characters: A-Z a-z 0-9 . _ ~ -" >&2
    exit 1
    ;;
esac

sed "s|__RABBITMQ_PASSWORD__|${RABBITMQ_DEFAULT_PASS}|g" \
  /etc/rabbitmq/definitions.template.json > /tmp/definitions.json
sed 's|/etc/rabbitmq/definitions.json|/tmp/definitions.json|g' \
  /etc/rabbitmq/rabbitmq.conf > /tmp/rabbitmq.conf
export RABBITMQ_CONFIG_FILE=/tmp/rabbitmq

exec /usr/local/bin/docker-entrypoint.sh rabbitmq-server
```

**Giải thích từng dòng kỹ thuật đáng giá điểm 10 khi bảo vệ**:
1. `set -eu`: Dừng ngay container nếu có bất kỳ lệnh nào lỗi (`-e`) hoặc biến chưa khởi tạo (`-u`).
2. Khối `case "${RABBITMQ_DEFAULT_PASS:-}"`: Kiểm tra whitelist ký tự mật khẩu chỉ gồm `A-Z`, `a-z`, `0-9`, `.`, `_`, `~`, `-`. Tại sao phải kỹ như vậy? Có **2 lý do kép**:
   - Thứ nhất: các microservice `.NET` truyền thông tin đăng nhập qua chuỗi URI `amqp://platform:<password>@rabbitmq:5672/bus-ticket`. Nếu mật khẩu chứa ký tự `@`, `/`, `:`, `?` hoặc `#` chưa mã hóa phần trăm, `new Uri(amqpUri)` trong C# sẽ parse sai hỏng kết nối ngay!
   - Thứ hai: ngăn chặn triệt để lỗi **Sed Delimiter Collision / JSON Injection** (chẳng hạn mật khẩu có dấu `|` hoặc `"` làm vỡ cú pháp `definitions.json` khi chạy lệnh `sed`).
3. Các tệp cấu hình gốc được mount ở chế độ **chỉ đọc (`:ro`)** để container không thể ghi đè làm bẩn file trên máy host. Script sinh tệp tạm sạch sẽ tại `/tmp/definitions.json` và `/tmp/rabbitmq.conf`, trỏ `RABBITMQ_CONFIG_FILE=/tmp/rabbitmq` (RabbitMQ tự nối đuôi `.conf`), rồi dùng `exec` bàn giao PID 1 cho tiến trình chính `rabbitmq-server` để nhận tín hiệu `SIGTERM` tắt máy êm ái!

---

### 3.2. Giải phẫu trọn vẹn `definitions.json` & Sơ đồ Topology Toàn Cảnh

Hãy xem toàn bộ nội dung tệp [definitions.json](file:///C:/Users/minht/.gemini/antigravity/worktrees/PBL6/c_to_n_b/workspace/src/infra/rabbitmq/definitions.json):

```json
{
  "vhosts": [
    { "name": "bus-ticket" }
  ],
  "users": [
    {
      "name": "platform",
      "password": "__RABBITMQ_PASSWORD__",
      "tags": ["administrator"]
    }
  ],
  "permissions": [
    {
      "user": "platform",
      "vhost": "bus-ticket",
      "configure": ".*",
      "write": ".*",
      "read": ".*"
    }
  ],
  "exchanges": [
    { "name": "platform.events", "vhost": "bus-ticket", "type": "topic", "durable": true, "auto_delete": false, "internal": false, "arguments": {} },
    { "name": "platform.commands", "vhost": "bus-ticket", "type": "topic", "durable": true, "auto_delete": false, "internal": false, "arguments": {} },
    { "name": "platform.retry", "vhost": "bus-ticket", "type": "topic", "durable": true, "auto_delete": false, "internal": false, "arguments": {} },
    { "name": "platform.dlx", "vhost": "bus-ticket", "type": "topic", "durable": true, "auto_delete": false, "internal": false, "arguments": {} }
  ],
  "queues": [
    { "name": "booking.trip-events.q", "vhost": "bus-ticket", "durable": true, "auto_delete": false, "arguments": { "x-dead-letter-exchange": "platform.dlx" } },
    { "name": "booking.payment-events.q", "vhost": "bus-ticket", "durable": true, "auto_delete": false, "arguments": { "x-dead-letter-exchange": "platform.dlx" } },
    { "name": "transport.inventory-events.q", "vhost": "bus-ticket", "durable": true, "auto_delete": false, "arguments": { "x-dead-letter-exchange": "platform.dlx" } },
    { "name": "payment.refund-requests.q", "vhost": "bus-ticket", "durable": true, "auto_delete": false, "arguments": { "x-dead-letter-exchange": "platform.dlx" } },
    { "name": "notification.integration-events.q", "vhost": "bus-ticket", "durable": true, "auto_delete": false, "arguments": { "x-dead-letter-exchange": "platform.dlx" } },
    { "name": "notification.commands.q", "vhost": "bus-ticket", "durable": true, "auto_delete": false, "arguments": { "x-dead-letter-exchange": "platform.dlx" } },
    { "name": "reporting.integration-events.q", "vhost": "bus-ticket", "durable": true, "auto_delete": false, "arguments": { "x-dead-letter-exchange": "platform.dlx" } },
    { "name": "booking.trip-events.dlq", "vhost": "bus-ticket", "durable": true, "auto_delete": false, "arguments": {} }
  ],
  "bindings": [
    { "source": "platform.events", "vhost": "bus-ticket", "destination": "booking.trip-events.q", "destination_type": "queue", "routing_key": "transport.trip.*.v1", "arguments": {} },
    { "source": "platform.events", "vhost": "bus-ticket", "destination": "booking.payment-events.q", "destination_type": "queue", "routing_key": "payment.payment.*.v1", "arguments": {} },
    { "source": "platform.events", "vhost": "bus-ticket", "destination": "booking.payment-events.q", "destination_type": "queue", "routing_key": "payment.refund.*.v1", "arguments": {} },
    { "source": "platform.events", "vhost": "bus-ticket", "destination": "transport.inventory-events.q", "destination_type": "queue", "routing_key": "booking.trip-inventory.ready.v1", "arguments": {} },
    { "source": "platform.events", "vhost": "bus-ticket", "destination": "payment.refund-requests.q", "destination_type": "queue", "routing_key": "booking.booking.created.v1", "arguments": {} },
    { "source": "platform.events", "vhost": "bus-ticket", "destination": "payment.refund-requests.q", "destination_type": "queue", "routing_key": "booking.booking.cancelled.v1", "arguments": {} },
    { "source": "platform.events", "vhost": "bus-ticket", "destination": "payment.refund-requests.q", "destination_type": "queue", "routing_key": "booking.refund.requested.v1", "arguments": {} },
    { "source": "platform.commands", "vhost": "bus-ticket", "destination": "payment.refund-requests.q", "destination_type": "queue", "routing_key": "booking.payment.compensation-requested.v1", "arguments": {} },
    { "source": "platform.events", "vhost": "bus-ticket", "destination": "notification.integration-events.q", "destination_type": "queue", "routing_key": "identity.user.registered.v1", "arguments": {} },
    { "source": "platform.events", "vhost": "bus-ticket", "destination": "notification.integration-events.q", "destination_type": "queue", "routing_key": "booking.booking.*.v1", "arguments": {} },
    { "source": "platform.events", "vhost": "bus-ticket", "destination": "notification.integration-events.q", "destination_type": "queue", "routing_key": "booking.ticket.issued.v1", "arguments": {} },
    { "source": "platform.events", "vhost": "bus-ticket", "destination": "notification.integration-events.q", "destination_type": "queue", "routing_key": "payment.payment.succeeded.v1", "arguments": {} },
    { "source": "platform.commands", "vhost": "bus-ticket", "destination": "notification.commands.q", "destination_type": "queue", "routing_key": "notification.delivery.send.v1", "arguments": {} },
    { "source": "platform.events", "vhost": "bus-ticket", "destination": "reporting.integration-events.q", "destination_type": "queue", "routing_key": "booking.booking.*.v1", "arguments": {} },
    { "source": "platform.events", "vhost": "bus-ticket", "destination": "reporting.integration-events.q", "destination_type": "queue", "routing_key": "payment.payment.*.v1", "arguments": {} },
    { "source": "platform.events", "vhost": "bus-ticket", "destination": "reporting.integration-events.q", "destination_type": "queue", "routing_key": "payment.refund.*.v1", "arguments": {} },
    { "source": "platform.dlx", "vhost": "bus-ticket", "destination": "booking.trip-events.dlq", "destination_type": "queue", "routing_key": "#", "arguments": {} }
  ]
}
```

Dưới đây là sơ đồ **Mermaid Topology Toàn Cảnh** biểu diễn chính xác 4 Topic Exchanges, 8 Durable Queues, toàn bộ 17 Bindings và mối liên kết hai chiều giữa 6 Microservices:

```mermaid
flowchart LR
    subgraph Producers["Tầng Phát Tin (Producers qua Outbox)"]
        P_ID["Identity Service"]
        P_TR["Transport Service"]
        P_BK["Booking Service"]
        P_PAY["Payment Service"]
    end

    subgraph VHost["RabbitMQ Virtual Host: bus-ticket"]
        EX_EVT{{"platform.events (topic, durable)"}}
        EX_CMD{{"platform.commands (topic, durable)"}}
        EX_RTY{{"platform.retry (topic, durable - dự phòng tầng retry)"}}
        EX_DLX{{"platform.dlx (topic, durable)"}}

        Q_BT[("1. booking.trip-events.q")]
        Q_BP[("2. booking.payment-events.q")]
        Q_TI[("3. transport.inventory-events.q")]
        Q_PR[("4. payment.refund-requests.q")]
        Q_NI[("5. notification.integration-events.q")]
        Q_NC[("6. notification.commands.q")]
        Q_RI[("7. reporting.integration-events.q")]
        Q_DLQ[("8. booking.trip-events.dlq (Catch-all DLQ)")]
    end

    subgraph Consumers["Tầng Tiêu Thụ (IntegrationEventConsumerHost)"]
        C_BK1["Booking: HandleTripAsync"]
        C_BK2["Booking: HandlePaymentAsync"]
        C_TR["Transport: HandleInventoryReadyAsync"]
        C_PAY["Payment: PaymentEventHandlers.HandleAsync"]
        C_NOTI["Notification: NotificationEventHandlers.HandleAsync"]
        C_REP["Reporting: ReportingEventHandlers.HandleAsync"]
    end

    P_ID -->|"identity.user.registered.v1"| EX_EVT
    P_TR -->|"transport.trip.*.v1"| EX_EVT
    P_BK -->|"booking.*.*.v1"| EX_EVT
    P_PAY -->|"payment.*.*.v1"| EX_EVT
    P_BK -.->|"compensation command (schema)"| EX_CMD

    EX_EVT -->|"transport.trip.*.v1"| Q_BT
    EX_EVT -->|"payment.payment.*.v1 & payment.refund.*.v1"| Q_BP
    EX_EVT -->|"booking.trip-inventory.ready.v1"| Q_TI
    EX_EVT -->|"booking.booking.created.v1 & cancelled.v1 & refund.requested.v1"| Q_PR
    EX_CMD -->|"booking.payment.compensation-requested.v1"| Q_PR
    EX_EVT -->|"user.registered, booking.booking.*, ticket.issued, payment.succeeded"| Q_NI
    EX_CMD -->|"notification.delivery.send.v1"| Q_NC
    EX_EVT -->|"booking.booking.*, payment.payment.*, payment.refund.*"| Q_RI

    Q_BT --> C_BK1
    Q_BP --> C_BK2
    Q_TI --> C_TR
    Q_PR --> C_PAY
    Q_NI --> C_NOTI
    Q_RI --> C_REP

    Q_BT -.->|"x-dead-letter-exchange (Nack requeue=false)"| EX_DLX
    Q_BP -.->|"x-dead-letter-exchange"| EX_DLX
    Q_TI -.->|"x-dead-letter-exchange"| EX_DLX
    Q_PR -.->|"x-dead-letter-exchange"| EX_DLX
    Q_NI -.->|"x-dead-letter-exchange"| EX_DLX
    Q_NC -.->|"x-dead-letter-exchange"| EX_DLX
    Q_RI -.->|"x-dead-letter-exchange"| EX_DLX
    EX_DLX -->|"Routing Key: #"| Q_DLQ
```

### 3.3. Cơ chế "Tự Khai Báo Kép" (Dual Idempotent Declaration) giữa `definitions.json` và Code C#

Một điểm cực kỳ tinh tế trong code thực tế mà bạn nên nhấn mạnh khi trình bày: **Điều gì xảy ra khi chạy Integration Test bằng Testcontainers (`RabbitMqBuilder`) hoặc chạy trên môi trường RabbitMQ trắng chưa nạp `definitions.json`?**

Nếu ứng dụng C# phó mặc hoàn toàn việc tạo Queue cho `definitions.json`, khi chạy `dotnet test` với container `rabbitmq:4.1-management-alpine` nguyên bản (xem [IntegrationEventConsumerTests.cs](file:///C:/Users/minht/.gemini/antigravity/worktrees/PBL6/c_to_n_b/workspace/src/tests/messaging/BusTicketPlatform.Messaging.IntegrationTests/IntegrationEventConsumerTests.cs)), Queue sẽ chưa tồn tại và ứng dụng văng lỗi `NOT_FOUND - no queue` ngay lập tức!

Do đó, trong [IntegrationEventConsumerHost.cs](file:///C:/Users/minht/.gemini/antigravity/worktrees/PBL6/c_to_n_b/workspace/src/building-blocks/BusTicketPlatform.BuildingBlocks.Messaging/IntegrationEventConsumerHost.cs#L51-L54) và [RabbitMqSmokeBus.cs](file:///C:/Users/minht/.gemini/antigravity/worktrees/PBL6/c_to_n_b/workspace/src/building-blocks/BusTicketPlatform.BuildingBlocks.Messaging/RabbitMqSmokeBus.cs#L44-L62), ngay khi một Consumer khởi động, nó gọi `EnsureConsumerAsync`:

```csharp
public async Task EnsureConsumerAsync(string queue, IReadOnlyList<string> routingKeys, CancellationToken cancellationToken)
{
    await _channel.ExchangeDeclareAsync(Topology.EventsExchange, ExchangeType.Topic, durable: true, cancellationToken: cancellationToken);
    await _channel.ExchangeDeclareAsync(Topology.DeadLetterExchange, ExchangeType.Topic, durable: true, cancellationToken: cancellationToken);
    await _channel.QueueDeclareAsync(
        queue,
        durable: true,
        exclusive: false,
        autoDelete: false,
        arguments: new Dictionary<string, object?>
        {
            ["x-dead-letter-exchange"] = Topology.DeadLetterExchange
        },
        cancellationToken: cancellationToken);
    foreach (var routingKey in routingKeys)
    {
        await _channel.QueueBindAsync(queue, Topology.EventsExchange, routingKey, cancellationToken: cancellationToken);
    }
}
```

Trong giao thức AMQP, các lệnh `ExchangeDeclareAsync`, `QueueDeclareAsync` và `QueueBindAsync` là **lũy đẳng (Idempotent)** miễn là các tham số (`durable: true`, `autoDelete: false`, `x-dead-letter-exchange: "platform.dlx"`) khớp chính xác 100% với `definitions.json`!
- Nếu chạy qua Docker Compose: `definitions.json` đã tạo sẵn mọi thứ từ giây thứ 0 (để dù Consumer chưa kịp bật lên, Producer phát tin vào `platform.events` vẫn có sẵn Queue hứng tin ngay, không bị lỗi unroutable!). Khi Consumer bật lên sau đó, `EnsureConsumerAsync` kiểm tra thấy khớp thông số nên đi qua êm ru.
- Nếu chạy Integration Test trên container RabbitMQ trắng: `EnsureConsumerAsync` tự dựng toàn bộ Exchange, Queue (kèm DLX) và Binding cần thiết cho bài test!

### 3.4. Bảng Hằng Số `Topology` & Bộ Ánh Xạ `OutboxRouting.cs`

Toàn bộ tên Exchange, Queue và 18 Routing Keys cốt lõi được định nghĩa tập trung tại lớp tĩnh `Topology` trong [EventMessage.cs](file:///C:/Users/minht/.gemini/antigravity/worktrees/PBL6/c_to_n_b/workspace/src/building-blocks/BusTicketPlatform.BuildingBlocks.Messaging/EventMessage.cs#L62-L92) và được ánh xạ từ `EventType` sang `RoutingKey` tại [OutboxRouting.cs](file:///C:/Users/minht/.gemini/antigravity/worktrees/PBL6/c_to_n_b/workspace/src/building-blocks/BusTicketPlatform.BuildingBlocks.Messaging/OutboxRouting.cs):

```csharp
namespace BusTicketPlatform.BuildingBlocks.Messaging;

public static class OutboxRouting
{
    public static string KeyFor(string messageType) => messageType switch
    {
        "UserRegistered" => Topology.UserRegisteredRoutingKey,           // identity.user.registered.v1
        "TripPublished" => Topology.TripPublishedRoutingKey,             // transport.trip.published.v1
        "TripUpdated" => Topology.TripUpdatedRoutingKey,                 // transport.trip.updated.v1
        "TripStatusChanged" => Topology.TripStatusChangedRoutingKey,     // transport.trip.status-changed.v1
        "TripCancelled" => Topology.TripCancelledRoutingKey,             // transport.trip.cancelled.v1
        "TripInventoryReady" => Topology.TripInventoryReadyRoutingKey,   // booking.trip-inventory.ready.v1
        "SeatHoldCreated" => Topology.SeatHoldCreatedRoutingKey,         // booking.seat-hold.created.v1
        "BookingCreated" => Topology.BookingCreatedRoutingKey,           // booking.booking.created.v1
        "BookingPaid" => Topology.BookingPaidRoutingKey,                 // booking.booking.paid.v1
        "BookingCancelled" => Topology.BookingCancelledRoutingKey,       // booking.booking.cancelled.v1
        "TicketIssued" => Topology.TicketIssuedRoutingKey,               // booking.ticket.issued.v1
        "TicketCancelled" => Topology.TicketCancelledRoutingKey,         // booking.ticket.cancelled.v1
        "TicketCheckedIn" => Topology.TicketCheckedInRoutingKey,         // booking.ticket.checked-in.v1
        "RefundRequested" => Topology.RefundRequestedRoutingKey,         // booking.refund.requested.v1
        "PaymentSucceeded" => Topology.PaymentSucceededRoutingKey,       // payment.payment.succeeded.v1
        "PaymentFailed" => Topology.PaymentFailedRoutingKey,             // payment.payment.failed.v1
        "RefundSucceeded" => Topology.RefundSucceededRoutingKey,         // payment.refund.succeeded.v1
        "RefundFailed" => Topology.RefundFailedRoutingKey,               // payment.refund.failed.v1
        _ => throw new InvalidOperationException($"No routing key mapped for '{messageType}'.")
    };
}
```

> [!TIP]
> **Tại sao không lưu cứng `routing_key` vào bảng SQL `outbox_messages` mà dùng hàm `OutboxRouting.KeyFor(message.EventType)` lúc phát tin?**
> Cách thiết kế này giúp tầng nghiệp vụ (Application/Repository khi ghi Outbox SQL) chỉ cần biết tên sự kiện miền bằng PascalCase (`"BookingPaid"`, `"PaymentSucceeded"`), hoàn toàn không bị rò rỉ chi tiết hạ tầng định tuyến của RabbitMQ vào câu lệnh SQL! Đồng thời nhánh `_ => throw new InvalidOperationException(...)` hoạt động như một chốt kiểm tra Fail-Fast: không bao giờ có chuyện gõ sai chính tả tên sự kiện mà lại lọt lên Broker với một routing key rác.

---

### 3.5. Ma Trận Định Tuyến Đầy Đủ Toàn Bộ 21 Kênh Sự Kiện & Mệnh Lệnh Của Hệ Thống

Bảng dưới đây tổng hợp đối chiếu 100% giữa hợp đồng [platform-mvp.asyncapi.yaml](file:///C:/Users/minht/.gemini/antigravity/worktrees/PBL6/c_to_n_b/docs/contracts/asyncapi/platform-mvp.asyncapi.yaml), tệp hạ tầng [definitions.json](file:///C:/Users/minht/.gemini/antigravity/worktrees/PBL6/c_to_n_b/workspace/src/infra/rabbitmq/definitions.json), bộ định tuyến [OutboxRouting.cs](file:///C:/Users/minht/.gemini/antigravity/worktrees/PBL6/c_to_n_b/workspace/src/building-blocks/BusTicketPlatform.BuildingBlocks.Messaging/OutboxRouting.cs) và các Event Handlers C# thực thi tại cả 6 Microservices:

| # | Message Type (`EventType` / `CommandType`) | Routing Key (`v1`) | Exchange | Producer thực tế trong C# (hoặc Contract) | Queue(s) nhận bản sao tin nhắn | Consumer Handler C# xử lý thực tế & Tác động nghiệp vụ |
|---:|---|---|---|---|---|---|
| 1 | `UserRegistered` | `identity.user.registered.v1` | `platform.events` | **Identity**: `RegistrationEvents.UserRegisteredAsync` (gọi từ `AuthService.RegisterAsync`) | `notification.integration-events.q` | `NotificationEventHandlers.HandleAsync` -> Tạo thông báo chào mừng `"Welcome to BusTicket"` vào bảng `notifications`. |
| 2 | `TripPublished` | `transport.trip.published.v1` | `platform.events` | **Transport**: `TransportEvents.TripPublishedAsync` (gọi từ `TransportService.PublishTripAsync`) | `booking.trip-events.q` (qua `transport.trip.*.v1`) | `BookingEventHandlers.HandleTripAsync` -> `BookingService.ImportPublishedTripAsync` lưu `trip_snapshots` + sinh danh sách ghế `trip_seats` rồi phát ngược `TripInventoryReady`. |
| 3 | `TripUpdated` | `transport.trip.updated.v1` | `platform.events` | **Transport** (Khai báo sẵn trong `OutboxRouting` & AsyncAPI) | `booking.trip-events.q` (qua `transport.trip.*.v1`) | `BookingEventHandlers.HandleTripAsync` nhận (hiện tại MVP chỉ cho sửa chuyến ở trạng thái `DRAFT` trước khi publish nên no-op an toàn). |
| 4 | `TripStatusChanged` | `transport.trip.status-changed.v1` | `platform.events` | **Transport**: `TransportEvents.TripStatusChangedAsync` (gọi từ `TransportService.TransitionTripAsync`) | `booking.trip-events.q` (qua `transport.trip.*.v1`) | `BookingEventHandlers.HandleTripAsync` -> `BookingService.ApplyTripStatusAsync` cập nhật trạng thái chuyến, đóng `sellable = false` và nhả mọi `seat_holds` đang `ACTIVE` khi xe bắt đầu `DEPARTED`. |
| 5 | `TripCancelled` | `transport.trip.cancelled.v1` | `platform.events` | **Transport**: `TransportEvents.TripCancelledAsync` (gọi từ `TransportService.CancelTripAsync`) | `booking.trip-events.q` (qua `transport.trip.*.v1`) | `BookingEventHandlers.HandleTripAsync` -> Gọi `ApplyTripStatusAsync("CANCELLED")`: đóng chuyến, hủy toàn bộ `tickets`, nhả toàn bộ ghế `BOOKED` và chuyển các đơn `PREPAID` đã `PAID` sang `REFUND_PENDING` với `cancellation_fee = 0` (hoàn 100%). |
| 6 | `TripInventoryReady` | `booking.trip-inventory.ready.v1` | `platform.events` | **Booking**: `BookingEvents.InventoryReadyAsync` (sau khi import ghế thành công) | `transport.inventory-events.q` | `TransportEventHandlers.HandleInventoryReadyAsync` -> `TransportService.MarkInventoryReadyAsync` bật cờ `trips.sellable = true` để chuyến xe chính thức hiện lên trang tìm kiếm công khai! |
| 7 | `SeatHoldCreated` | `booking.seat-hold.created.v1` | `platform.events` | **Booking** (Ánh xạ trong `OutboxRouting` & AsyncAPI) | *(Chưa gắn queue trong MVP)* | Dự phòng cho phân tích phễu giữ ghế (Funnel Analytics) hậu MVP. |
| 8 | `SeatHoldExpired` | `booking.seat-hold.expired.v1` | `platform.events` | **Booking** (Đặc tả trong AsyncAPI & Schema) | *(Xử lý nội bộ qua `ExpireHoldsAsync`)* | Trong MVP, Booking dùng cơ chế Lazy Expiration ngay trên PostgreSQL trước mỗi truy vấn đọc/ghi. |
| 9 | `BookingCreated` | `booking.booking.created.v1` | `platform.events` | **Booking**: `BookingEvents.BookingCreatedAsync` (gọi từ `BookingService.CreateBookingAsync`) | 1. `payment.refund-requests.q`<br/>2. `notification.integration-events.q`<br/>3. `reporting.integration-events.q` | 1. **Payment**: `PaymentEventHandlers.HandleBookingCreatedAsync` -> Lưu bảng `booking_quotes` (tổng tiền, hạn thanh toán, tỷ lệ hoa hồng) để sẵn sàng tạo giao dịch.<br/>2. **Notification**: Lưu thông báo `"Booking created"`.<br/>3. **Reporting**: `ReportingEventHandlers.HandleAsync` -> Upsert `booking_projections` & `revenue_projections`. |
| 10 | `BookingPaid` | `booking.booking.paid.v1` | `platform.events` | **Booking**: Ghi trực tiếp vào `outbox_messages` trong transaction của `BookingRepository.ApplyPaidAsync` (hoặc `BookingEvents.BookingPaidAsync`) | 1. `notification.integration-events.q`<br/>2. `reporting.integration-events.q` | 1. **Notification**: Lưu thông báo `"Booking paid"`.<br/>2. **Reporting**: Cập nhật trạng thái đơn `PAID` và tính doanh thu ròng theo múi giờ `Asia/Ho_Chi_Minh`. |
| 11 | `BookingCancelled` | `booking.booking.cancelled.v1` | `platform.events` | **Booking**: `BookingEvents.BookingCancelledAsync` (gọi từ `BookingService.CancelAsync`) | 1. `payment.refund-requests.q`<br/>2. `notification.integration-events.q`<br/>3. `reporting.integration-events.q` | 1. **Payment**: `HandleRefundRequestAsync` (với `explicitRefund = false`: VNPay Sandbox tự hoàn phần còn lại nếu cần; SePay bỏ qua và chỉ chờ `RefundRequested` tường minh).<br/>2. **Notification**: Thông báo `"Booking cancelled"`.<br/>3. **Reporting**: Cập nhật `CANCELLED` và số đơn hủy. |
| 12 | `TicketIssued` | `booking.ticket.issued.v1` | `platform.events` | **Booking**: Ghi trực tiếp vào `outbox_messages` trong `BookingRepository.ApplyPaidAsync` (cả `PREPAID` lẫn `PAY_LATER`) | `notification.integration-events.q` | `NotificationEventHandlers.HandleAsync` -> Gửi thông báo `"Tickets issued - Your tickets are ready"` cho hành khách. |
| 13 | `TicketCancelled` | `booking.ticket.cancelled.v1` | `platform.events` | **Booking** (Khai báo trong `OutboxRouting` & AsyncAPI) | *(Dự phòng chi tiết từng vé)* | Trong MVP, thông tin danh sách vé hủy được gộp gọn trong luồng `BookingCancelled`. |
| 14 | `TicketCheckedIn` / `PassengerCheckedIn` | `booking.ticket.checked-in.v1` | `platform.events` | **Booking** (`OutboxRouting` map `"TicketCheckedIn"`; AsyncAPI đặt tên schema `PassengerCheckedIn`) | *(Dự phòng thống kê tỷ lệ lên xe)* | Phục vụ đối soát hành khách thực tế lên xe (No-show analytics). |
| 15 | `RefundRequested` | `booking.refund.requested.v1` | `platform.events` | **Booking**: `BookingEvents.RefundRequestedAsync` (khi khách hủy vé có tiền hoàn `preview.Refund > 0` HOẶC bù trừ tiền về trễ `PAYMENT_AFTER_BOOKING_CLOSED`) | `payment.refund-requests.q` | `PaymentEventHandlers.HandleRefundRequestAsync` (`explicitRefund = true`) -> Với VNPay Sandbox: thực thi `TryApplyRefundAsync` + đảo hoa hồng sàn + phát `RefundSucceeded`; với SePay: xếp hàng `QueueSePayRefundAsync` (`status = 'REQUESTED'`) chờ kế toán chuyển khoản hoàn tiền. |
| 16 | `PaymentSucceeded` | `payment.payment.succeeded.v1` | `platform.events` | **Payment**: `SePayPaymentStore.ApplySePayAsync` (ghi thẳng SQL Outbox trong tx) HOẶC `PaymentEvents.PaymentSucceededAsync` (VNPay webhook) | 1. `booking.payment-events.q`<br/>2. `notification.integration-events.q`<br/>3. `reporting.integration-events.q` | 1. **Booking**: `BookingEventHandlers.HandlePaymentAsync` -> `ApplyPaymentSucceededAsync` chốt đơn `PAID`, sinh vé QR (hoặc phát ngược `RefundRequested` nếu đơn đã hết hạn!).<br/>2. **Notification**: Thông báo `"Payment received"`.<br/>3. **Reporting**: Nhận qua wildcard `payment.payment.*.v1` (ghi Inbox rồi no-op vì doanh thu tính chuẩn từ `BookingFact`). |
| 17 | `PaymentFailed` | `payment.payment.failed.v1` | `platform.events` | **Payment** (Khai báo trong `OutboxRouting` & AsyncAPI) | 1. `booking.payment-events.q`<br/>2. `reporting.integration-events.q` | Nhận qua wildcard `payment.payment.*.v1` và bỏ qua an toàn (cho phép khách tạo lệnh thanh toán lại miễn là `SeatHold`/`Booking` chưa hết hạn 10 phút!). |
| 18 | `RefundSucceeded` | `payment.refund.succeeded.v1` | `platform.events` | **Payment**: `PaymentEvents.RefundSucceededAsync` (sau khi `TryApplyRefundAsync` thành công) | 1. `booking.payment-events.q`<br/>2. `reporting.integration-events.q` | 1. **Booking**: Nhận qua wildcard `payment.refund.*.v1` (ghi Inbox dedupe).<br/>2. **Reporting**: `ReportingEventHandlers.HandleAsync` -> `ReportingService.IngestRefundAsync` cộng dồn `refunded_amount` và trừ lùi `net_revenue` trên báo cáo! |
| 19 | `RefundFailed` | `payment.refund.failed.v1` | `platform.events` | **Payment** (Khai báo trong `OutboxRouting` & AsyncAPI) | 1. `booking.payment-events.q`<br/>2. `reporting.integration-events.q` | Dự phòng cảnh báo vận hành khi cổng thanh toán từ chối lệnh hoàn tiền tự động. |
| 20 | `PaymentCompensationRequested` | `booking.payment.compensation-requested.v1` | `platform.commands` | **Booking** (Command schema trong `platform-message.schema.json` & `definitions.json`) | `payment.refund-requests.q` | Kênh mệnh lệnh chuyên biệt cho bù trừ; trong code MVP hiện tại, Booking tận dụng luôn sự kiện chuẩn `RefundRequested` với mã lý do `"PAYMENT_AFTER_BOOKING_CLOSED"` chảy về cùng queue `payment.refund-requests.q`! |
| 21 | *(Command gửi thông báo trực tiếp)* | `notification.delivery.send.v1` | `platform.commands` | Hệ thống nội bộ (Định nghĩa sẵn trong `definitions.json`) | `notification.commands.q` | Kênh lệnh dành riêng cho yêu cầu gửi thông báo trực tiếp tới một chủ thể xác định. |

---

## 4. Giải Phẫu Phong Bì Chuẩn `EventMessage` & Hợp Đồng JSON Schema

Trong kiến trúc Microservices, nếu mỗi lập trình viên tự bịa ra một cấu trúc JSON riêng khi bắn tin lên RabbitMQ (người đặt là `id`, người đặt là `messageGuid`, người thiếu `correlationId`), các Consumer sẽ sụp đổ vì lỗi Deserialize. Do đó, dự án áp dụng kỷ luật **Contract-First (ADR-016)**: mọi thông điệp bắt buộc bọc trong một **Phong bì chuẩn (Standard Message Envelope)**.

### 4.1. Bản ghi C# `EventMessage` và Bộ Tiện Ích `EventPayload`

Hãy đọc toàn bộ nửa đầu tệp [EventMessage.cs](file:///C:/Users/minht/.gemini/antigravity/worktrees/PBL6/c_to_n_b/workspace/src/building-blocks/BusTicketPlatform.BuildingBlocks.Messaging/EventMessage.cs#L1-L60):

```csharp
using System.Text.Json;
using System.Text.Json.Serialization;

namespace BusTicketPlatform.BuildingBlocks.Messaging;

public sealed record EventMessage(
    Guid EventId,
    string EventType,
    int Version,
    DateTimeOffset OccurredAt,
    string Producer,
    Guid CorrelationId,
    Guid AggregateId,
    JsonElement Payload,
    string? CausationId = null,
    long? AggregateVersion = null,
    Guid? TenantId = null);

public static class EventMessageJson
{
    public static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };
}

public static class EventPayload
{
    public static T? Deserialize<T>(JsonElement payload) =>
        payload.ValueKind is JsonValueKind.Object or JsonValueKind.Array
            ? payload.Deserialize<T>(EventMessageJson.Options)
            : default;

    public static bool TryGuid(JsonElement payload, string name, out Guid value)
    {
        value = Guid.Empty;
        if (payload.ValueKind != JsonValueKind.Object || !payload.TryGetProperty(name, out var element))
        {
            return false;
        }

        if (element.ValueKind == JsonValueKind.String && Guid.TryParse(element.GetString(), out value))
        {
            return true;
        }

        return element.TryGetGuid(out value);
    }

    public static string String(JsonElement payload, string name, string fallback = "")
    {
        if (payload.ValueKind != JsonValueKind.Object || !payload.TryGetProperty(name, out var element))
        {
            return fallback;
        }

        return element.ValueKind == JsonValueKind.String ? element.GetString() ?? fallback : fallback;
    }
}
```

### 4.2. Đối chiếu Từng Trường C# `EventMessage` với `platform-message.schema.json` và AMQP `BasicProperties`

Khi `RabbitMqSmokeBus.PublishAsync` gửi một `EventMessage` lên mạng, thông tin được đặt ở **hai lớp**: lớp ngoài cùng là **AMQP Frame Headers (`BasicProperties`)** để Broker và công cụ giám sát đọc nhanh không cần giải nén JSON, và lớp bên trong là **JSON Body** tuân thủ nghiêm ngặt [platform-message.schema.json](file:///C:/Users/minht/.gemini/antigravity/worktrees/PBL6/c_to_n_b/docs/contracts/schemas/platform-message.schema.json#L31-L48):

| Trường trong C# `EventMessage` | Tên thuộc tính JSON (`camelCase`) | Ràng buộc trong `platform-message.schema.json` | Ánh xạ sang AMQP `BasicProperties` (`RabbitMqSmokeBus.cs`) | Ý nghĩa kỹ thuật cốt lõi trong Hệ thống Phân tán |
|---|---|---|---|---|
| `Guid EventId` | `"eventId"` | **Bắt buộc (`required`)**, `format: "uuid"` | `properties.MessageId = message.EventId.ToString()` | Định danh duy nhất toàn cầu (UUIDv7 sắp xếp theo thời gian) của riêng lần phát sự kiện này. Là khóa chính logic để `InboxDeduper` chống xử lý trùng lặp tại mọi Consumer! |
| `string EventType` | `"eventType"` | **Bắt buộc**, `type: "string"` (PascalCase) | `properties.Type = message.EventType` | Cho Consumer biết cách phân nhánh xử lý (`switch (message.EventType)`) và cho `OutboxRouting.KeyFor` suy ra Routing Key. |
| `int Version` | `"version"` | **Bắt buộc**, `const: 1` | `Headers["schema-version"] = message.Version` | Phiên bản cấu trúc Schema của Payload. Khi nâng cấp không tương thích ngược, tăng lên `2` để Consumer biết cách đọc song song hai phiên bản. |
| `DateTimeOffset OccurredAt` | `"occurredAt"` | **Bắt buộc**, `format: "date-time"` (ISO 8601 UTC) | *(Nằm trong JSON Body)* | Thời điểm nghiệp vụ **thực sự xảy ra** tại Producer (khác với thời điểm tin nhắn đến tay Consumer, vì Outbox hoặc Queue có thể trễ vài giây!). |
| `string Producer` | `"producer"` | **Bắt buộc**, độ dài `2..80` ký tự | *(Nằm trong JSON Body)* | Tên định danh dịch vụ phát tin (`"identity-service"`, `"transport"`, `"booking"`, `"payment"`) phục vụ truy vết nguồn gốc. |
| `Guid CorrelationId` | `"correlationId"` | **Bắt buộc**, `format: "uuid"` | `properties.CorrelationId = message.CorrelationId.ToString()` | **Sợi chỉ đỏ truy vết đầu-cuối (Distributed Tracing)**: Bắt đầu từ HTTP Header `X-Correlation-Id` tại YARP API Gateway, truyền vào Service đầu tiên, chảy qua Outbox -> RabbitMQ -> Consumer -> Outbox kế tiếp. Gõ 1 `CorrelationId` vào hệ thống log là thấy toàn bộ hành trình qua 6 microservices! |
| `string? CausationId` | `"causationId"` | Tùy chọn (`null` hoặc chuỗi `<= 128` ký tự); ẩn khi `null` nhờ `WhenWritingNull` | *(Nằm trong JSON Body)* | Ghi lại ID của **nguyên nhân trực tiếp** sinh ra sự kiện này (ví dụ: Sự kiện `BookingPaid` được sinh ra trực tiếp bởi sự kiện `PaymentSucceeded` có ID là `X`, trong khi cả hai vẫn mang chung một `CorrelationId` gốc!). |
| `Guid AggregateId` | `"aggregateId"` | **Bắt buộc**, `format: "uuid"` | *(Nằm trong JSON Body)* | Khóa chính của thực thể nghiệp vụ gốc (`UserId`, `TripId`, `BookingId`, `PaymentId`). |
| `long? AggregateVersion` | `"aggregateVersion"` | Tùy chọn (`integer >= 0` hoặc `null`) | *(Nằm trong JSON Body)* | Phiên bản tuần tự (`RowVersion` / `PublishedVersion`) của thực thể gốc. Giúp Consumer nhận biết sự kiện đến muộn (Out-of-order): ví dụ trong `BookingRepository.ImportTripAsync` dòng 28 dùng `GREATEST(trip_snapshots.source_trip_version, EXCLUDED.source_trip_version)`. |
| `Guid? TenantId` | `"tenantId"` | Tùy chọn (`format: "uuid"` hoặc `null`) | *(Nằm trong JSON Body)* | Mã `OrganizationId` của nhà xe sở hữu chuyến/đơn vé trong kiến trúc Multi-tenant. |
| `JsonElement Payload` | `"payload"` | **Bắt buộc**, `type: "object"` | `body` (UTF-8 JSON bytes, `ContentType = "application/json"`) | Dữ liệu chi tiết của sự kiện. Dùng `JsonElement` giúp tầng `BuildingBlocks.Messaging` không bị phụ thuộc ngược vào bất kỳ class DTO miền nào của 6 services (đúng chuẩn Clean Architecture)! |

> [!IMPORTANT]
> **Tại sao `EventPayload` trong `EventMessage.cs` lại viết các hàm đọc phòng thủ `TryGuid` và `String` thay vì luôn ép kiểu cứng `Deserialize<T>`?**
> Hãy nhìn cách `PaymentEventHandlers`, `NotificationEventHandlers` và `ReportingEventHandlers` đọc dữ liệu: trong thực tế tiến hóa Microservices (Tolerant Reader Pattern — Martin Fowler), một Consumer như `Notification` chỉ cần đúng 1 trường `userId` hoặc `customerId` trong một gói tin lớn gồm 18 trường của `BookingPaid`! Việc đọc chọn lọc bằng `EventPayload.TryGuid(payload, "customerId", out var userId)` vừa siêu nhanh (Zero-allocation không cần cấp phát object trung gian), vừa miễn nhiễm hoàn toàn khi `Booking Service` thêm bớt các trường tài chính khác trong Payload!

### 4.3. Bằng chứng Kiểm thử Hợp đồng Tự động bằng `JsonSchema.Net`

Để đảm bảo code C# không bao giờ phát ra gói tin lệch khỏi tài liệu thiết kế `platform-message.schema.json` (tránh tình trạng "tài liệu một đằng, code chạy một nẻo"), bài kiểm thử tích hợp [MessagingSmokeTests.cs](file:///C:/Users/minht/.gemini/antigravity/worktrees/PBL6/c_to_n_b/workspace/src/tests/messaging/BusTicketPlatform.Messaging.IntegrationTests/MessagingSmokeTests.cs#L157-L163) kéo thẳng mảng byte thực tế nhận từ container RabbitMQ đem chấm điểm với tệp JSON Schema gốc:

```csharp
private static void AssertValidEnvelope(ReadOnlyMemory<byte> body)
{
    var node = JsonNode.Parse(body.Span);
    var schema = JsonSchema.FromFile(Path.Combine(RepoRoot(), "docs", "contracts", "schemas", "platform-message.schema.json"));
    var result = schema.Evaluate(node, new EvaluationOptions { OutputFormat = OutputFormat.List });
    Assert.True(result.IsValid);
}
```

Nhờ cấu hình `DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull` trong `EventMessageJson.Options` và `"additionalProperties": false` trong `platform-message.schema.json`, nếu bất kỳ ai vô tình viết sai tên trường hoặc thừa trường lạ trong `EventMessage`, bài test tích hợp trên CI sẽ đỏ ngay lập tức!

---

## 5. Câu Hỏi Vấn Đáp Thực Chiến Trước Hội Đồng (Q&A Bài 01)

### Câu 1: *"Tại sao Exchange `platform.events` không đặt tên là `platform.events.v1` mà lại nhét `.v1` vào cuối từng Routing Key?"*
- **Trả lời**: Nếu nhét version vào tên Exchange (`platform.events.v1`), mỗi khi chỉ có **1 trong 20 sự kiện** cần nâng cấp lên `v2`, nhóm sẽ phải dựng lại Exchange mới hoặc sửa cấu hình kết nối của toàn bộ các Producer/Consumer khác. Đặt tên Exchange bất biến `platform.events` và đưa hậu tố `.v1` vào cuối `Routing Key` (`booking.booking.paid.v1`) kết hợp trường `"version": 1` trong Envelope cho phép nâng cấp từng loại sự kiện hoàn toàn độc lập: Producer có thể phát song song `.v1` và `.v2` trên cùng một Exchange trong giai đoạn chuyển giao mà không ảnh hưởng các dịch vụ còn lại ([02-01-06-message-broker.md](file:///C:/Users/minht/.gemini/antigravity/worktrees/PBL6/c_to_n_b/docs/system-design/02-01-system-architecture/02-01-06-message-broker.md#L19)).

### Câu 2: *"Khi một sự kiện `BookingCreated` được phát ra, có mấy bản sao tin nhắn nằm trong RabbitMQ? Nếu `Reporting Service` bị tắt mất 1 tiếng thì `Payment Service` có bị nghẽn không?"*
- **Trả lời**: Khi `BookingCreated` (`booking.booking.created.v1`) đi vào `platform.events`, Exchange đối chiếu bảng Binding và nhân bản thành **3 bản sao độc lập** bỏ vào 3 hàng đợi riêng biệt: `payment.refund-requests.q`, `notification.integration-events.q`, và `reporting.integration-events.q`. Nếu `Reporting Service` bị tắt 1 tiếng, chỉ có hàng đợi `reporting.integration-events.q` tích lũy tin nhắn trên đĩa; `Payment Service` đọc trên hàng đợi riêng `payment.refund-requests.q` nên rút tin nhắn xử lý dưới 5ms bình thường, không bị ảnh hưởng dù chỉ 1%.

### Câu 3: *"Giả sử lập trình viên sửa code `NotificationEventHandlers` bị bug chia cho 0 (`DivideByZeroException`) khi đọc tin nhắn. Tin nhắn đó đi về đâu? Có làm treo RabbitMQ không?"*
- **Trả lời**: Không bao giờ treo RabbitMQ! Trong `IntegrationEventConsumerHost.PumpAsync` ([IntegrationEventConsumerHost.cs](file:///C:/Users/minht/.gemini/antigravity/worktrees/PBL6/c_to_n_b/workspace/src/building-blocks/BusTicketPlatform.BuildingBlocks.Messaging/IntegrationEventConsumerHost.cs#L89-L93)), khối `catch` bắt ngoại lệ, ghi log lỗi kèm loại sự kiện và gọi `bus.RejectAsync(delivered.Value.DeliveryTag, requeue: false, stoppingToken)`. Vì `requeue: false` và hàng đợi `notification.integration-events.q` có gắn `"x-dead-letter-exchange": "platform.dlx"`, RabbitMQ lập tức chuyển phát gói tin đó qua `platform.dlx` (khớp wildcard `#`) vào kho cách ly `booking.trip-events.dlq`. Luồng tiêu thụ các tin nhắn kế tiếp tiếp tục chạy thông suốt.

### Câu 4: *"Sự khác nhau giữa `CorrelationId` và `EventId` trong `EventMessage` là gì?"*
- **Trả lời**:
  - `EventId` là định danh duy nhất của **riêng một thông điệp cụ thể** (mỗi lần `Enqueue` tạo mới một UUIDv7). Nó dùng làm khóa chống trùng lặp (`message_id`) trong bảng `inbox_messages`.
  - `CorrelationId` là mã nhận diện của **toàn bộ phiên giao dịch nghiệp vụ xuyên biên giới** kể từ cú click chuột đầu tiên của người dùng (hoặc Webhook từ cổng thanh toán). Một luồng thanh toán đi qua 4 sự kiện (`PaymentSucceeded` -> `BookingPaid` + `TicketIssued` -> Notification/Reporting) sẽ sinh ra 3 `EventId` khác nhau nhưng **cùng mang chung một `CorrelationId`** để phục vụ truy vết nhật ký phân tán (Distributed Tracing).

---

> **Bước tiếp theo**: Bây giờ chúng ta đã hiểu cách RabbitMQ phân loại và vận chuyển thư. Nhưng một câu hỏi sinh tử xuất hiện: **Làm sao đảm bảo khi `Payment Service` lưu lệnh `UPDATE payments SET status = 'SUCCEEDED'` vào PostgreSQL, tin nhắn `PaymentSucceeded` chắc chắn 100% cũng được gửi lên RabbitMQ dù máy chủ sập nguồn ngay mili-giây kế tiếp?** Hãy bước sang [Bài 02: Bài Toán Ghi Kép (Dual-Write) & Cơ Chế Transactional Outbox / Idempotent Inbox](file:///C:/Users/minht/.gemini/antigravity/worktrees/PBL6/c_to_n_b/docs/cam-nang-thuyet-trinh-toan-dien/06-rabbitmq-outbox-inbox-va-saga/02-bai-toan-dual-write-va-transactional-outbox-inbox.md)!
