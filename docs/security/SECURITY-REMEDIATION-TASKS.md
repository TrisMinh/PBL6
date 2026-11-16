# Task: khắc phục bảo mật BLUE sau kiểm thử OWASP

Ngày lập: 16/11/2026. Trạng thái: **chưa triển khai sửa lỗi**.

## Mục tiêu và tài liệu bàn giao

Sửa các lỗi đã xác nhận, bổ sung kiểm thử cho các khoảng trống, giữ nguyên giao diện hiện tại và luồng đặt vé/SePay/coupon đang hoạt động. Không chỉ che lỗi ở frontend: phải sửa quyền truy cập, trạng thái và dữ liệu phía backend.

- [Báo cáo kiểm thử và bằng chứng](owasp-api-2026-11-16/README.md).
- [Kết quả backend](owasp-api-2026-11-16/dotnet-test-summary.json), [frontend](owasp-api-2026-11-16/frontend-test-results.txt), [probe HTTP](owasp-api-2026-11-16/live-probes.json).
- [Inventory 117 operation](owasp-api-2026-11-16/endpoint-inventory.json), [cấu hình đã quan sát](owasp-api-2026-11-16/config-observations.json).
- Nền kiểm thử: commit `0e0f9813`, nhánh `codex/baseline-0c9cf258-sepay`. **Đọc trạng thái Git mới nhất trước khi làm; không reset về commit này.**
- Test bảo mật mới và các tài liệu có thể còn chưa commit. Giữ lại thay đổi này và thay đổi của người dùng.

## Quy tắc thực hiện

- Giữ nguyên layout, hình ảnh, animation và tương tác đã được duyệt. Chỉ sửa UI khi liên quan trực tiếp đến lỗi được liệt kê, giữ hình thức hiện tại.
- Không xóa/reset database, volume, lịch sử đặt vé, coupon, cấu hình SePay hoặc pgAdmin. Không dọn container ngoài phạm vi công việc.
- Không in/commit secret, access token, OTP hoặc dữ liệu cá nhân thật. Không đổi khóa SePay khi đang sửa khóa JWT.
- Test có ghi dữ liệu dùng Testcontainers hoặc môi trường riêng. Không giả thanh toán thành công trên đơn thật, không chuyển tiền thật.
- Làm và kiểm tra local trước. Sau khi hoàn thành cả đợt mới build Docker một lần, chạy smoke test trên bản đó.
- Không bỏ test, đổi assertion để chấp nhận lỗ hổng hoặc đánh dấu hoàn thành chỉ vì API trả 200.
- Từng task phải ghi tệp đã sửa, lệnh kiểm thử, kết quả và phần còn thiếu. Phát hiện mới phải có bằng chứng và điều kiện khai thác.

## Bắt đầu phiên tiếp theo

- [ ] Đọc báo cáo, kiểm tra `git status`, branch/HEAD và diff đang có; xác định service dev/Docker đang chạy.
- [ ] Chạy lại 5 ca `Category=SecurityAudit` trên database tách biệt để xác nhận baseline hiện tại.
- [ ] Xác minh cấu hình runtime bằng kết quả boolean; không xuất giá trị secret. Các quan sát ngày 16/11 có thể đã thay đổi.

## P0 — chặn đường giả thanh toán và khóa ký mặc định

### SEC-01 — bảo vệ toàn bộ HTTP ingestion nội bộ (F01)

- [ ] Kiểm tra Booking internal trip import/payment succeeded, Payment quote, Transport inventory-ready, Notification ingestion và Reporting projection ingestion.
- [ ] Nếu endpoint không cần vì đã dùng broker thì gỡ đường HTTP; nếu cần thì yêu cầu danh tính service, quyền tối thiểu và cơ chế chống replay phù hợp.
- [ ] Không chấp nhận bearer token CUSTOMER/operator/platform thông thường như danh tính service. Không chỉ dựa vào tên đường dẫn `/internal` hoặc việc ẩn trên UI.
- [ ] Cập nhật sender hợp lệ, test fixture và luồng broker; không làm đứt trip publication → inventory → booking → payment → ticket → notification/reporting.
- [ ] Bổ sung ca âm cho từng ingestion endpoint: anonymous, token khách, sai service, sai chữ ký, replay hoặc sự kiện sai dữ liệu.

**Hoàn thành khi:** yêu cầu giả không đổi trạng thái đơn hoặc phát hành vé; bị từ chối 401/403 hoặc route đã gỡ trả 404. Sự kiện hợp lệ từ payment service vẫn xử lý đúng một lần; IPN trùng không tạo thêm vé/settlement/outbox. Hai ca audit Booking/Reporting về anonymous writes phải qua. Fixture tạo dữ liệu qua endpoint nội bộ phải sử dụng cơ chế service auth mới thay vì tiếp tục gọi anonymous.

### SEC-02 — thay khóa JWT và chặn cấu hình mẫu trong Production (F02)

- [ ] Sinh khóa riêng mạnh ngoài Git, đồng bộ Identity/gateway/các service xác minh JWT; cân nhắc ký bất đối xứng để verifier không giữ quyền ký token.
- [ ] Bỏ fallback khóa mẫu trong Production; fail startup nếu thiếu, yếu hoặc dùng giá trị mẫu đã biết.
- [ ] Luân chuyển khóa runtime và vô hiệu token cũ; ghi rõ người dùng phải đăng nhập lại. Không đưa khóa mới vào log, ảnh hoặc tài liệu.
- [ ] Test token ký bằng khóa cũ/mẫu, sai issuer/audience, hết hạn và chữ ký bị sửa đều bị từ chối; token mới hợp lệ vẫn hoạt động.

**Hoàn thành khi:** toàn bộ runtime không dùng khóa mặc định; cấu hình Production sai không thể khởi động; đăng nhập và đặt vé bằng token mới thành công xuyên service.

## P1 — cách ly dữ liệu và thu hẹp bề mặt truy cập

### SEC-03 — bắt buộc organization cho quyền nhà xe (F03)

- [ ] Booking/Reporting: thiếu organization phải fail closed trước khi query, không được chuyển thành scope toàn nền tảng.
- [ ] Kiểm tra cùng mẫu ở Payment search/refunds/settlements và các list/detail/export/report liên quan.
- [ ] Kiểm tra Identity không phát token operator thiếu organization hợp lệ; service vẫn phải tự bảo vệ kể cả khi claim thiếu hoặc cũ.
- [ ] Thêm dữ liệu ít nhất hai nhà xe và ma trận customer/operator A/operator B/driver/platform: thiếu org, sai org, đúng org, vai trò kết hợp.

**Hoàn thành khi:** operator thiếu org nhận 403; operator A không đọc/sửa/xuất dữ liệu B; chỉ vai trò platform được cấp rõ ràng có quyền toàn nền tảng. Hai ca audit tenantless Booking/Reporting và ca mới ở Payment phải qua.

### SEC-04 — đóng cổng backend và công cụ dev khỏi mạng công khai (F06)

- [ ] API nội bộ giao tiếp qua Docker network; nếu cần debug trên máy thì chỉ bind `127.0.0.1`.
- [ ] Mailpit SMTP/UI chỉ dùng profile dev và loopback. Giữ pgAdmin để người dùng xem data, giữ volume và cấu hình; không xóa công cụ này.
- [ ] Phân biệt frontend/gateway công khai với internal service. Kiểm tra cả IPv4, IPv6, tunnel và reverse proxy.
- [ ] Quyết định quyền truy cập Swagger/OpenAPI theo môi trường, không làm hỏng tài liệu và công cụ phát triển local.

**Hoàn thành khi:** port bindings đúng với mục đích; bên ngoài không truy cập được internal ingestion/mailbox/dev tools; frontend và gateway cần thiết vẫn hoạt động. Không tuyên bố đã kiểm tra Internet nếu chỉ thử từ localhost.

### SEC-05 — thu hồi access token nhất quán (F04)

- [ ] Xác định và ghi rõ logout một phiên hay mọi phiên; giữ hành vi thống nhất với refresh token.
- [ ] Chọn session/version check, introspection hoặc denylist phù hợp để thu hồi access token trên các service; quy định cache và cách xử lý khi dịch vụ xác minh không khả dụng.
- [ ] Bảo đảm logout, khóa/vô hiệu tài khoản, đổi/reset mật khẩu, gỡ quyền và gỡ membership làm mất quyền tương ứng.
- [ ] Thử bằng token thật do Identity cấp, qua gateway tới Identity/Booking/Payment/Transport/Reporting/Notification; không chỉ thử token tự ký trong fixture.

**Hoàn thành khi:** ca audit logout nhận 401 cho token bị thu hồi; tài khoản bị khóa không tiếp tục dùng API nghiệp vụ; vai trò/organization đã bị gỡ không còn quyền xuyên service. Các phiên hợp lệ không bị mất quyền ngoài chính sách đã chọn.

## P2 — callback, hạn mức và lớp bảo vệ bổ sung

### SEC-06 — gỡ open redirect ở callback VNPay cũ (F05)

- [ ] Gỡ provider callback đã ngừng dùng hoặc trả 4xx; không redirect theo `vnp_ReturnUrl` từ query khi validation thất bại.
- [ ] Đường redirect cần thiết chỉ dùng đích cấu hình/đã ký. Kiểm tra HTTPS, host/path và các biến thể URL bất thường.
- [ ] Giữ bridge SePay HMAC, expiry và giới hạn loopback trong Sandbox; không làm hỏng local → SePay → local hoặc resume thanh toán.
- [ ] Kiểm tra trực tiếp Payment, gateway và nginx sau build, vì frontend Docker cũ và nginx trong source đã có khác biệt.

**Hoàn thành khi:** URL tùy ý không nhận `Location` tới domain ngoài danh sách cho phép; probe không còn hai lỗi redirect. Return URL không có quyền tự xác nhận thanh toán; chỉ kết quả server đã xác thực mới phát hành vé.

### SEC-07 — hạn mức tài nguyên và luồng nhạy cảm (khoảng trống API4/API6)

- [ ] Chốt quota phù hợp cho auth/OTP/resend/lookup, active holds và request tốn tài nguyên; không áp số tùy tiện rồi làm hỏng đặt nhiều ghế.
- [ ] Partition limiter theo IP/tài khoản phù hợp; cấu hình trusted proxy để không tin X-Forwarded-For tùy ý và không gom mọi khách thành một IP.
- [ ] Bổ sung giới hạn body/page/range/timeout cần thiết và mã 429/Retry-After nhất quán.
- [ ] Test trên môi trường tách biệt: một khách hết quota không khóa toàn bộ khách khác; request đồng thời không vượt chính sách hoặc làm mất inventory.

**Hoàn thành khi:** có chính sách, ca kiểm thử và kết quả đo cụ thể. Chưa có exploit giữ hết ghế hoặc DoS được xác nhận trong audit cũ; phải phân biệt rủi ro dự kiến với kết quả thực nghiệm.

### SEC-08 — dependency, header và phạm vi kiểm thử còn thiếu

- [ ] Xử lý advisory body-parser high/minimatch moderate bằng bản vá/override tương thích, kiểm tra lockfile và chạy lại audit.
- [ ] Phân biệt dependency Node dev/SSR với runtime static nginx; không khẳng định advisory đã khai thác được trên Production nếu chưa có bằng chứng.
- [ ] Thiết kế CSP phù hợp; thử Report-Only trước nếu cần, kiểm tra script bootstrap, ảnh, font, SePay form/redirect và ứng dụng không bị chặn.
- [ ] Mở rộng kiểm tra SSRF và API consumption ở các đường thực sự nhận URL/gọi dịch vụ ngoài; không xem open redirect là bằng chứng SSRF.

**Hoàn thành khi:** advisory đã vá hoặc có phân tích ngoại lệ rõ ràng; header đã xác minh trên response thật; luồng hiện tại không bị hỏng; cập nhật phần đã kiểm thử/chưa kiểm thử trong báo cáo.

## P3 — lỗi chức năng và chất lượng phát hiện cùng lượt

- [ ] **BUG-01:** Transport optimistic concurrency: expectedVersion cũ phải trả 409, không 500; dữ liệu hiện hành không bị ghi đè.
- [ ] **QA-01:** Home test mong 4 card nhưng render 6: đối chiếu yêu cầu hiện tại trước khi sửa assertion; không xóa card để ép test qua.
- [ ] **QA-02:** NotificationBell keyboard focus có dấu hiệu nhìn thấy; xử lý `outline: none` bằng cơ chế phù hợp, không đưa lại khung xanh thô vào UI.
- [ ] **QA-03:** TripResultsPage dùng semantic token cho màu/shadow, giữ nguyên màu và hình thức đã duyệt.
- [ ] **QA-04:** Đồng bộ prerender config và SEO test theo kiến trúc hiện tại; không bật prerender cho trang tài khoản hoặc dữ liệu riêng.
- [ ] **QA-05:** Hai ca admin loading: thêm `aria-busy` đúng vùng, thông báo cho screen reader và không lộ stale rows.

**Hoàn thành khi:** lỗi version và 6 test frontend đã được xử lý đúng nguyên nhân; có kiểm tra keyboard/browser cho thay đổi accessibility và so sánh hình thức với bản hiện tại.

## Xác minh cuối đợt và bàn giao

- [ ] Chạy các test mục tiêu sau từng nhóm sửa; cập nhật test fixture để dùng service auth thật. Giữ assertion từ chối truy cập trái phép.
- [ ] Chạy toàn bộ backend. Nếu gateway dev khóa DLL Debug, dùng cấu hình Release; không build output ngoài cây workspace làm hỏng test tìm root.
- [ ] Chạy Vitest, typecheck/lint cần thiết và Postman ma trận quyền cập nhật. Chạy probe trên môi trường phù hợp và lưu evidence mới riêng, không ghi đè baseline 16/11 ngoài ý muốn.
- [ ] Tách cấu hình Playwright sang cổng/database test riêng; không reuse `5173` đang là Docker live cho suite giả định mock.
- [ ] E2E: đăng ký/OTP/đăng nhập, tìm chuyến, giữ 1 và nhiều ghế, autofill hành khách, coupon hợp lệ/hết hạn/sai điều kiện, review, SePay Sandbox, IPN hợp lệ/sai/trùng, resume, vé, hủy/refund, notification, các vai trò nhà xe/quản trị.
- [ ] Kiểm tra dữ liệu server: amount giảm giá, payment state, seat inventory, ticket count, settlement/refund và outbox; không chỉ kiểm tra màn hình thành công.
- [ ] Đối chiếu UI/animation responsive và keyboard, bảo đảm không đổi thiết kế.
- [ ] Sau khi code/test hoàn tất: commit các thay đổi đúng phạm vi, không stage secret/artifact không liên quan; build Docker một lần và smoke test lại bản mới. Đánh giá việc công khai chi tiết lỗ hổng trước khi push tài liệu lên remote công khai.
- [ ] Báo cáo cuối: task nào xong/còn lại, commit, target chạy, số ca qua/lỗi, rủi ro còn tồn tại và hướng dẫn local/Docker.

### Lệnh tham khảo

Từ repository root:

```powershell
dotnet test workspace/src/tests/booking/BusTicketPlatform.Booking.Api.IntegrationTests --filter Category=SecurityAudit
dotnet test workspace/src/tests/reporting/BusTicketPlatform.Reporting.Api.IntegrationTests --filter Category=SecurityAudit
dotnet test workspace/src/tests/identity/BusTicketPlatform.Identity.Api.IntegrationTests --filter Category=SecurityAudit
dotnet test workspace/BusTicketPlatform.sln -c Release
postman collection run workspace/postman/BLUE_OWASP_Protected_Endpoints.postman_collection.json
```

Frontend trong `workspace/src/apps/web`:

```powershell
node node_modules/vitest/vitest.mjs run
```

Probe chỉ đọc: `python workspace/scripts/security/live-readonly-audit.py`. Script hiện hardcode cổng Docker và thư mục bằng chứng ngày 16/11; trước khi chạy lại cần cho phép chọn target/output để lưu riêng kết quả mới.

### Baseline để so sánh

Ngày 16/11: backend **142/148 qua** (5 ca bảo mật mới đỏ + 1 lỗi Transport); frontend **1474/1480 qua**; Postman **68/68 qua**; probe **19/21 qua**. Số ca có thể tăng khi thêm test. Chỉ đóng task theo tiêu chí nghiệm thu, không chỉ theo tổng số test xanh. Chưa có chứng nhận toàn bộ hệ thống đạt OWASP.
