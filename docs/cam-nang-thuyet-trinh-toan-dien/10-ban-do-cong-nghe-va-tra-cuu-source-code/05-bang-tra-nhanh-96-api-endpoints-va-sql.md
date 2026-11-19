# Danh Bạ Giải Phẫu Thuần Mã Nguồn (Phần 6): Ma Trận Toàn Bộ 96 HTTP Endpoints & Event Consumers $\rightarrow$ File C#, Dòng Lệnh, Thuật Toán & Bảng SQL

> **Mục tiêu tài liệu**: Cung cấp **bản đồ tra cứu trực diện 1-1** cho toàn bộ **96 điểm cuối Minimal API** và toàn bộ **Consumer RabbitMQ** trong `workspace/src/`. Khi cần dò bất kỳ API nào hoạt động bằng công nghệ gì, gọi hàm C# nào, nằm ở dòng mấy và khóa bảng PostgreSQL nào, chỉ cần tra trực tiếp tại đây.

---

## 1. `Identity Service (:5081)` — 22 Endpoints (`DB: identity`)

| HTTP Method & Đường Dẫn | Vị Trí Định Nghĩa (`File:Dòng`) | Hàm Tầng Application / Infra | Kỹ Thuật Code, Thuật Toán & Bảng SQL Tác Động |
|---|---|---|---|
| `POST /api/v1/auth/register` | `IdentityEndpoints.cs:13` | `AuthService.RegisterAsync` | `[GeneratedRegex]` chuẩn hóa Email/Phone E.164 $\rightarrow$ `PasswordPolicy` $O(L)$ $\rightarrow$ băm `Argon2id (m=8192)` $\rightarrow$ băm OTP `SHA256(challengeId:code)` $\rightarrow$ `users`, `auth_challenges`, `outbox_messages` (`UserRegistered`), gửi SMTP/Mailpit. |
| `POST /api/v1/auth/verify` | `IdentityEndpoints.cs:14` | `AuthService.VerifyAsync` | `IIdempotencyStore` $\rightarrow$ đối chiếu `SHA256` OTP, kiểm tra hạn & số lần thử $\rightarrow$ kích hoạt `users (status='ACTIVE')` hoặc đổi email chờ duyệt $\rightarrow$ cấp cặp `HS256 JWT` + `refresh_sessions` (`UUIDv7 family_id`). |
| `POST /api/v1/auth/resend-verification` | `IdentityEndpoints.cs:15` | `AuthService.ResendAsync` | **Anti-Enumeration (`202 Accepted` cố định)** + Rate Limit cấp DB đếm `security_audits` trong cửa sổ 15 phút theo `SHA256(normalizedEmail)`. |
| `POST /api/v1/auth/login` | `IdentityEndpoints.cs:16` | `AuthService.LoginAsync` | Tra `normalized_email` / `normalized_phone` $\rightarrow$ kiểm tra tự mở khóa sau 15 phút (`LockoutUntil <= UtcNow`) $\rightarrow$ `Argon2PasswordHasher.Verify` + `FixedTimeEquals` $\rightarrow$ sai 5 lần khóa `423 ACCOUNT_LOCKED` $\rightarrow$ cấp JWT (`sub, sid, ver, org, role`) + `refresh_sessions`. |
| `POST /api/v1/auth/refresh` | `IdentityEndpoints.cs:17` | `AuthService.RefreshAsync` | **Token Rotation + Family Reuse Detection**: Tra `SHA256(refreshToken)` trong `refresh_sessions`. Nếu `revoked_at IS NOT NULL` $\rightarrow$ gọi `RevokeFamilyAsync(familyId, "REUSE")` hủy cả họ phiên, trả `401 SESSION_REUSE_DETECTED`. Nếu hợp lệ $\rightarrow$ xoay vòng sinh phiên con nối `replaced_by_session_id`. |
| `POST /api/v1/auth/logout` | `IdentityEndpoints.cs:18` | `AuthService.LogoutAsync` | Thu hồi phiên hiện tại (`UPDATE refresh_sessions SET revoked_at = @now WHERE id = @sid`) kèm ghi vết `security_audits`. |
| `POST /api/v1/auth/forgot-password` | `IdentityEndpoints.cs:19` | `AuthService.ForgotPasswordAsync` | Luôn trả `202 Accepted` chống dò email + giới hạn tần suất qua `CountRecentAuditsAsync` + sinh challenge `PASSWORD_RESET`. |
| `POST /api/v1/auth/reset-password` | `IdentityEndpoints.cs:20` | `AuthService.ResetPasswordAsync` | Xác minh OTP $\rightarrow$ băm lại mật khẩu mới bằng `Argon2id` $\rightarrow$ tăng **`authorization_version + 1`** $\rightarrow$ `RevokeUserSessionsAsync` đá văng mọi thiết bị cũ tức thì. |
| `GET /api/v1/users/me` | `IdentityEndpoints.cs:23` | `ProfileService.GetAsync` | Kích hoạt `JwtBearerEvents.OnTokenValidated` đối chiếu nóng `AuthorizationVersion == claim("ver")` trên bảng `users`. |
| `PATCH /api/v1/users/me` | `IdentityEndpoints.cs:24` | `ProfileService.UpdateAsync` | Kiểm tra **Optimistic Concurrency** (`row_version == ExpectedVersion` $\rightarrow$ `409 VERSION_CONFLICT`). Đổi Email sẽ đi qua luồng xác nhận OTP trước khi ghi đè. |
| `GET /api/v1/users/me/preferences` | `CustomerPreferencesEndpoints.cs:15` | Truy vấn `Npgsql` trực tiếp | Đọc cột `preferences` kiểu `jsonb` từ bảng `customer_preferences` theo `sub` trong JWT. |
| `PUT /api/v1/users/me/preferences` | `CustomerPreferencesEndpoints.cs:26` | Truy vấn `Npgsql` trực tiếp | Chặn **SVG Stored XSS** bằng Regex trắng `^data:image/webp;base64,[A-Za-z0-9+/=]+$` và trần `<= 200KB` $\rightarrow$ `INSERT ... ON CONFLICT (user_id) DO UPDATE` vào `customer_preferences`. |
| `GET /api/v1/admin/users` | `IdentityEndpoints.cs:27` | `AdminIdentityService` | Phân trang `OFFSET/LIMIT` + lọc trạng thái, vai trò, từ khóa trên `users`, `user_roles`, `organization_memberships`. |
| `POST /api/v1/admin/users` | `AdminUserEndpoints.cs:20` | `IIdentityRepository` + `IPasswordHasher` | Khởi tạo tài khoản nội bộ có bảo vệ `IIdempotencyStore` và sinh mật khẩu ngẫu nhiên mật mã học. |
| `GET /api/v1/admin/users/{userId}` | `IdentityEndpoints.cs:28` | `IIdentityRepository.FindByIdAsync` | Nạp chi tiết hồ sơ người dùng, danh sách `roles` toàn cục và `organizationMemberships`. |
| `PATCH /api/v1/admin/users/{id}` | `AdminUserEndpoints.cs:35` | `AdminIdentityService` | Cập nhật thông tin hồ sơ người dùng dưới quyền `PLATFORM_ADMIN` kèm kiểm tra `expectedVersion`. |
| `PATCH /api/v1/admin/users/{userId}/status` | `IdentityEndpoints.cs:29` | `AdminIdentityService.SetStatusAsync` | Chặn tự khóa chính mình (`actorId == userId`), chặn khóa Admin cuối cùng (`CountPlatformAdminsAsync <= 1`), tăng `authorization_version + 1` và thu hồi mọi phiên. |
| `PUT /api/v1/admin/users/{userId}/roles` | `IdentityEndpoints.cs:30` | `AdminIdentityService.SetRolesAsync` | Thay thế tập vai trò toàn cục trong 1 Transaction, bảo vệ `PLATFORM_ADMIN` cuối cùng, tăng `authorization_version + 1`. |
| `GET /api/v1/admin/organizations/{orgId}/members` | `IdentityEndpoints.cs:31` | `IIdentityRepository` | Liệt kê nhân sự thuộc 1 nhà xe từ `organization_memberships` & `membership_roles`. |
| `POST /api/v1/admin/organizations/{orgId}/members` | `IdentityEndpoints.cs:32` | `AdminIdentityService.AddMembershipAsync` | Gán người dùng vào tổ chức nhà xe với danh sách vai trò (`OPERATOR_ADMIN`, `DRIVER`...), tăng `authorization_version + 1`. |
| `PATCH /api/v1/admin/organizations/{orgId}/members/{id}` | `IdentityEndpoints.cs:33` | `AdminIdentityService.ChangeMembershipAsync` | Đổi vai trò/trạng thái thành viên nhà xe kèm khóa lạc quan `row_version`. |
| `GET / POST / PATCH /api/v1/operator/staff` | `IdentityOperatorStaffEndpoints.cs:16..30` | `IIdentityRepository` | Quản trị nhân sự nội bộ trong phạm vi `claim("org")` của nhà xe; sinh mật khẩu mồi CSPRNG 48 bytes và chặn xóa `OPERATOR_ADMIN` cuối cùng của nhà xe. |

---

## 2. `Transport Service (:5082)` — 38 Endpoints (`DB: transport`)

| HTTP Method & Đường Dẫn | Vị Trí Định Nghĩa (`File:Dòng`) | Hàm Xử Lý C# | Kỹ Thuật Code, Thuật Toán & Bảng SQL Tác Động |
|---|---|---|---|
| `GET /api/v1/explore/routes` | `TransportEndpoints.cs:15` | `TransportService` | Gom nhóm các cặp `(origin, destination)` từ các chuyến đang mở bán phục vụ gợi ý trang chủ. |
| `GET /api/v1/trips` | `TransportEndpoints.cs:17` | `TransportRepository.SearchSellableAsync` | **Bộ lọc động 14 tiêu chí**: quy đổi `(t.departure_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`, `EXISTS` trên `route_stops`, toán tử chứa JSONB **`b.amenities @> @amenitiesJson::jsonb`**, `LEFT JOIN LATERAL` lấy tài xế chính, sắp xếp ổn định `ORDER BY ..., t.id`. |
| `GET /api/v1/trips/{tripId}` | `TransportEndpoints.cs:18` | `TransportService.GetTripAsync` | Trả thông tin chuyến công khai kèm mảng điểm dừng `stops` và cờ `allowPayLater`. |
| `GET /api/v1/trips/{tripId}/stops` | `TransportEndpoints.cs:19` | `TransportService.GetTripStopsAsync` | Đọc lộ trình các trạm đón/trả theo thứ tự `sequence ASC`. |
| `POST / GET /api/v1/admin/organizations` | `TransportEndpoints.cs:22..24` | `TransportService` | Khởi tạo và tra cứu tổ chức nhà xe (`organizations`) dành riêng cho `PLATFORM_ADMIN`. |
| `GET / PATCH /api/v1/admin/organizations/{id}/profile` | `AdminOrganizationProfiles.cs:19..24` | Truy vấn `Npgsql` trực tiếp | Ghép bảng `organizations` với `operator_resource_metadata`, cập nhật từng phần JSONB bằng toán tử **`data || EXCLUDED.data`** kèm `row_version`. |
| `GET / PATCH /api/v1/operator/organization` | `TransportEndpoints.cs:27..28` | `TransportService` | Đọc/cập nhật cấu hình nhà xe (bao gồm bật/tắt `allow_pay_later`), cô lập cứng theo `TryTenant` (`claim("org")`). |
| `GET / POST / PATCH /api/v1/operator/buses[/{busId}]` | `TransportEndpoints.cs:29..31` | `TransportService.*BusAsync` | Chuẩn hóa biển số chữ-số in hoa, kiểm tra Partial Unique Index `uq_buses_active_plate`, lưu tiện ích cột `jsonb`. |
| `POST /api/v1/operator/buses/{busId}/deactivate` | `TransportEndpoints.cs:32` | `TransportService.DeactivateBusAsync` | Ngừng kích hoạt xe nếu không vướng chuyến đang hoạt động (`BusHasActiveTripsAsync`). |
| `PUT /api/v1/operator/buses/{busId}/seats` | `TransportEndpoints.cs:33` | `TransportService.ReplaceSeatsAsync` | Thay thế toàn bộ ma trận ghế mẫu `bus_seats` trong 1 Transaction khi xe chưa gắn chuyến chạy. |
| `PATCH /api/v1/operator/buses/{busId}/seats/{code}/permission` | `TransportEndpoints.cs:34` | `TransportService.SetSeatPermissionAsync` | Khóa/mở bán từng ghế vật lý lẻ trên sơ đồ xe (`active = true/false`). |
| `GET / POST / PATCH / DELETE /api/v1/operator/drivers[/{id}]` | `TransportEndpoints.cs:35..40` | `TransportService.*DriverAsync` | Tự động suy diễn `EXPIRED` theo hạn bằng lái `DateOnly`; xóa mềm nguyên tử với mệnh đề `NOT EXISTS (SELECT 1 FROM driver_assignments ...)`. |
| `GET / POST / PATCH / PUT stops / deactivate /api/v1/operator/routes` | `TransportEndpoints.cs:41..45` | `TransportService.*RouteAsync` | Kiểm chứng dãy chỉ số liên tục `Sequence == 0..k-1` và tính đơn điệu không giảm của `OffsetMinutes` trước khi ghi `routes` & `route_stops`. |
| `GET / POST / PATCH /api/v1/operator/trips[/{tripId}]` | `TransportEndpoints.cs:46..49` | `TransportService.*TripAsync` | Tạo chuyến nháp `DRAFT`, tính cửa sổ bảo vệ nửa mở `tstzrange(dep - 1h, arr + 1h, '[)')`, bắt ngoại lệ **`SqlState == "23P01"` (`btree_gist` exclusion)** trả `409 SCHEDULE_CONFLICT`. |
| `POST /api/v1/operator/trips/recurring` | `TransportEndpoints.cs:48` | `TransportService.CreateRecurringTripsAsync` | **Thuật toán nhân bản lịch chạy đa tuần $O(D)$**: quy chiếu `UTC+7`, nhân bản bản ghi mẫu bằng `record with`, kiểm tra chồng lấn liền kề $O(1)$ và ghi hàng loạt trong 1 Transaction. |
| `POST /api/v1/operator/trips/{tripId}/publish` | `TransportEndpoints.cs:50` | `TransportService.PublishTripAsync` | **Mở bán 2 pha (Pha 1)**: Đóng băng 3 JSONB Snapshots (`route_snapshot`, `bus_snapshot`, `fare_snapshot`), đặt `status='SCHEDULED', sellable=false`, chèn `TripPublished` vào `outbox_messages`. |
| `POST /api/v1/operator/trips/{tripId}/cancel` | `TransportEndpoints.cs:51` | `TransportService.CancelTripAsync` | Hủy chuyến, giải phóng phân công xe/tài xế (`active = false`), phát sự kiện `TripCancelled` kích hoạt hoàn tiền 100% bên Booking/Payment. |
| `POST /api/v1/operator/trips/{tripId}/status-transitions` | `TransportEndpoints.cs:52` | `TransportService.TransitionTripAsync` | Thực thi máy trạng thái `SCHEDULED -> BOARDING -> DEPARTED -> IN_TRANSIT -> ARRIVED -> COMPLETED`; nếu role `DRIVER` thì bắt buộc khớp `IsDriverAssignedToTripAsync`. |
| `DELETE /api/v1/operator/trips/{tripId}` | `TransportEndpoints.cs:53` | `RejectHardDeleteAsync` | Cố ý chặn xóa vật lý chuyến xe để bảo toàn lịch sử kiểm toán giao dịch. |
| `GET /api/v1/driver/assignments` | `TransportEndpoints.cs:55` | `TransportService.GetAssignmentsAsync` | Liệt kê lịch phân công chạy xe của riêng tài xế đang đăng nhập (`actor.UserId`). |
| `POST /internal/trips/{tripId}/inventory-ready` | `TransportEndpoints.cs:56` | `TransportService.MarkInventoryReadyAsync` | Endpoint nội bộ (bị YARP chặn ngoài Internet) để bật `sellable = true` trong kiểm thử tích hợp. |
| `GET / PUT /api/v1/operator/resource-metadata/...` | `TransportOperatorMetadata.cs:18..32` | Truy vấn `Npgsql` trực tiếp | Lưu metadata JSONB mở rộng ($\le 128\text{ KB}$) với whitelist tên bảng và kiểm tra quyền sở hữu `EXISTS(...)` nguyên tử. |
| `POST / GET / DELETE /api/v1/operator/driver-files[/{id}]` | `TransportOperatorMetadata.cs:44..68` | Truy vấn `Npgsql` trực tiếp | Tải lên/tải xuống hồ sơ bằng lái nhị phân `bytea` ($\le 10\text{ MB}$, chỉ cho phép `jpeg/png/pdf`). |

---

## 3. `Booking Service (:5083)` — 22 Endpoints (`DB: booking`)

| HTTP Method & Đường Dẫn | Vị Trí Định Nghĩa (`File:Dòng`) | Hàm Xử Lý C# | Kỹ Thuật Code, Thuật Toán & Bảng SQL Tác Động |
|---|---|---|---|
| `GET /api/v1/trips/availability?ids=...` | `BookingEndpoints.cs:16` | `BookingService.GetAvailabilityAsync` | Gọi `ExpireHoldsAsync` (Lazy CTE thu hồi ghế quá hạn) rồi đếm `COUNT(*) FILTER (WHERE status='AVAILABLE')` theo lô tối đa 100 `trip_id`. |
| `GET /api/v1/trips/{tripId}/coupons` | `BookingEndpoints.cs:23` | `CouponRepository` | Liệt kê các mã khuyến mãi đang còn hiệu lực và còn hạn mức cho chuyến xe. |
| `POST /api/v1/coupons/quote` | `BookingEndpoints.cs:25` | `BookingService.QuoteCouponAsync` | Tính thử mức chiết khấu `min(cap, floor(subtotal * percent / 100))` trước khi chốt đơn. |
| `PUT /api/v1/admin/coupons` | `BookingEndpoints.cs:30` | `CouponRepository.UpsertAsync` | Tạo/cập nhật mã giảm giá dành cho `PLATFORM_ADMIN`. |
| `GET /api/v1/trips/{tripId}/seats` | `BookingEndpoints.cs:35` | `BookingService.GetSeatsAsync` | Chạy `ExpireHoldsAsync` $\rightarrow$ trả danh sách ghế thực tế từ `trip_seats` kèm `serverTime` để đồng bộ đồng hồ đếm ngược. |
| `POST /api/v1/trips/{tripId}/seat-holds` | `BookingEndpoints.cs:36` | `BookingRepository.CreateHoldAsync` | **Khóa bi quan All-or-Nothing**: `SELECT id, price FROM trip_seats WHERE ... AND status='AVAILABLE' FOR UPDATE` $\rightarrow$ tạo phiên giữ chỗ 10 phút (`seat_holds`). |
| `GET / DELETE /api/v1/seat-holds/{**holdToken}` | `BookingEndpoints.cs:37..38` | `BookingService.GetHoldAsync / ReleaseHoldAsync` | Tham số catch-all `{**holdToken}` nhận token Base64; giải phóng ghế ngay lập tức về `AVAILABLE` khi khách hủy chọn. |
| `PUT /api/v1/seat-holds/{**holdToken}` | `BookingEndpoints.cs:39` | `BookingRepository.ReplaceHoldAsync` | **Chống Deadlock bằng thứ tự khóa toàn phần**: `SELECT ... FROM trip_seats WHERE (id = ANY(@ids) OR active_hold_id = @hold) ORDER BY id FOR UPDATE`. |
| `POST /api/v1/bookings` | `BookingEndpoints.cs:40` | `BookingService.CreateBookingAsync` | Khóa `FOR SHARE` trên `coupons` $\rightarrow$ chia tiền giảm giá lũy kế không lệch đồng lẻ (`cumulativeDiscount`) $\rightarrow$ `SET CONSTRAINTS ALL DEFERRED` $\rightarrow$ ghi `bookings`, `booking_items`, `passengers`, chuyển ghế sang `BOOKED`, phát `BookingCreated`. Nếu `PAY_LATER` thì phát hành luôn `tickets`. |
| `GET /api/v1/bookings` & `GET /api/v1/bookings/{id}` | `BookingEndpoints.cs:41..42` | `BookingService` | Tra cứu danh sách và chi tiết đơn đặt vé của chính khách hàng (`customer_id_external == actor.UserId`). |
| `POST /api/v1/bookings/{id}/cancellation-preview` | `BookingEndpoints.cs:43` | `BookingService.PreviewCancellationAsync` | Áp hàm bậc thang `CancellationPolicy.For` (`24h: 10%`, `6h: 20%`, `2h: 30%`, `<2h: chặn`), lưu bản xem trước có hạn vào `cancellation_previews`. |
| `POST /api/v1/bookings/{id}/cancel` | `BookingEndpoints.cs:44` | `BookingService.CancelAsync` | Đối chiếu `previewId` + `expectedVersion`, hủy vé, trả ghế về `AVAILABLE`, phát sự kiện `BookingCancelled` / `RefundRequested` qua `outbox_messages`. |
| `GET /api/v1/bookings/{id}/tickets` & `GET /api/v1/tickets[/{id}]` | `BookingEndpoints.cs:45..54` | `BookingService` | Trả danh sách vé điện tử kèm chuỗi ký số `qrPayload` (`BT1.<hexId>.<HMACSHA256>`). |
| `POST /api/v1/tickets/lookup` | `BookingEndpoints.cs:52` | `BookingService.LookupTicketsAsync` | Bọc `RequireRateLimiting("ticket-lookup")` (`40 req/phút`), đối chiếu `bookingCode + email/phone`, cấp `TicketLookupToken` nhị phân 56 bytes (`stackalloc`, Base64Url 75 ký tự, hạn 14 phút). |
| `GET /api/v1/tickets/lookup/{code}` | `BookingEndpoints.cs:53` | `BookingService.LookupTicketByTokenAsync` | Xác thực `TicketLookupToken.TryRead` bằng `Span<byte>` + `FixedTimeEquals` để khách vãng lai xem vé không cần tài khoản. |
| `POST /api/v1/tickets/validate` & `POST .../check-in` | `BookingEndpoints.cs:55..56` | `BookingService.ValidateAsync / CheckInAsync` | Giải mã đa định dạng `ResolveScannedAsync` (QR `BT1` $\rightarrow$ `SHA256` hash $\rightarrow$ `public_code` $\rightarrow$ `Guid`), kiểm tra đúng chuyến `tripId` và đánh dấu `USED` nguyên tử chống lên xe 2 lần. |
| `GET /api/v1/operator/trips/{tripId}/manifest` | `BookingEndpoints.cs:57` | `BookingService.GetManifestAsync` | Xuất danh sách hành khách lên xe cô lập theo `organization_id` của nhà xe / tài xế. |
| `GET /api/v1/admin/bookings` & `/operator/bookings` | `BookingEndpoints.cs:58..59` | `BookingService.SearchAsync` | Tra cứu đơn đặt chỗ đa điều kiện (Admin xem toàn sàn, Operator tự động bị ép lọc theo `claim("org")`). |
| `POST /api/v1/internal/trips/published` & `.../payments/succeeded` | `BookingEndpoints.cs:60..61` | `ImportAsync`, `PaymentSucceededAsync` | Các điểm nối nội bộ phục vụ kiểm thử tích hợp trực tiếp không qua broker (đã bị YARP chặn truy cập từ bên ngoài). |

---

## 4. `Payment (:5084)`, `Notification (:5085)` & `Reporting (:5086)` — 25 Endpoints + 4 RabbitMQ Consumers

| Dịch Vụ | HTTP Route / Queue Consumer | Vị Trí (`File:Dòng`) | Kỹ Thuật Code, Khóa Đồng Thời & Thuật Toán Thực Thi |
|---|---|---|---|
| **Payment** | `GET /api/v1/payment-methods` | `PaymentEndpoints.cs:16` | Trả cấu hình phương thức khả dụng (`SEPAY` và các phương thức đã cấu hình) từ `SePayOptions`. |
| **Payment** | `POST /api/v1/bookings/{id}/payments` | `PaymentEndpoints.cs:30` | `WaitForQuoteAsync` đợi giá chuẩn từ `booking_quotes` $\rightarrow$ `pg_advisory_xact_lock(hashtext(@booking))` chặn tạo 2 lệnh thanh toán mở song song $\rightarrow$ ký URL chuyển hướng `SePayCheckout.BuildAction` (`HMACSHA256`) hoặc `VnPayCheckout.BuildCheckoutUrl` (`HMACSHA512`). |
| **Payment** | `GET /api/v1/bookings/{id}/payments`, `GET / POST cancel /api/v1/payments/{id}` | `PaymentEndpoints.cs:31..33` | Kiểm tra quyền sở hữu `customer_id` / `org` và hủy giao dịch đang chờ. |
| **Payment** | `POST /integrations/payments/sepay/ipn` | `PaymentEndpoints.cs:46` | Xác thực `Apikey` bằng **Double-SHA256 + `FixedTimeEquals`** $\rightarrow$ `SePayIpn.Parse` $\rightarrow$ `SePayPaymentStore.ApplySePayAsync` (2 `pg_advisory_xact_lock` + `FOR UPDATE` + `webhook_receipts` + chốt `booking_settlements` 10% + `outbox_messages`, hoặc tự động xếp hàng hoàn tiền `LATE_PROVIDER_SUCCESS`). |
| **Payment** | `GET /integrations/payments/sepay/browser-return` | `PaymentEndpoints.cs:22` | Giải mã trạng thái cầu nối `LocalReturnState` (`HMACSHA256` + kiểm tra `uri.IsLoopback`) để chuyển hướng an toàn từ Cloudflare Tunnel về cổng `localhost` đang mở. |
| **Payment** | `POST /integrations/payments/{provider}/webhooks` và `GET .../return` | `PaymentEndpoints.cs:46–47` | Callback tương thích cho VNPay. Cấu hình mặc định tắt nhánh này. |
| **Payment** | `POST / GET /api/v1/refunds`, `/admin/payments`, `/admin/refunds`, `/operator/refunds` | `PaymentEndpoints.cs:34..39` | `TryApplyRefundAsync`: khóa `payments FOR UPDATE`, kiểm tra tổng hoàn không vượt gốc, tính lại hoa hồng sàn trên phần tiền giữ lại `remaining`. |
| **Payment** | `GET /api/v1/operator/settlements`, `/admin/settlements`, `POST /admin/payouts` | `PaymentEndpoints.cs:40..42` | Đối soát công nợ hoa hồng 10% và chốt kỳ giải ngân về tài khoản nhà xe (`payouts`). |
| **Notification** | `POST /api/v1/customer-requests/support` & `.../partner` | `Notification.Api/Program.cs:33..34` | Bọc `RequireRateLimiting("customer-requests")` (`30 req/phút`), kiểm tra Regex SĐT Việt Nam, sinh mã `BLUE-SUP-` / `BLUE-NX-` lưu JSONB vào `customer_requests`. |
| **Notification** | `GET /api/v1/notifications` & `PATCH .../{id}/read` | `Notification.Api/Program.cs:36..44` | **Keyset Cursor Pagination** (`WHERE created_at < @cursor ORDER BY created_at DESC, id DESC LIMIT @limit`) đạt tốc độ $O(\log N)$ không dùng `OFFSET`. |
| **Reporting** | `GET /api/v1/reports/{revenue \| bookings \| occupancy}` | `Reporting.Api/Program.cs:35..47` | Đọc trực tiếp từ bảng chiếu **CQRS Read Model** (`revenue_projections`, `booking_projections`), ép lọc `organization_id_external = claim("org")` với Operator để chống rò rỉ doanh thu chéo nhà xe. |
| **4 Consumers** | `transport.*`, `booking.*`, `payment.*`, `notification.*`, `reporting.*` (`.q`) | `*EventHandlers.cs` + `IntegrationEventConsumerHost.cs` | Đọc AMQP bất đồng bộ (`AsyncEventingBasicConsumer` của `RabbitMQ.Client 7.1.2`), khử trùng lặp qua `inbox_messages (event_id PK)`, cập nhật CSDL đích; nếu lỗi vượt ngưỡng đẩy sang `bus.dlx -> *.dlq`. |
