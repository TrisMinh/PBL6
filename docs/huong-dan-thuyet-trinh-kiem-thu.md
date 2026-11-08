# Kịch bản thuyết trình kiểm thử theo API Test Report

Tài liệu này bám theo workbook final [`outputs/API_Test_Report.xlsx`](../outputs/API_Test_Report.xlsx), chỉ gồm hai chức năng trong report: **Auth** và **SeatHold**. Không dùng số liệu hay suite regression khác để thay cho kết quả của workbook này.

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

## 2. Nói về unit test trước

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

## 3. Chuyển sang API Test Report

### Lời thoại

> “Tiếp theo là kiểm thử API theo workbook final. Phạm vi gồm đăng ký và kích hoạt tài khoản ở Auth, cùng xem ghế và giữ ghế ở Booking. Tổng cộng có 16 case: 7 Auth và 9 SeatHold. Round 1 đạt 9, Round 2 đạt 14, Round 3 đạt 16 trên 16.”

Khi mở workbook, giải thích một case bằng bốn ý:

1. **Pre-condition:** dữ liệu cần có trước khi chạy, ví dụ tài khoản chưa kích hoạt hoặc ghế đang `AVAILABLE`.
2. **Procedure:** API và bước gửi request.
3. **Expected result:** HTTP status, mã lỗi hoặc thay đổi trạng thái mong đợi.
4. **Actual result/note:** kết quả thực tế được ghi ở round tương ứng.

## 4. Demo chi tiết AUTH-04 bằng Postman

Case AUTH-04 trong workbook kiểm tra nhiều đầu vào đăng ký không hợp lệ: thiếu họ tên, thiếu email, email sai định dạng, số điện thoại sai và mật khẩu yếu. Khi thuyết trình, có thể demo một mẫu là **mật khẩu yếu**.

### 4.1 Chuẩn bị môi trường

- Khởi chạy backend local; Gateway phải sẵn sàng tại `http://localhost:5080`.
- Mở Postman Desktop.
- Tạo collection mới tên `PBL6_API_Test_Report_Final`.
- Tạo request trong collection với tên `AUTH-04 - Reject weak password`.

### 4.2 Tạo request

- Method: `POST`
- URL: `http://localhost:5080/api/v1/auth/register`
- Header: `Content-Type: application/json`
- Body chọn `raw` và `JSON`:

```json
{
  "fullName": "Pham Thi Dung",
  "email": "dung.pham@pbl6.test",
  "phone": "0901000003",
  "password": "123"
}
```

Email và số điện thoại phải là test data chưa tồn tại để request chỉ vấp lỗi dữ liệu/mật khẩu, không bị từ chối do trùng tài khoản.

### 4.3 Thêm assertion ở tab Scripts → Post-response

```javascript
pm.test("AUTH-04 rejects invalid registration", () => {
  pm.response.to.have.status(400);
  const body = pm.response.json();
  pm.expect(body.error.code).to.eql("VALIDATION_ERROR");
});
```

Trong report, AUTH-04 kỳ vọng `400 VALIDATION_ERROR` với dữ liệu không hợp lệ. Nếu bản API đang chạy trả status khác, dừng demo và đối chiếu endpoint/phiên bản API với workbook trước khi trình bày; không đổi expected result chỉ để làm test xanh.

### 4.4 Thực hiện và giải thích

1. Nhấn **Send**.
2. Kiểm tra status response là `400`.
3. Mở tab **Test Results**.
4. Chỉ vào assertion `AUTH-04 rejects invalid registration` đang đạt.

### Lời thoại

> “Ở AUTH-04, em gửi yêu cầu đăng ký với mật khẩu không đạt chính sách. Test không chỉ xem request có chạy hay không; assertion xác nhận status là 400 và mã lỗi là VALIDATION_ERROR như report yêu cầu. Các biến thể thiếu trường và sai định dạng được kiểm tra tương tự theo test data trong workbook.”

## 5. Chạy riêng request AUTH-04 bằng Postman CLI

Export collection `PBL6_API_Test_Report_Final` thành file:

```text
workspace/postman/PBL6_API_Test_Report_Final.postman_collection.json
```

Mở PowerShell ở `workspace`, rồi chạy đúng request demo:

```powershell
postman collection run .\postman\PBL6_API_Test_Report_Final.postman_collection.json `
  -i "AUTH-04 - Reject weak password" `
  -r cli,json,junit `
  --reporter-json-export .\postman\runs\api-report-auth04.json `
  --reporter-junit-export .\postman\runs\api-report-auth04.xml
```

`-i` chọn riêng request theo tên. `-r cli,json,junit` hiển thị kết quả trong terminal và tạo JSON/JUnit report. Postman CLI hỗ trợ chọn request bằng `-i` và xuất nhiều dạng report; xem [hướng dẫn chạy collection](https://learning.postman.com/docs/postman-cli/postman-cli-collections) và [hướng dẫn reporters](https://learning.postman.com/docs/postman-cli/postman-cli-reporters).

Output dự kiến:

```text
workspace/postman/runs/api-report-auth04.json
workspace/postman/runs/api-report-auth04.xml
```

Trên terminal, chỉ ra request đã chạy, HTTP status và assertion pass/fail. JSON lưu kết quả có cấu trúc; JUnit XML dùng khi cần đưa kết quả vào CI.

## 6. Chạy một lượt đủ 16 case theo workbook

### Trạng thái hiện tại của repo

Workbook là báo cáo kết quả, không phải collection có thể chạy trực tiếp. Hiện chưa có một collection/runner duy nhất được xác nhận chạy **đúng 16 case AUTH-01..07 và BOOK-01..09 trong workbook**. Vì vậy không nên trình bày một suite khác là automation của report final.

### Cách chuẩn bị collection final

Trong Postman, tạo collection `PBL6_API_Test_Report_Final` với hai folder:

- `Auth_Register`: AUTH-01 đến AUTH-07.
- `Booking_SeatHold`: BOOK-01 đến BOOK-09.

Tạo một hoặc nhiều request cho mỗi case đúng theo procedure trong workbook. Một số case cần nhiều request trong cùng scenario, ví dụ AUTH-05 gồm register → lấy OTP từ Mailpit → verify → login; BOOK-05 gửi hai yêu cầu cùng ghế; BOOK-08 gửi lặp cùng key; BOOK-09 cần chờ hoặc dùng fixture để hết hạn hold. Đặt dữ liệu test vào Postman environment, không hard-code access token thật.

Trước khi chạy đủ collection:

1. Dùng database local/test và dữ liệu synthetic trong sheet `SeatHold Data`.
2. Khôi phục ghế/chuyến/tài khoản về pre-condition của workbook.
3. Đảm bảo mỗi scenario có data riêng hoặc bước cleanup, để lượt chạy lặp lại không bị trùng tài khoản/ghế.
4. Đặt request theo thứ tự phụ thuộc dữ liệu.
5. Thêm assertion riêng cho từng case theo expected result ở workbook.
6. Chạy folder Auth và SeatHold riêng để tìm lỗi; sau đó chạy toàn collection một lượt.

### Chạy collection final sau khi đã tạo và export

```powershell
Set-Location workspace

postman collection run .\postman\PBL6_API_Test_Report_Final.postman_collection.json `
  -e .\postman\PBL6_API_Test_Report_Final.postman_environment.json `
  -r cli,json,junit `
  --reporter-json-export .\postman\runs\api-report-final.json `
  --reporter-junit-export .\postman\runs\api-report-final.xml
```

Một lượt chạy collection thực hiện các request theo thứ tự sắp xếp trong collection. Postman CLI có thể chạy local collection và lưu report vào file; nếu collection dùng variables thì truyền environment bằng `-e`. [Postman CLI run](https://learning.postman.com/docs/postman-cli/postman-cli-run-collection) và [report output](https://learning.postman.com/docs/postman-cli/postman-cli-reporters).

### PowerShell wrapper cho collection final

Sau khi collection và environment final đã được tạo, có thể lưu script sau thành `workspace/scripts/run-api-test-report.ps1`:

```powershell
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$collection = Join-Path $workspaceRoot 'postman\PBL6_API_Test_Report_Final.postman_collection.json'
$environment = Join-Path $workspaceRoot 'postman\PBL6_API_Test_Report_Final.postman_environment.json'
$outputDirectory = Join-Path $workspaceRoot 'postman\runs\api-report-final'

foreach ($path in @($collection, $environment)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Required Postman file not found: $path"
    }
}

[System.IO.Directory]::CreateDirectory($outputDirectory) | Out-Null
$jsonReport = Join-Path $outputDirectory 'report.json'
$junitReport = Join-Path $outputDirectory 'report.xml'

& postman collection run $collection `
    -e $environment `
    -r cli,json,junit `
    --reporter-json-export $jsonReport `
    --reporter-junit-export $junitReport

$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) {
    Write-Error "Postman API report run failed with exit code $exitCode. See $jsonReport"
    exit $exitCode
}

Write-Host "Postman API report run passed. JSON: $jsonReport"
Write-Host "JUnit: $junitReport"
exit 0
```

Chạy wrapper:

```powershell
Set-Location workspace
.\scripts\run-api-test-report.ps1
```

Script này là wrapper cho collection final được mô tả ở trên; **nó chỉ chạy được sau khi collection 16 case và environment đã được tạo/export đúng đường dẫn**. Runner giữ exit code để CI biết lượt chạy có lỗi hay không.

## 7. Cách nói về output

Với Postman Collection Runner/CLI, báo cáo một lượt sẽ có:

- Bảng terminal: request nào chạy, HTTP status, assertion nào đạt hoặc trượt, tổng kết lượt chạy.
- JSON: kết quả có cấu trúc để lưu, đọc hoặc xử lý tiếp.
- JUnit XML: định dạng phổ biến để hệ thống CI hiển thị test result.
- Workbook `outputs/API_Test_Report.xlsx`: báo cáo final thủ công theo cấu trúc test case/round của đề tài; CLI không tự ghi workbook này.

Lời thoại:

> “Sau một lượt chạy Postman, em lưu output terminal để xem nhanh, JSON để giữ kết quả chi tiết và JUnit XML để có thể tích hợp CI. Workbook API Test Report vẫn là báo cáo tổng hợp theo 16 case và các round; cần cập nhật workbook riêng sau khi review kết quả chạy.”

## 8. Lời kết mẫu

> “Tóm lại, em dùng unit test xUnit để kiểm tra ba quy tắc ở cấp hàm. Sau đó Postman kiểm thử API theo đúng 16 case Auth và SeatHold trong workbook. Kết quả Round 3 của report là 16 trên 16 đạt. Khi cần chạy lại tự động toàn bộ, các request phải được gom vào collection final theo đúng 16 case, rồi Postman CLI xuất JSON/JUnit và trả exit code cho automation.”
