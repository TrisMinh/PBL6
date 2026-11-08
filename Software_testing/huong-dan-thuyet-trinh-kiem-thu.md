# Kịch bản thuyết trình kiểm thử theo API Test Report

Tài liệu này bám theo workbook final [`API_Test_Report.xlsx`](API_Test_Report.xlsx), chỉ gồm hai chức năng trong report: **Auth** và **SeatHold**. Không dùng số liệu hay suite regression khác để thay cho kết quả của workbook này.

## 1. Phạm vi đúng theo report

Workbook có 16 API test case:

| Nhóm | Case | Nội dung |
|---|---|---|
| Auth | AUTH-01 | Đăng ký tài khoản hợp lệ |
| Auth | AUTH-02 | Từ chối email đã thuộc tài khoản đang hoạt động |
| Auth | AUTH-03 | Từ chối số điện thoại đã tồn tại |
| Auth | AUTH-04 | Từ chối dữ liệu đăng ký không hợp lệ |
| Auth | AUTH-05 | Xác minh tài khoản bằng OTP đúng |
| Auth | AUTH-06 | Từ chối OTP sai hoặc hết hạn; tài khoản chưa được kích hoạt |
| Auth | AUTH-07 | Giới hạn số lần gửi lại OTP |
| SeatHold | BOOK-01 | Xem danh sách ghế và trạng thái |
| SeatHold | BOOK-02 | Giữ một ghế hợp lệ |
| SeatHold | BOOK-03 | Giữ nhiều ghế trong một yêu cầu |
| SeatHold | BOOK-04 | Từ chối yêu cầu nhiều ghế nếu một ghế đã bị giữ; ghế trống còn lại không bị giữ dở |
| SeatHold | BOOK-05 | Hai khách giữ cùng một ghế đồng thời; chỉ một người thành công |
| SeatHold | BOOK-06 | Từ chối giữ ghế khi chưa đăng nhập |
| SeatHold | BOOK-07 | Từ chối giữ ghế trên chuyến đã hủy hoặc đã khởi hành |
| SeatHold | BOOK-08 | Gửi lại cùng Idempotency-Key và nội dung thì nhận lại cùng hold |
| SeatHold | BOOK-09 | Hold hết hạn và ghế được giải phóng |

### Kết quả trong workbook

- Round 1: 9/16 đạt, 7 lỗi.
- Round 2: 14/16 đạt, 2 lỗi.
- Round 3: 16/16 đạt, 0 lỗi.
- Round 3 gồm Auth 7/7 và SeatHold 9/9.

Khi trình bày, mở sheet `Test Statistics` để chỉ kết quả tổng hợp. Sau đó mở `Auth_Register` và `Booking_SeatHold` để xem mô tả, bước thực hiện, kết quả mong đợi, trạng thái từng round và test data.

## 2. Chuẩn bị môi trường chỉ dùng CLI

- Cài Docker Desktop để chạy backend local; không cần cài Postman Desktop.
- Cài Node.js/npm, sau đó cài Postman CLI:

```powershell
npm install -g postman-cli
```

- Mở PowerShell mới. Trên Windows, gọi CLI qua npm shim để chắc chắn không chạy nhầm alias ứng dụng Postman:

```powershell
$postmanCli = Join-Path $env:APPDATA 'npm\postman.cmd'
& $postmanCli --version
```

  Trên máy tạo tài liệu này, lệnh trả về `1.86.0`. Phiên bản có thể khác nếu CLI được cập nhật. Xem [hướng dẫn cài Postman CLI](https://learning.postman.com/docs/postman-cli/postman-cli-installation).
- Khởi chạy backend local; Gateway phải sẵn sàng tại `http://localhost:5080/ready`.

Để bật platform đầy đủ bằng Docker, chạy từ thư mục gốc repo:

```powershell
Set-Location workspace
.\scripts\dev-docker.ps1
```

Giữ cửa sổ đó mở trong lúc chạy API test.

## 3. Nói về unit test trước

Unit test được thêm để kiểm tra ba nhánh riêng trong code bằng xUnit:

1. `PasswordPolicy.IsSatisfied` từ chối mật khẩu không có chữ số.
2. `BookingService.CreateHoldAsync` từ chối danh sách có cùng `seatId` hai lần.
3. `BookingService.CreateHoldAsync` từ chối actor không có role `CUSTOMER`.

Chạy tại thư mục gốc repo:

```powershell
dotnet test workspace/src/tests/application/BusTicketPlatform.AuthBooking.UnitTests/BusTicketPlatform.AuthBooking.UnitTests.csproj
```

Kết quả gần nhất là 3 đạt, 0 lỗi. Unit test này bổ sung góc nhìn về logic bên trong hàm; **không tính vào 16 API test case trong workbook**.

### Lời thoại

> “Trước API test, em chạy ba unit test xUnit cho các quy tắc quan trọng: password policy, chặn ghế bị lặp trong một yêu cầu giữ chỗ và chặn actor không có quyền CUSTOMER. Lượt chạy đạt 3 trên 3. Đây là kiểm tra ở cấp hàm; kết quả này được trình bày riêng, không cộng vào 16 case Postman trong báo cáo.”

## 4. Chuyển sang API Test Report

### Lời thoại

> “Tiếp theo là kiểm thử API theo workbook final. Phạm vi gồm đăng ký và kích hoạt tài khoản ở Auth, cùng xem ghế và giữ ghế ở Booking. Tổng cộng có 16 case: 7 Auth và 9 SeatHold. Round 1 đạt 9, Round 2 đạt 14, Round 3 đạt 16 trên 16.”

Khi mở workbook, giải thích một case bằng bốn ý:

1. **Pre-condition:** dữ liệu cần có trước khi chạy, ví dụ tài khoản chưa kích hoạt hoặc ghế đang `AVAILABLE`.
2. **Procedure:** API và bước gửi request.
3. **Expected result:** HTTP status, mã lỗi hoặc thay đổi trạng thái mong đợi.
4. **Actual result/note:** kết quả thực tế được ghi ở round tương ứng.

## 5. Demo AUTH-04 bằng Postman CLI

Collection chạy được đã có tại [`PBL6_API_Test_Report_Final.postman_collection.json`](PBL6_API_Test_Report_Final.postman_collection.json). Collection có hai folder: Auth (AUTH-01..07) và SeatHold (BOOK-01..09). Mỗi case có assertion; các luồng cần nhiều HTTP request, như đăng ký → đọc OTP từ Mailpit → xác minh, được để liên tiếp trong cùng folder.

AUTH-04 trong report bao gồm nhiều đầu vào không hợp lệ. Request demo chọn email sai định dạng `an.nguyen@`, các trường khác hợp lệ, và xác nhận `400 VALIDATION_ERROR`.

Chạy từ PowerShell ở thư mục gốc repo:

```powershell
$postmanCli = Join-Path $env:APPDATA 'npm\postman.cmd'
New-Item -ItemType Directory -Force '.\Software testing\runs\auth04' | Out-Null
& $postmanCli collection run '.\Software testing\PBL6_API_Test_Report_Final.postman_collection.json' `
  -i "AUTH-04 - Reject invalid registration email" `
  --no-report-events 2>&1 | Tee-Object '.\Software testing\runs\auth04\postman-cli.log'
```

`-i` chọn riêng request AUTH-04. `Tee-Object` vừa hiển thị kết quả trên terminal, vừa lưu bản ghi vào file log. Không dùng `--output` vì Postman giới hạn tính năng đó cho Enterprise team. Lượt chạy local không cần đăng nhập Postman; `--no-report-events` tắt gửi sự kiện run lên cloud. API local phải chạy ở `http://localhost:5080`.

### Lời thoại

> “Ở AUTH-04, em dùng Postman CLI gửi yêu cầu đăng ký với email sai định dạng. Assertion xác nhận status 400 và mã VALIDATION_ERROR như report yêu cầu. Collection cũng có các case còn lại trong workbook để chạy riêng hoặc chạy toàn bộ.”

## 6. Collection Postman theo API Test Report

File collection final: [`PBL6_API_Test_Report_Final.postman_collection.json`](PBL6_API_Test_Report_Final.postman_collection.json). Có 16 nhóm test case tương ứng các ID AUTH-01..07 và BOOK-01..09; một case có thể gồm nhiều request chuẩn bị, kiểm tra và cleanup.

Collection dùng `baseUrl=http://localhost:5080/api/v1` và `mailpitUrl=http://localhost:8025` mặc định. Cần backend local và Mailpit đang chạy. Trước lượt chạy, cần:

1. Khởi động backend và Docker services theo mục 2; xác nhận `http://localhost:5080/ready` trả thành công.
2. Dùng database test được seed theo dữ liệu trong workbook, đặc biệt chuyến T1, các ghế 2A/2B và khách `seed.customer@example.test` / `pbl6.r3.customer.two@example.test`.
3. Giữ nguyên fixture chuyến `CANCELLED` và `DEPARTED` của report cho BOOK-07.
4. Không chạy song song một suite khác trên cùng database/ghế trong khi collection này chạy.

Email đăng ký, số điện thoại và idempotency key của các luồng Auth được sinh mới theo mỗi lượt chạy để giảm xung đột dữ liệu. AUTH-06 tự động kiểm tra OTP sai, đưa thời hạn challenge thử về quá khứ trong database local rồi kiểm tra OTP hết hạn và từ chối đăng nhập khi tài khoản còn Pending. Vì dùng fixture thời gian, không phải đợi TTL thật 30 phút. Một số test SeatHold có bước release hold sau khi assertion hoàn tất.

Runner full suite tăng tốc AUTH-06 và BOOK-09 bằng cách cập nhật thời hạn của đúng challenge/hold thử vừa tạo trong PostgreSQL local; sau đó Postman CLI kiểm tra response API. Không chờ TTL 30 phút hoặc 10 phút; riêng BOOK-09 chờ tối đa 20 giây để worker chạy chu kỳ proactive 15 giây. Lượt full suite cần Docker Compose/PostgreSQL local chạy; mỗi lượt lưu bảng kết quả theo 16 mã test case cùng log Postman chi tiết.

Muốn chạy lại riêng nhánh AUTH-06 OTP hết hạn mà không đợi 30 phút: đăng ký tài khoản test, lấy `challengeId` và OTP từ Mailpit, rồi chỉ trên **database local/test** đặt thời hạn của đúng challenge về quá khứ trước khi gọi `/auth/verify`:

```sql
UPDATE auth_challenges
SET expires_at = created_at + INTERVAL '1 millisecond'
WHERE id = '<challenge_id>' AND status = 'ACTIVE';
```

Gửi OTP thật của challenge đó; kỳ vọng `410 VERIFICATION_EXPIRED`, sau đó login vẫn bị từ chối. Đây là fixture tăng tốc được dùng trong API Test Report; không chạy câu SQL này trên production.

## 7. Chạy trọn collection bằng script PowerShell

Script đã tạo tại [`run-api-test-report.ps1`](run-api-test-report.ps1). Từ thư mục gốc repo chạy:

```powershell
& '.\Software testing\run-api-test-report.ps1'
```

Có thể đổi địa chỉ API/Mailpit nếu dùng port khác:

```powershell
& '.\Software testing\run-api-test-report.ps1' `
  -BaseUrl 'http://localhost:5080' `
  -MailpitUrl 'http://localhost:8025'
```

Để chạy nhanh một request kiểm tra collection và đường dẫn API, dùng tham số `-Request`:

```powershell
& '.\Software testing\run-api-test-report.ps1' `
  -Request 'AUTH-04 - Reject invalid registration email'
```

Không truyền `-Request` sẽ chạy toàn bộ collection.

Script kiểm tra file collection, Postman CLI, readiness của API và Mailpit. Không truyền `-Request` sẽ chạy toàn bộ suite, dùng fixture local tăng tốc để kiểm tra AUTH-06 OTP hết hạn và cả hai nhánh BOOK-09 (lazy expiry và proactive worker). Lượt chạy chờ tối đa 20 giây cho worker, không chờ TTL tự nhiên 10 phút. Mỗi lượt sinh thư mục timestamp riêng bên dưới `Software testing/runs/api-report-final/`, gồm `test-summary.md` theo mã, tên, kết quả mong đợi, kết quả trả về và Pass/Fail, cùng `postman-cli.log` chi tiết. Để bỏ bước kiểm tra readiness khi API đã sẵn sàng theo cách khác, truyền `-SkipHealthCheck`.

Phần tăng tốc cần Docker Compose service `postgres` của repo và chỉ cập nhật challenge/hold mới do chính lượt chạy tạo. Không dùng script này với production database. Bản kiểm tra tự nhiên Round 3 trong workbook vẫn là bằng chứng riêng cho thời gian TTL thật.

Ví dụ output:

```text
Software testing/runs/api-report-final/20261108-153000/
  postman-cli.log
```

Script trả exit code khác 0 nếu CLI thất bại hoặc thiếu file log; do đó có thể dùng trong CI hoặc gọi từ một script automation khác. Log là bằng chứng chạy tự động riêng, không ghi đè workbook final. CLI có thể in cảnh báo rằng chưa đăng nhập để publish run lên Postman Cloud; cảnh báo đó không làm lượt chạy local thất bại.

## 8. Cách nói về output

Với Postman CLI 1.86 hiện cài trên máy, một lượt chạy có:

- Kết quả terminal: request nào chạy và assertion nào đạt hoặc trượt.
- File `postman-cli.log`: kết quả request, HTTP status và assertion; bảng thống kê lặp của CLI được lọc bỏ.
- File `test-summary.md`: tên case, mong đợi, thực tế và Pass/Fail theo 16 ID trong workbook.
- Workbook `Software testing/API_Test_Report.xlsx`: báo cáo final theo cấu trúc test case/round; CLI không tự ghi workbook này.

Lời thoại:

> “Sau một lượt chạy Postman CLI, em xem kết quả ở terminal và lưu log để giữ bằng chứng chi tiết. Workbook API Test Report vẫn là báo cáo tổng hợp theo 16 case và các round; em review kết quả chạy tự động rồi cập nhật workbook riêng nếu cần.”
## 9. Lời kết mẫu

> “Tóm lại, em dùng unit test xUnit để kiểm tra ba quy tắc ở cấp hàm. Sau đó Postman kiểm thử API theo đúng 16 case Auth và SeatHold trong workbook. Kết quả Round 3 của report là 16 trên 16 đạt. Script PowerShell chạy collection final qua Postman CLI, lưu log và trả exit code để automation nhận biết lượt chạy thành công hay thất bại.”
