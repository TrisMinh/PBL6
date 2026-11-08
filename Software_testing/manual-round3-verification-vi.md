# Hướng dẫn tự kiểm tra Round 3 bằng tay

Tài liệu này mô tả cách xác minh hai lỗi BOOK-02 và BOOK-07 đã sửa, cách kiểm tra các luồng SeatHold/Auth còn lại và cách đối chiếu kết quả với report. Dùng stack `pbl6-r2`; không chạy `down -v`, không xóa volume.

## 1. Khởi động đúng Docker project

Mở PowerShell tại thư mục gốc repo:

```powershell
docker compose -p pbl6-r2 `
  -f workspace/src/infra/docker-compose.yml `
  -f workspace/src/infra/docker-compose.apps.yml up -d --wait
```

Xác nhận container Booking healthy và gateway trả readiness:

```powershell
docker ps --filter name=pbl6-r2-booking-1
Invoke-RestMethod http://localhost:5080/ready
```

Kết quả mong đợi: `pbl6-r2-booking-1` có trạng thái `healthy`, readiness trả `healthy`.

Xác nhận migration của snapshot chính sách đã được áp dụng trên DB Round 2:

```powershell
docker exec pbl6-r2-postgres-1 psql -U platform -d booking -c `
  "select filename, applied_at from schema_migrations where filename='014_seat_hold_policy_snapshot.sql';"
```

Migration chỉ thêm cột `policy_snapshot`; nó không reset dữ liệu hiện có. Volume cần giữ nguyên là `pbl6-r2_postgres-data`.

## 2. Chuẩn bị Postman

Import environment `workspace/postman/PBL6_Local.postman_environment.json`, sau đó chọn environment đó. Kiểm tra `baseUrl`:

```text
http://localhost:5080/api/v1
```

Tài khoản fixture của môi trường R2:

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Customer 1 | `seed.customer@example.test` | `CustomerPass1` |
| Customer 2 | `pbl6.r3.customer.two@example.test` | `CorrectHorse1` |

Đăng nhập bằng `POST {{baseUrl}}/auth/login`, body:

```json
{
  "identifier": "seed.customer@example.test",
  "password": "CustomerPass1"
}
```

Copy `accessToken` trong response vào biến `customer1Token`. Đăng nhập Customer 2 tương tự và lưu `customer2Token`.

Khi chạy lại request có `Idempotency-Key`, hãy dùng key mới. Key đã dùng có thể trả lại response đã cache từ lần trước, kể cả sau khi backend được build lại.

### Kiểm tra hai định dạng số điện thoại

API chấp nhận số di động Việt Nam dạng nội địa `090...` và dạng E.164 `+849...`. Số nội địa được chuẩn hóa sang E.164 khi lưu; sau khi xác minh, đăng nhập bằng cả hai dạng đều thành công, và gửi lại cùng một số ở dạng còn lại bị từ chối như định danh trùng.

Postman run Round 3 đã xác nhận: `0901000997` trả 202, `+849000009997` trả 202, còn `+84901000997` (cùng số với `0901000997`) trả 409 `IDENTITY_ALREADY_USED`.

## 3. Xác minh BOOK-02 — policy snapshot trong SeatHold

Đọc danh sách ghế trước:

```http
GET {{baseUrl}}/trips/01990a00-0000-7000-8000-000000000007/seats
Authorization: Bearer {{customer1Token}}
```

Endpoint theo OpenAPI là `POST /api/v1/trips/{tripId}/seat-holds` (trong collection dùng `{{baseUrl}}/trips/{{tripId}}/seat-holds`). `2A`/`2B` là `seat_code` hiển thị trong danh sách ghế; trường body `seatIds` nhận UUID của ghế tương ứng, không nhận chuỗi mã ghế. Chuyến fixture có ghế 2A/2B tương ứng với các ID dưới đây. Chỉ tiếp tục nếu ghế 2A đang `AVAILABLE`:

```http
POST {{baseUrl}}/trips/01990a00-0000-7000-8000-000000000007/seat-holds
Authorization: Bearer {{customer1Token}}
Idempotency-Key: manual-book02-<mã-mới>
Content-Type: application/json
```

```json
{
  "seatIds": ["01990a00-0000-7000-8000-000000000043"],
  "pickupStopId": "01990a00-0000-7000-8000-000000000004",
  "dropoffStopId": "01990a00-0000-7000-8000-000000000005"
}
```

Kiểm tra response là **201 Created** và có:

- `holdToken`
- `expiresAt`
- `seats[0].price`
- `policySnapshot` dạng object, gồm `policyVersion` và `allowPayLater`

Fixture R2 hiện dùng `policyVersion: "cancel-mvp-v1"`, `allowPayLater: true` và `baseFare: 150000`.

Tiếp tục kiểm tra snapshot được lưu theo hold bằng:

```http
GET {{baseUrl}}/seat-holds/{{holdToken}}
Authorization: Bearer {{customer1Token}}
```

`policySnapshot` trong response đọc lại phải giống response tạo hold. Cuối cùng giải phóng ghế:

```http
DELETE {{baseUrl}}/seat-holds/{{holdToken}}
Authorization: Bearer {{customer1Token}}
Idempotency-Key: manual-book02-release-<mã-mới>
```

Kết quả mong đợi: **204 No Content**.

## 4. Xác minh BOOK-07 — chuyến không còn bán

Fixture chuyến `01a18b07-9a75-756d-8f13-0d5e8c90a025` đang ở trạng thái `CANCELLED`. Gửi:

```http
POST {{baseUrl}}/trips/01a18b07-9a75-756d-8f13-0d5e8c90a025/seat-holds
Authorization: Bearer {{customer1Token}}
Idempotency-Key: manual-book07-<mã-mới>
Content-Type: application/json
```

```json
{
  "seatIds": ["01a18b07-9f35-70ac-af07-934a5f14e04b"],
  "pickupStopId": "01990a00-0000-7000-8000-000000000004",
  "dropoffStopId": "01990a00-0000-7000-8000-000000000005"
}
```

Kết quả mong đợi: **409 Conflict**, body có `error.code: "TRIP_NOT_SELLABLE"`; không tạo hold.

Chạy thêm cùng request với trip có trạng thái `DEPARTED`. Trong lần xác minh Round 3, trip thử `01a18b06-7537-78b0-8952-4413bcadc98d` được chuyển tạm ở booking snapshot sang `DEPARTED`, POST trả 409 `TRIP_NOT_SELLABLE`, sau đó fixture được khôi phục về `SCHEDULED`. Không sửa trạng thái chuyến chính `01990a00-0000-7000-8000-000000000007`.

## 5. Các ca SeatHold còn lại

- **BOOK-01:** GET danh sách ghế bằng Customer 1. Round 3 quan sát `AVAILABLE`/`BOOKED`; ghế `HELD` được kiểm tra tại BOOK-02/03. Để kiểm tra serialization `DISABLED`, fixture local đã tạm đặt ghế 1B thành `DISABLED`, gọi GET seats và xác nhận API trả đúng trạng thái, rồi khôi phục về `AVAILABLE`.
- **BOOK-03:** giữ đồng thời ghế 2A và 2B; response 201, hai ghế HELD cùng một `holdToken`; sau đó release hold.
- **BOOK-04:** Customer 2 giữ 2A; Customer 1 gửi request `[2B, 2A]`; mong đợi 409 `SEAT_UNAVAILABLE`, 2B vẫn AVAILABLE; release hold của Customer 2.
- **BOOK-05:** chuẩn bị hai request cùng giữ một ghế AVAILABLE, dùng hai token và hai idempotency key khác nhau, rồi bấm Send gần như đồng thời. Mong đợi đúng một 201 và một 409. Release hold thắng.
- **BOOK-06:** gửi POST seat-holds không có Authorization; mong đợi 401 `AUTHENTICATION_REQUIRED`.
- **BOOK-08:** gửi cùng body và cùng Idempotency-Key hai lần; hai response phải có cùng `holdToken`; release hold sau khi kiểm tra.
- **BOOK-09, lazy path:** tạo hold, chờ đến sau `expiresAt`, rồi GET danh sách ghế. Ghế phải trở lại AVAILABLE; DB ghi hold EXPIRED. Thời hạn của fixture hiện là 10 phút.
- **BOOK-09, proactive path tự nhiên (đã chạy Round 3):** Postman tạo hold ghế 1B lúc `11:10:49 UTC`, `expiresAt=11:20:49 UTC`. Không gọi GET/POST trong lúc chờ. DB ghi `EXPIRED`, `released_at=11:21:00.465 UTC`, ghế `1B=AVAILABLE` trước request API tiếp theo. Sau đó Postman chạy 3 request/assertion đều Passed: login, GET hold trả `EXPIRED`, GET danh sách ghế trả 1B `AVAILABLE` (`booking09-natural-expiry-check-run.json`).
- **BOOK-09, fixture tăng tốc:** khi không thể chờ 10 phút, chỉ trên DB local `pbl6-r2`, có thể điều chỉnh timestamp của đúng hold thử như SQL dưới đây. Đây là kiểm tra logic worker với thời gian fixture; không thay thế phép chờ TTL thật.

```sql
-- Chỉ dùng với hold thử ở database local pbl6-r2.
SELECT id, status, expires_at
FROM seat_holds
WHERE idempotency_key = '<Idempotency-Key-vua-dung>';

UPDATE seat_holds
SET created_at = now() - interval '11 minutes',
    expires_at = now() - interval '1 minute'
WHERE id = '<hold_id_cua_ca_thu>' AND status = 'ACTIVE';

SELECT h.status, h.released_at, i.seat_code, s.status AS seat_status
FROM seat_holds h
JOIN seat_hold_items i ON i.seat_hold_id = h.id
JOIN trip_seats s ON s.id = i.trip_seat_id
WHERE h.id = '<hold_id_cua_ca_thu>';
```

SQL trên giữ nguyên ràng buộc `expires_at = created_at + 10 minutes`. Dùng hold thử mới cho mỗi lần chạy vì hold đã hết hạn là dữ liệu terminal.

## 6. Chạy lại collection và integration test

Để chạy toàn bộ collection Auth và SeatHold bằng Postman CLI:

```powershell
postman collection run workspace/postman/r3_two_features.postman_collection.json `
  -e workspace/postman/PBL6_Local.postman_environment.json --reporters cli,json `
  --reporter-json-export outputs/pbl6-round3/auth-manual-run.json

postman collection run workspace/postman/r3_pending_booking_cases.postman_collection.json `
  -e workspace/postman/PBL6_Local.postman_environment.json --reporters cli,json `
  --reporter-json-export outputs/pbl6-round3/booking-manual-run.json
```

Với fixture đã dùng, một số email/Idempotency-Key là dữ liệu một lần; đổi chúng sang giá trị mới trước khi chạy lại đăng ký hoặc tạo hold. Riêng AUTH-07 cần chạy đủ chuỗi register và sáu request resend với sáu Idempotency-Key khác nhau; trong cấu hình local hiện tại năm lần đầu trả 202, lần thứ sáu trả 429 `RATE_LIMITED` và có `Retry-After`. Đây là ngưỡng cấu hình quan sát được, không phải số do SRS đặt ra.

AUTH-06 cần chạy bằng tài khoản Pending mới: verify OTP sai phải bị từ chối, sau đó cho challenge hết hạn (TTL thật 30 phút hoặc fixture DB local) rồi verify mã đúng phải trả 410; login phải bị từ chối và không cấp token. Report Round 3 dùng fixture timestamp tăng tốc và đã ghi rõ điều đó. AUTH-05 là luồng riêng với OTP đúng: verify trả 200, user chuyển ACTIVE và login được.

Để tăng tốc nhánh hết hạn AUTH-06 trong DB local, tra challenge bằng user vừa đăng ký rồi cập nhật riêng challenge đó. Giữ ràng buộc `expires_at > created_at`:

```sql
UPDATE auth_challenges
SET created_at = now() - interval '2 days',
    expires_at = now() - interval '1 minute'
WHERE id = '<challengeId-thu-moi>' AND status = 'ACTIVE';
```

Các collection và JSON run hậu kiểm được liệt kê trong `outputs/pbl6-round3/verified-evidence-index.md`. Các ca tạo hold trong collection tự release hold thành công; nếu một request thất bại giữa chừng, kiểm tra danh sách ghế trước khi chạy lại.

Chạy integration tests của Booking Service:

```powershell
dotnet test workspace/src/tests/booking/BusTicketPlatform.Booking.Api.IntegrationTests/BusTicketPlatform.Booking.Api.IntegrationTests.csproj --no-restore
```

Kết quả đã xác minh: AUTH-07 có 429 + Retry-After; AUTH-06 có OTP sai 422, OTP hết hạn 410 và login 401; API chấp nhận số di động local `090...` và E.164 `+84...` (đăng ký và đăng nhập sau kích hoạt); BOOK-01 có đủ bốn trạng thái; BOOK-07 CANCELLED và DEPARTED đều trả 409; BOOK-09 đã chờ hết TTL tự nhiên và xác nhận worker chuyển hold sang EXPIRED, ghế về AVAILABLE trước request kế tiếp. Report Round 3 có **16/16 test case Passed**; chi tiết theo request ở file run JSON trong evidence index. Workbook final hiện được giữ tại `Software testing/API_Test_Report.xlsx`.
