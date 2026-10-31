# Gọi API thủ công kèm kịch bản FE

Đi cùng [MANUAL_TEST_PLAN.md](./MANUAL_TEST_PLAN.md). Các đoạn dưới **không được tự chạy khi mở file**. Đọc mục tiêu rồi chạy từng khối; POST hold/booking/refund/check-in/payout làm thay đổi DB demo. Không chạy cả file như một script reset dữ liệu.

## 1. Helper dùng được trong Windows PowerShell

Mở terminal tại repo, dán hàm này một lần. Hàm trả cả HTTP status lẫn JSON body, kể cả response 4xx. Lỗi không kết nối vẫn được throw, không bị coi là thành công.

```powershell
$qaBaseUrl = 'http://localhost:5080'

function Invoke-QaApi {
    param(
        [string]$Method = 'GET',
        [Parameter(Mandatory = $true)][string]$Route,
        [string]$Token,
        [object]$Body,
        [string]$Key
    )
    $qaHeaders = @{}
    if ($Token) { $qaHeaders.Authorization = 'Bearer ' + $Token }
    if ($Key) { $qaHeaders['Idempotency-Key'] = $Key }
    $qaParams = @{
        Uri = $qaBaseUrl + $Route
        Method = $Method
        Headers = $qaHeaders
        UseBasicParsing = $true
        TimeoutSec = 30
        ErrorAction = 'Stop'
    }
    if ($null -ne $Body) {
        $qaParams.ContentType = 'application/json; charset=utf-8'
        $qaParams.Body = [System.Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Depth 20))
    }
    try {
        $qaResponse = Invoke-WebRequest @qaParams
        $qaData = if ($qaResponse.Content) { $qaResponse.Content | ConvertFrom-Json } else { $null }
        [pscustomobject]@{ Status = [int]$qaResponse.StatusCode; Body = $qaData }
    } catch {
        $qaFailure = $_
        if ($null -eq $qaFailure.Exception.Response) { throw }
        $qaErrorText = $qaFailure.ErrorDetails.Message
        $qaErrorBody = $null
        if ($qaErrorText) {
            try { $qaErrorBody = $qaErrorText | ConvertFrom-Json } catch { $qaErrorBody = $qaErrorText }
        }
        [pscustomobject]@{ Status = [int]$qaFailure.Exception.Response.StatusCode; Body = $qaErrorBody }
    }
}
```

Không copy nguyên token/session vào báo lỗi. Khi cần gửi bằng chứng, dùng `.Status`, `.Body.error`, hoặc chọn các field nghiệp vụ.

## 2. Đăng nhập B/C và đọc manifest

```powershell
$qaLoginB = Invoke-QaApi -Method POST -Route '/api/v1/auth/login' -Body @{
    identifier = 'customer.b@demo.test'
    password = 'OperatorPass1'
}
$qaLoginC = Invoke-QaApi -Method POST -Route '/api/v1/auth/login' -Body @{
    identifier = 'customer.c@demo.test'
    password = 'OperatorPass1'
}
if ($qaLoginB.Status -ne 200 -or $qaLoginC.Status -ne 200) { throw 'Login failed; inspect Status and Body.error' }
$qaTokenB = $qaLoginB.Body.accessToken
$qaTokenC = $qaLoginC.Body.accessToken
$qaManifest = Get-Content 'D:\Project\PBL6\workspace\src\apps\web\tmp\expanded-demo\manifest.json' -Raw -Encoding UTF8 | ConvertFrom-Json
$qaManifest.scenarios | Select-Object tenant, kind, name, bookingCode, tripId, paymentId
```

Đăng nhập operator/admin/finance tương tự bằng email tương ứng. ADMIN cũ dùng `admin.seed@example.test` và `AdminPass1234`; các user `@demo.test` dùng `OperatorPass1`.

## 3. Tìm chuyến và phân trang

```powershell
$qaSearchQuery = 'origin=' + [uri]::EscapeDataString('Đà Nẵng') +
    '&destination=' + [uri]::EscapeDataString('Huế') +
    '&departureDate=2026-11-15&passengerCount=1&page=0&size=100&sort=PRICE_ASC'
$qaTrips = Invoke-QaApi -Route ('/api/v1/trips?' + $qaSearchQuery)
$qaTrips.Status
$qaTrips.Body | Select-Object page, size, totalElements, totalPages
$qaTrips.Body.items | Select-Object id, operatorName, departureAt, availableSeatCount, allowPayLater
$qaPage2 = Invoke-QaApi -Route ('/api/v1/trips?' + $qaSearchQuery.Replace('page=0', 'page=1'))
$qaPage2.Body.items.Count
```

Tìm chuyến ngày 04/11 để tạo đơn trả sau/BOARDING: đổi `departureDate=2026-11-15` thành `2026-11-04`. Những ngày fixture này đúng cho bộ seed 01/11/2026; sau ngày khởi hành phải tạo chuyến tương lai mới.

## 4. Tạo hold mới, kiểm tra replay và quyền sở hữu

Chọn một chuyến thật có ghế AVAILABLE. Đoạn dưới ưu tiên chuyến cơ bản của B để không dùng chuyến sold-out. Tạo hold sẽ tạm chiếm một ghế khoảng 10 phút.

```powershell
$qaTripId = '019aff01-0000-7000-8000-000000006002'
$qaTripResult = Invoke-QaApi -Route ('/api/v1/trips/' + $qaTripId)
$qaSeatResult = Invoke-QaApi -Route ('/api/v1/trips/' + $qaTripId + '/seats') -Token $qaTokenB
if ($qaTripResult.Status -ne 200 -or $qaSeatResult.Status -ne 200) { throw 'Cannot load trip/inventory' }
$qaSeat = $qaSeatResult.Body.seats | Where-Object { $_.status -eq 'AVAILABLE' } | Select-Object -First 1
if (-not $qaSeat) { throw 'No available seat; choose another trip' }
$qaPickup = $qaTripResult.Body.stops | Where-Object { $_.pickupAllowed } | Sort-Object sequence | Select-Object -First 1
$qaDropoff = $qaTripResult.Body.stops | Where-Object { $_.dropoffAllowed -and $_.sequence -gt $qaPickup.sequence } | Sort-Object sequence -Descending | Select-Object -First 1
if (-not $qaPickup -or -not $qaDropoff) { throw 'No valid pickup/dropoff' }
$qaHoldBody = @{
    seatIds = @($qaSeat.id)
    pickupStopId = $qaPickup.id
    dropoffStopId = $qaDropoff.id
}
$qaHoldKey = [guid]::NewGuid().ToString()
$qaHold = Invoke-QaApi -Method POST -Route ('/api/v1/trips/' + $qaTripId + '/seat-holds') -Token $qaTokenB -Key $qaHoldKey -Body $qaHoldBody
$qaHold.Status
$qaHold.Body | Select-Object status, expiresAt, tripId
if ($qaHold.Status -lt 200 -or $qaHold.Status -ge 300) { throw 'Hold failed; inspect Body.error' }
$qaHoldToken = $qaHold.Body.holdToken

# Cùng body và key: phải trả cùng hold, không chiếm thêm ghế.
$qaHoldReplay = Invoke-QaApi -Method POST -Route ('/api/v1/trips/' + $qaTripId + '/seat-holds') -Token $qaTokenB -Key $qaHoldKey -Body $qaHoldBody
$qaHoldReplay.Body.holdToken -eq $qaHoldToken

# Chủ khác: không được đọc hold của B.
$qaCrossHold = Invoke-QaApi -Route ('/api/v1/seat-holds/' + [uri]::EscapeDataString($qaHoldToken)) -Token $qaTokenC
$qaCrossHold.Status
$qaCrossHold.Body.error
```

Để nhả hold và kết thúc ở bước này:

```powershell
$qaRelease = Invoke-QaApi -Method DELETE -Route ('/api/v1/seat-holds/' + [uri]::EscapeDataString($qaHoldToken)) -Token $qaTokenB -Key ([guid]::NewGuid().ToString())
$qaRelease.Status   # Thành công thường là 204
```

**Không chạy nhả hold nếu bạn muốn dùng nó cho bước tạo booking ngay bên dưới.** Hold đã nhả/hết hạn không tạo booking được. Làm lại mục 4 để lấy hold mới.

## 5. Tạo booking từ hold, không tin giá gửi lên

```powershell
$qaBookingKey = [guid]::NewGuid().ToString()
$qaBookingBody = @{
    holdToken = $qaHoldToken
    contact = @{ fullName = 'QA Manual B'; email = 'customer.b@demo.test'; phone = '+849800001001' }
    passengers = @(@{
        seatId = $qaSeat.id
        fullName = 'QA Passenger B'
        documentType = $null
        documentNumber = $null
        pickupStopId = $qaPickup.id
        dropoffStopId = $qaDropoff.id
    })
    expectedTotal = [long]$qaSeat.price.amount
    currency = 'VND'
    paymentChannel = 'PREPAID'
}
$qaBooking = Invoke-QaApi -Method POST -Route '/api/v1/bookings' -Token $qaTokenB -Key $qaBookingKey -Body $qaBookingBody
$qaBooking.Status
$qaBooking.Body | Select-Object id, code, status, total, paymentChannel, rowVersion
if ($qaBooking.Status -lt 200 -or $qaBooking.Status -ge 300) { throw 'Booking failed' }
$qaBookingId = $qaBooking.Body.id

# Replay cùng body/key: cùng ID.
$qaBookingReplay = Invoke-QaApi -Method POST -Route '/api/v1/bookings' -Token $qaTokenB -Key $qaBookingKey -Body $qaBookingBody
$qaBookingReplay.Body.id -eq $qaBookingId

# C không được đọc đơn B.
$qaCrossBooking = Invoke-QaApi -Route ('/api/v1/bookings/' + $qaBookingId) -Token $qaTokenC
$qaCrossBooking.Status
```

Để test trả sau, **tạo hold/booking khác**, xác nhận `allowPayLater=true`, đổi `paymentChannel='PAY_LATER'` và dùng key mới. Để test giả giá, tạo hold mới rồi gửi expectedTotal sai; giữ key/body cũ khi retry không phải cách tạo một yêu cầu nghiệp vụ mới.

## 6. Thanh toán qua FE/simulator

Sau mục 5, mở URL dưới bằng trình duyệt **đăng nhập CB**:

```powershell
'http://localhost:5173/payment/' + $qaBookingId + '/vnpay'
```

Chọn thanh toán trên FE rồi dùng simulator. Không POST vào `/internal/payments/succeeded` để giả lập thành công: cách đó bỏ qua cổng và webhook nên không phải E2E.

Đọc kết quả thật:

```powershell
$qaPaymentList = Invoke-QaApi -Route ('/api/v1/bookings/' + $qaBookingId + '/payments') -Token $qaTokenB
$qaPaymentList.Body | Select-Object id, bookingId, status, amount, currency
$qaAfterPayment = Invoke-QaApi -Route ('/api/v1/bookings/' + $qaBookingId) -Token $qaTokenB
$qaAfterPayment.Body | Select-Object id, status, total
$qaTickets = Invoke-QaApi -Route '/api/v1/tickets?page=0&size=100' -Token $qaTokenB
$qaNewTickets = @($qaTickets.Body.items | Where-Object { $_.bookingId -eq $qaBookingId })
$qaNewTickets | Select-Object id, publicCode, status, seatCode, tripId, rowVersion
```

Nếu vừa thanh toán, refetch vài lần để chờ consumer; ghi độ trễ, không tự chỉnh DB. Payment SUCCEEDED nhưng không xuất vé sau xử lý là case cần báo.

## 7. Validate và check-in bằng operator

Chọn vé ISSUED, chưa check-in. Đây là thay đổi thật; vé dùng case này không dùng lại để hủy vé chưa lên xe.

```powershell
$qaOperatorLogin = Invoke-QaApi -Method POST -Route '/api/v1/auth/login' -Body @{ identifier='operator.b@demo.test'; password='OperatorPass1' }
if ($qaOperatorLogin.Status -ne 200) { throw 'Operator login failed' }
$qaOperatorToken = $qaOperatorLogin.Body.accessToken
$qaTicket = $qaNewTickets | Where-Object { $_.status -eq 'ISSUED' } | Select-Object -First 1
if (-not $qaTicket) { throw 'No issued ticket for this test' }
$qaValidation = Invoke-QaApi -Method POST -Route '/api/v1/tickets/validate' -Token $qaOperatorToken -Body @{
    tripId=$qaTicket.tripId; scannedToken=$qaTicket.publicCode; expectedVersion=0
}
$qaValidation.Body | Select-Object valid, reasonCode
if (-not $qaValidation.Body.valid) { throw 'Ticket not valid for check-in' }
$qaCheckIn = Invoke-QaApi -Method POST -Route ('/api/v1/tickets/' + $qaTicket.id + '/check-in') -Token $qaOperatorToken -Key ([guid]::NewGuid().ToString()) -Body @{
    tripId=$qaTicket.tripId
    scannedToken=$qaTicket.publicCode
    expectedVersion=$qaValidation.Body.ticket.rowVersion
}
$qaCheckIn.Status
$qaCheckIn.Body | Select-Object id, publicCode, status, checkedInAt, rowVersion
```

Muốn test duplicate check-in: đọc version mới và gửi lại với **key mới**; BE phải từ chối thao tác lần hai. Replay cùng idempotency key của một lần thành công có thể trả thành công cũ và vẫn đúng idempotency.

## 8. Preview hủy và hủy nhiều vé

Chạy trên **đơn khác chưa check-in**, chẳng hạn FAMILY hoặc một đơn mới riêng. Lấy booking/ticket bằng API thay vì đoán version.

```powershell
$qaCancelBookingId = '019aff01-0000-7000-8000-000000950001' # XB-FAMILY-1
$qaCancelBooking = Invoke-QaApi -Route ('/api/v1/bookings/' + $qaCancelBookingId) -Token $qaTokenB
$qaOwnTickets = Invoke-QaApi -Route '/api/v1/tickets?page=0&size=100' -Token $qaTokenB
$qaCancelTickets = @($qaOwnTickets.Body.items | Where-Object { $_.bookingId -eq $qaCancelBookingId -and $_.status -eq 'ISSUED' })
if ($qaCancelTickets.Count -eq 0) { throw 'No eligible ticket; choose a fresh test order' }
$qaPreview = Invoke-QaApi -Method POST -Route ('/api/v1/bookings/' + $qaCancelBookingId + '/cancellation-preview') -Token $qaTokenB -Key ([guid]::NewGuid().ToString()) -Body @{
    ticketIds = @($qaCancelTickets[0].id) # Chọn 1 vé để kiểm tra hủy một phần
}
$qaPreview.Status
$qaPreview.Body | Select-Object previewId, fee, refundAmount, expiresAt
```

Dừng ở đây để kiểm tra preview không làm đổi trạng thái. **Chỉ chạy đoạn tiếp khi muốn hủy thật vé đã chọn**:

```powershell
$qaCancel = Invoke-QaApi -Method POST -Route ('/api/v1/bookings/' + $qaCancelBookingId + '/cancel') -Token $qaTokenB -Key ([guid]::NewGuid().ToString()) -Body @{
    previewId = $qaPreview.Body.previewId
    reason = 'QA manual partial cancellation'
    expectedVersion = $qaCancelBooking.Body.rowVersion
}
$qaCancel.Status
$qaCancel.Body
```

Đọc lại cả ba ticket, inventory và booking. Không mặc định hủy một phần đã đúng nếu booking chỉ trả accepted; hai vé không chọn và hai ghế tương ứng phải được kiểm tra riêng.

## 9. Hoàn tiền thủ công, giới hạn và replay

Ví dụ dùng FB và `XB-EDGE-1`, đã hoàn 40%. Bắt đầu bằng đọc payment/refund; tài khoản khách không có quyền tạo finance refund.

```powershell
$qaFinanceLogin = Invoke-QaApi -Method POST -Route '/api/v1/auth/login' -Body @{ identifier='operator_finance.b@demo.test'; password='OperatorPass1' }
$qaFinanceToken = $qaFinanceLogin.Body.accessToken
$qaPartial = $qaManifest.scenarios | Where-Object { $_.tenant -eq 'B' -and $_.name -eq 'partial-refund' } | Select-Object -First 1
$qaPayment = Invoke-QaApi -Route ('/api/v1/payments/' + $qaPartial.paymentId) -Token $qaFinanceToken
$qaPayment.Body | Select-Object id, bookingId, status, amount, currency
$qaRefunds = Invoke-QaApi -Route '/api/v1/operator/refunds?page=0&size=100' -Token $qaFinanceToken
$qaSuccessful = @($qaRefunds.Body.items | Where-Object { $_.paymentId -eq $qaPartial.paymentId -and $_.status -eq 'SUCCEEDED' })
$qaRefunded = ($qaSuccessful | Measure-Object -Property amount -Sum).Sum
$qaRemaining = [long]$qaPayment.Body.amount - [long]$qaRefunded
$qaRemaining
```

Thử vượt hạn mức **không được tạo hoàn thành công**:

```powershell
$qaRefundKey = [guid]::NewGuid().ToString()
$qaRefundBody = @{
    refundReference = 'QA-OVER-' + [guid]::NewGuid().ToString('N')
    paymentId = $qaPartial.paymentId
    bookingId = $qaPartial.bookingId
    amount = $qaRemaining + 1
    currency = 'VND'
    reason = 'QA must reject over-refund'
}
$qaOverRefund = Invoke-QaApi -Method POST -Route '/api/v1/refunds' -Token $qaFinanceToken -Key $qaRefundKey -Body $qaRefundBody
$qaOverRefund.Status
$qaOverRefund.Body.error
```

Để hoàn thật một phần, tạo refundReference/key **mới**, amount dương nhỏ hơn hoặc bằng remaining mới nhất và chạy POST. Gửi lại cùng body/key hoặc reference để kiểm tra không nhân đôi hoàn tiền. Không tính `REQUESTED`, `PROCESSING`, `FAILED` vào tiền đã hoàn thành công.

## 10. Optimistic concurrency và token refresh

- Version conflict: lưu **nguyên body + expectedVersion cũ** của PATCH profile/trip, cập nhật thành công bằng cửa sổ A, sau đó gửi body cũ bằng B với key request mới. Mong đợi version conflict, dữ liệu A vẫn giữ. Đừng tự lấy version mới cho request B vì như vậy không còn test stale version.
- Refresh: POST `/api/v1/auth/refresh` với `{ refreshToken = $qaLoginB.Body.refreshToken }` và idempotency key. Sau refresh, dùng cặp token mới. Để test retry mạng, replay cùng body/key. Để test refresh token cũ sau rotation, dùng một request khác; có thể làm BE revoke cả family nên dùng session QA riêng, không dùng phiên đang test đặt vé.
- Logout: POST `/api/v1/auth/logout` với token của session QA và key. HTTP 204 không có body là đúng. Sau đó thử refresh session đã logout; không dùng việc access token cũ còn sống tới expiry để tự kết luận logout thất bại nếu contract chỉ revoke refresh session.

## 11. Dữ liệu trước/sau và bằng chứng

Trước mutation, lưu response vào biến hoặc file JSON trong thư mục `tmp/qa/` của FE, **không chứa response login/token**. Sau mutation, GET lại tài nguyên và so các field nghiệp vụ. Khi nhiều trang dữ liệu, đọc hết pagination trước khi cộng tiền hoặc đối chiếu số lượng; ví dụ trên dùng tối đa 100, nếu test đã tạo thêm quá 100 refund/ticket thì phải đọc các trang tiếp.

Không chạy lại loader với `--resume` để reset một case thất bại. Loader là công cụ nạp dữ liệu, không phải công cụ sửa kết quả test.
