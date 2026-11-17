# Kiểm thử bảo mật BLUE — 16/11/2026

**Kết luận: chưa đủ an toàn để triển khai công khai.** Có lỗi cho phép phát hành vé bằng thông báo thanh toán giả trên cổng service, khóa JWT mặc định đang được sử dụng, và lỗi phân vùng dữ liệu nhà xe. Việc có `bookingId` trong URL tự nó không chứng minh lỗ hổng; các vấn đề xác nhận ở dưới là những đường tấn công khác.

Đối chiếu [OWASP API Security Top 10 2023](https://api-security.owasp.org/editions/2023/en/0x11-t10/). Đây là kiểm thử mã nguồn, cấu hình và các ca thực thi trong phạm vi ghi dưới đây, không phải chứng nhận tuân thủ hay cam kết đã tìm hết lỗ hổng.

## Phạm vi và phương pháp

- Mã nguồn nền: `0e0f9813`, nhánh `codex/baseline-0c9cf258-sepay`.
- Kiểm kê 117 operation từ OpenAPI đang chạy của Identity, Transport, Booking, Payment, Notification, Reporting. Kiểm kê không có nghĩa từng operation đã được kiểm tra hết mọi thuộc tính và mọi vai trò.
- Chạy toàn bộ test frontend và các bộ backend/integration/architecture/gateway hiện có. Các ca ghi dữ liệu dùng PostgreSQL Testcontainers tách biệt và dữ liệu tổng hợp; không ghi giao dịch hay đơn giả vào dữ liệu web đang sử dụng.
- Chạy ma trận Postman 68 yêu cầu không đăng nhập qua gateway thật `localhost:5080`; body rỗng và ID tổng hợp. Chạy thêm 21 probe chỉ đọc/kiểm tra từ chối trên Docker thật.
- Đọc luồng xác thực, quyền sở hữu, quyền nhà xe, IPN, callback, truy vấn, hạn mức và cấu hình cổng. Không chuyển tiền, không mô phỏng thành công trên đơn thật, không chạy DoS hoặc quét ngoài hệ thống của dự án.
- Không thay đổi giao diện hoặc logic ứng dụng. Thêm 5 ca hồi quy bảo mật; hiện cả 5 đều đỏ vì kiểm tra hành vi an toàn mà ứng dụng chưa đáp ứng.

## Kết quả thực thi

| Bộ kiểm tra | Kết quả cuối | Exit code / lưu ý |
|---|---|---|
| Backend có sẵn, gồm gateway và architecture | 142 qua / 143 | 1 lỗi Transport: cập nhật version cũ trả 500 thay vì 409 |
| 5 ca bảo mật mới | 0 qua / 5 | Exit 1; tái hiện lỗi thực tế, không bỏ qua assertion |
| Frontend Vitest | 1474 qua / 1480, 182 file qua / 188 | Exit 1; 6 ca lỗi liệt kê bên dưới |
| Postman ma trận quyền hiện tại | 68 qua / 68 | Exit 0; target Docker thật, không phải mock |
| Probe bổ sung | 19 qua / 21 | Exit 1; hai URL service/gateway tái hiện cùng lỗi open redirect |
| NuGet dependency scan | Không tìm thấy advisory trong kết quả | Không đồng nghĩa không có lỗi chưa công bố |
| pnpm dependency scan | 1 high, 1 moderate | Exit 1; cần phân biệt cây dependency với runtime nginx |

Lượt `dotnet test` solution đầu gặp khóa DLL gateway do tiến trình dev đang chạy. Đã build và chạy lại riêng gateway/architecture bằng `Release`: 10/10 và 16/16 qua. Không dừng web dev. Thử build sang thư mục Temp làm 3 test tìm workspace lỗi; kết quả cuối đã thay bằng lượt chạy Release trong cây workspace. Không tính các lượt thử/lặp vào tổng cuối.

Collection Postman cũ có một assertion lỗi thời: `GET /admin/organizations` mong 405 nhưng operation hiện tồn tại và trả 401 khi thiếu token. Giữ nguyên collection cũ, tạo `BLUE_OWASP_Protected_Endpoints.postman_collection.json` sửa đúng assertion này rồi chạy lại 68/68. Điều này không sửa hoặc che lỗi phân quyền của ứng dụng.

## Các phát hiện ưu tiên

### F01 — Critical: endpoint nội bộ cho phép giả thanh toán, phát hành vé

**Đã tái hiện HTTP + PostgreSQL tách biệt.** Một khách tạo đơn `PREPAID/PENDING_PAYMENT`. Client hoàn toàn không có bearer token gửi `POST /api/v1/internal/payments/succeeded` với booking ID, payment ID tùy ý và số tiền/currency đúng của đơn. Kết quả: **204, đơn `PAID`, 1 vé được phát hành**, không cần SePay xác nhận.

Nguồn: `BookingEndpoints.cs` ánh xạ internal route không yêu cầu xác thực; `BookingService.ApplyPaymentSucceededAsync` chỉ kiểm tra đơn, kênh, số tiền, currency, không xác thực người gửi sự kiện.

Điều kiện khai thác đã chứng minh: truy cập trực tiếp API Booking. Docker đang publish cổng `5083` trên `0.0.0.0` và IPv6. Khả năng máy khác truy cập phụ thuộc firewall; chưa kiểm thử từ Internet. Không được suy diễn rằng tunnel frontend hiện tự động expose mọi cổng backend.

Cùng lớp lỗi: `POST /internal/projections/bookings` trên Reporting chấp nhận ghi không đăng nhập, tái hiện 204. Các route import trip, quote, inventory-ready, notification ingestion cũng không có authentication ở mã ánh xạ; chưa thực hiện ghi thử toàn bộ các route này.

Khắc phục: đóng cổng internal khỏi host/public, bỏ HTTP ingestion nếu chỉ cần broker; nếu cần HTTP thì yêu cầu danh tính service riêng và quyền tối thiểu/mTLS hoặc chữ ký có chống replay. Chỉ tin sự kiện từ payment service đã xác thực, không cho JWT khách hàng thay thế danh tính service. Thêm regression test cho từng ingestion endpoint.

### F02 — Critical: runtime đang dùng khóa ký JWT mặc định của repository

**Đã xác nhận cấu hình container, chỉ lưu boolean, không ghi khóa thật vào báo cáo.** Identity, Booking và Payment đang dùng đúng giá trị fallback được hardcode trong repository, dù `ASPNETCORE_ENVIRONMENT=Production`. Khóa đã biết khiến chữ ký JWT mất giá trị bảo đảm danh tính ở các service chỉ kiểm tra chữ ký/claims. Không cần lấy khóa SePay để khai thác vấn đề này. Không thực hiện giả mạo tài khoản thật hay tải dữ liệu người khác để chứng minh thêm.

Nguồn: `PlatformJwtExtensions.cs`, Identity `Program.cs`, `docker-compose.apps.yml`. Bằng chứng: `config-observations.json`.

Khắc phục: thay bằng khóa ngẫu nhiên mạnh ngoài Git, đồng bộ issuer/verifier, vô hiệu các token cũ; ứng dụng phải từ chối khởi động Production nếu thiếu hoặc dùng khóa mẫu. Nên dùng ký bất đối xứng để service chỉ xác minh không giữ khả năng phát hành token.

### F03 — High: nhà xe thiếu organization được hiểu là toàn nền tảng

**Đã tái hiện trên Booking và Reporting.** Token test có `OPERATOR_ADMIN` nhưng không có claim `org` gọi `/api/v1/operator/bookings`: **200**, có đơn và thông tin liên hệ từ nhiều organization tổng hợp. Token `OPERATOR_FINANCE` thiếu `org` gọi báo cáo: **200**, đọc các fact thuộc nhiều organization.

Các token persona chỉ được ký bằng khóa test của Testcontainers. Điều này chứng minh service không fail closed khi thiếu tenant; chưa chứng minh một khách bình thường có thể tự lấy role nhà xe hợp lệ qua Identity. F02 làm tăng rủi ro trong cấu hình hiện tại.

Nguyên nhân: nhánh dành cho operator truyền `actor.OrganizationId == null` vào repository, trong khi `null` có nghĩa không giới hạn organization. Payment search/refund/settlement có cùng mẫu qua đọc mã, chưa thêm ca HTTP tái hiện riêng cho Payment.

Khắc phục: role operator bắt buộc organization hợp lệ; thiếu claim phải 403 trước khi query. Chỉ vai trò platform rõ ràng được phép scope toàn hệ thống. Áp dụng nhất quán cho list, detail, export, refund và report.

### F04 — Medium: logout không thu hồi access token

**Đã tái hiện với register → OTP → token thật → logout trong Identity test server.** Logout trả 204, sau đó dùng lại access token gọi `/api/v1/users/me` vẫn **200**, test mong 401. Refresh session bị thu hồi nhưng validation access token không kiểm tra session `sid`; logout không tăng authorization version. Access token mặc định còn hiệu lực tối đa khoảng 15 phút, cộng clock skew.

Đây là khoảng thời gian token đã lộ còn dùng được sau logout; không có nghĩa token tự lộ qua URL. Nếu thiết kế chủ đích cho access token sống đến expiry thì phải ghi rõ chính sách; với mong muốn thu hồi ngay cần session/version check hoặc denylist chung. Các service dùng `AddPlatformJwt` cũng không kiểm tra user bị khóa/version đã đổi; tác động cross-service của thao tác khóa tài khoản hiện mới xác nhận qua mã, chưa tái hiện token thật xuyên service.

### F05 — Medium: callback VNPay cũ là open redirect

**Đã tái hiện không thay đổi dữ liệu.** `GET /integrations/payments/vnpay/return?vnp_ReturnUrl=https%3A%2F%2Fexample.invalid%2Fphishing` trả **302 Location: https://example.invalid/phishing** ở Payment 5084 và gateway 5080, dù provider callback không hợp lệ. `ReturnAsync` bỏ qua kết quả validation trước khi redirect tới URI bất kỳ.

Frontend Docker 5173 hiện trả SPA 200 cho đường này, không redirect; không gọi đó là lỗi open redirect ở frontend hiện tại. Tuy nhiên cấu hình nginx trong checkout hiện có proxy `/integrations/`, nên một lần build sau có thể làm đường lỗi lộ qua frontend. Đây là redirect trên browser, không phải bằng chứng SSRF phía server.

Khắc phục: gỡ callback provider đã ngừng dùng hoặc trả 4xx; callback hợp lệ chỉ chuyển tới đích cấu hình/đã ký, không lấy URL tùy ý từ query. Giữ nguyên bridge SePay có HMAC và giới hạn loopback thay vì dùng lại callback cũ.

### F06 — High nếu mở ra mạng: bề mặt triển khai dành cho phát triển

Docker publish gateway, sáu API và các web trên mọi interface. Mailpit 8025/1025 cũng mở mọi interface, trong khi đây là nơi chứa thư xác minh/reset của môi trường thử nghiệm. OpenAPI của cả sáu service truy cập được không đăng nhập. Chưa thử vượt firewall hoặc đọc nội dung mailbox. Không kết luận mọi endpoint OpenAPI công khai tự nó là lỗ hổng.

Khắc phục: service nội bộ chỉ dùng Docker network; nếu cần debug thì bind `127.0.0.1`. Mailpit, pgAdmin và tài khoản mẫu chỉ có trong dev profile. Public chỉ expose gateway/frontend cần thiết qua HTTPS. pgAdmin hiện đã bind loopback, không xóa công cụ này.

## Khoảng trống và khuyến nghị chưa phải exploit đã xác nhận

- API4/API6: gateway chưa có giới hạn chung theo IP/tài khoản; ticket lookup dùng fixed window chung 40/phút, không partition theo người dùng. Có lockout đăng nhập theo tài khoản và giới hạn kích thước một số request/list. Chưa chạy tải lớn hoặc tấn công giữ chỗ tự động, nên chưa khẳng định ngưỡng DoS hay khả năng chiếm hết ghế. Cần quota active holds và email/OTP theo chính sách kinh doanh, rate limit có partition và trusted proxy đúng.
- Frontend có `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy; preflight origin không tin cậy không được cấp `Access-Control-Allow-Origin`. Chưa có CSP: đây là thiếu lớp giảm thiểu XSS, không phải bằng chứng XSS đã khai thác.
- `pnpm audit`: `body-parser` high [GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828), `minimatch` moderate [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). Body-parser đi qua cây React Router/Express, không phải API ASP.NET. Runtime frontend Docker phục vụ static bằng nginx; cần đánh giá riêng nếu dùng Node SSR/dev server ra mạng. Chưa cập nhật dependency trong lượt kiểm thử này.

## Đối chiếu 10 nhóm OWASP

| Nhóm | Bằng chứng / trạng thái trong phạm vi |
|---|---|
| API1 Object authorization | Test che giấu booking/ticket khách khác qua; F03 lỗi scope operator. Không tuyên bố mọi ID ở mọi API đều an toàn. |
| API2 Authentication | Lockout, OTP, refresh reuse qua; F02 khóa mặc định; F04 logout vẫn chấp nhận access token. |
| API3 Property authorization | Test tên/số hành khách, giá server, preference avatar active content, lookup không lộ contact qua; chưa fuzz mọi DTO/field. |
| API4 Resource consumption | Đọc rate limiter, pagination và dependency audit; thiếu kiểm thử tải/quota phân tán. |
| API5 Function authorization | 68 yêu cầu qua gateway được từ chối đúng; F01 internal writes không được bảo vệ ở service. |
| API6 Sensitive business flows | Test giữ ghế đồng thời, đặt nhiều ghế, expiry, coupon, IPN trùng, phát hành vé/refund qua; chưa đánh giá chống bot ở quy mô lớn. |
| API7 SSRF | Chưa thấy URL tùy ý được server fetch trong các đường thanh toán đã đọc; chưa thực hiện DNS rebinding/OAST/network policy test. Không đánh dấu nhóm này đã đạt. |
| API8 Misconfiguration | F02/F06, kiểm tra header/CORS; không đánh giá TLS production vì target localhost. |
| API9 Inventory | Lưu inventory 117 operation; F05 callback provider cũ vẫn hoạt động; schema/docs hiện hữu nhưng không chứng minh đầy đủ endpoint động. |
| API10 Unsafe API consumption | Test IPN sai secret, amount, currency/state, transaction reuse, concurrency, rollback, late payment, coupon và refund qua. Không chuyển tiền thật hoặc kiểm tra hạ tầng SePay bên ngoài. |

## Lỗi chức năng / giao diện phát hiện cùng lượt

1. Transport: sửa organization bằng version đã cũ trả 500 thay vì 409 — `Admin_can_save_original_organization_profile_fields_with_version_check`.
2. Home test mong 4 card nhưng hiện render 6: có thể assertion cũ sau thay đổi nội dung; cần đối chiếu yêu cầu trước khi sửa UI.
3. NotificationBell CSS dùng `outline: none`, vi phạm kiểm tra accessibility hiện hành; cần xác minh focus replacement bằng keyboard/browser.
4. TripResultsPage CSS có màu/shadow literal, vi phạm token contract.
5. SEO test mong prerender `['/']` nhưng config hiện `false` — lệch hợp đồng test/config.
6. Hai ca admin loading thiếu `aria-busy="true"` trên vùng status.

Các test unit/frontend không thay thế review ảnh/keyboard/thiết bị thật. Chưa chạy toàn bộ Playwright E2E: cấu hình mặc định tái sử dụng cổng 5173 đang là Docker live, trong khi suite khai báo mock; chạy nguyên trạng sẽ trộn môi trường và có nguy cơ ghi vào dữ liệu đang dùng.

## Chạy lại

Từ thư mục repository, với Docker đang chạy:

```powershell
python workspace/scripts/security/live-readonly-audit.py
postman collection run workspace/postman/BLUE_OWASP_Protected_Endpoints.postman_collection.json
dotnet test workspace/src/tests/booking/BusTicketPlatform.Booking.Api.IntegrationTests --filter Category=SecurityAudit
dotnet test workspace/src/tests/reporting/BusTicketPlatform.Reporting.Api.IntegrationTests --filter Category=SecurityAudit
dotnet test workspace/src/tests/identity/BusTicketPlatform.Identity.Api.IntegrationTests --filter Category=SecurityAudit
```

Frontend, trong `workspace/src/apps/web`:

```powershell
node node_modules/vitest/vitest.mjs run
```

`live-readonly-audit.py` trả exit 1 khi còn lỗi, không dùng status 200 làm tiêu chí đạt chung. Inventory và probe có thể ghi đè bằng chứng khi chạy lại. `collect-audit-evidence.py` thu thập kết quả từ Temp; không chứa credential. Từ đợt dọn ngày 17/11, script dùng độc lập với collection lịch sử; collection hiện hành `BLUE_OWASP_Protected_Endpoints.postman_collection.json` được giữ trực tiếp trong source.

Bằng chứng: `dotnet-test-summary.json`, `frontend-test-results.txt`, `postman-current-results.txt`, `live-probes.json`, `endpoint-inventory.json`, `config-observations.json`, hai file dependency audit. Các finding chưa được sửa trong lượt này; cần sửa rồi chạy lại các ca đỏ trước khi xem là đạt.
