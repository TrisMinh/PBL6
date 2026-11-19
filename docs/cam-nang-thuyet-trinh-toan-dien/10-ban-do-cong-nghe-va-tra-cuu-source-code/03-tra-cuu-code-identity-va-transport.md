# Danh Bạ Giải Phẫu Thuần Mã Nguồn (Phần 2): Từng File & Từng Hàm Của `Identity` & `Transport`

> **Mục tiêu tài liệu**: Đi xuyên suốt **100% các file `.cs`** của `Identity Service` (`Port 5081`) và `Transport Service` (`Port 5082`), bóc tách trực tiếp **tên hàm, chữ ký tham số, thư viện/công nghệ gọi tới, thuật toán xử lý, và câu lệnh SQL thực thi bên dưới**.

---

## PHẦN A — `BusTicketPlatform.Identity.*` (`workspace/src/services/identity/`)

### 1. Tầng `Identity.Domain`
| File `.cs` | Class / Method | Thuật Toán & Kỹ Thuật Code Cụ Thể |
|---|---|---|
| `IdentityNormalizer.cs` | `NormalizeEmail`, `NormalizePhone`, `IsEmail`, `IsPhone`, `IsFullName` | Dùng **Compile-time Regex Source Generator `[GeneratedRegex]`** (Roslyn biên dịch máy trạng thái DFA ngay lúc build, không cấp phát/biên dịch Regex lúc runtime):<br>- `EmailRegex`: `^[^@\s]+@[^@\s]+\.[^@\s]+$`<br>- `PhoneRegex`: `^\+[1-9][0-9]{7,14}$` (chuẩn quốc tế E.164)<br>- `NormalizeEmail`: `.Trim().ToUpperInvariant()` để so sánh bất biến chữ hoa/thường trên Unique Index `normalized_email`. |
| `PasswordPolicy.cs` | `IsSatisfied(string password)` | Độ phức tạp $O(L)$ một lần duyệt chuỗi: kiểm tra `Length is >= 10 and <= 128`, dùng `password.Any(char.IsLetter)` (hỗ trợ cả chữ cái tiếng Việt Unicode) và `password.Any(char.IsDigit)`. |
| `UserStatuses.cs` | Hằng trạng thái | `PendingVerification = "PENDING_VERIFICATION"`, `Active = "ACTIVE"`, `Locked = "LOCKED"`, `Disabled = "DISABLED"`. |

---

### 2. Tầng `Identity.Infrastructure`
| File `.cs` | Class / Method | Công Nghệ, Mật Mã Học & Câu Lệnh SQL |
|---|---|---|
| `Security/Argon2PasswordHasher.cs` | `Hash(string)`, `Verify(string, string)` | **Thư viện**: `Konscious.Security.Cryptography.Argon2 1.3.1` (`Argon2id`).<br>- `Hash`: Sinh `salt = RandomNumberGenerator.GetBytes(16)` (CSPRNG của hệ điều hành), cấu hình `MemorySize = 8192` (8 MiB RAM chống GPU), `Iterations = 1`, `DegreeOfParallelism = 1`, băm ra `32 bytes`, lưu chuỗi 6 phần: `$"argon2id$m=8192$t=1$p=1${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}"`.<br>- `Verify`: Tách chuỗi bằng `.Split('$')`, lấy `salt` ở `parts[4]` và `expected` ở `parts[5]`, chạy lại `Argon2id` rồi so sánh bằng **`CryptographicOperations.FixedTimeEquals(actual, expected)`** (XOR hằng thời gian chống Timing Attack). |
| `Security/JwtTokenService.cs` | `IssueAccessToken(...)` | **Thư viện**: `System.IdentityModel.Tokens.Jwt 8.14.0`.<br>- Ký bằng `SigningCredentials(SymmetricSecurityKey(UTF8(signingKey)), SecurityAlgorithms.HmacSha256)`.<br>- Đóng gói mảng `List<Claim>`: `sub` (`user.Id`), `jti` (`Guid.CreateVersion7()`), `sid` (`sessionId`), **`ver`** (`user.AuthorizationVersion.ToString()`), **`org`** (nếu có nhà xe đang `ACTIVE`), và lặp từng mã vai trò gán vào `ClaimTypes.Role`. Hạn `expires = now.AddSeconds(900)` (15 phút). |
| `Security/ChallengeNotifier.cs` | `NotifyAsync`, `CapturingChallengeNotifier` | **Thư viện**: `System.Net.Mail.SmtpClient`.<br>- Lưu trữ kép: Nếu `CaptureChallenges = true` thì đẩy bản ghi OTP vào hàng đợi RAM `ConcurrentQueue` (phục vụ Integration Tests đọc lại mã 6 số không cần mở hòm mail). Nếu `Smtp:Host` có cấu hình, tạo `MailMessage` gửi tới Mailpit (`:1025`) hoặc SMTP thật, bọc `try/catch` log cảnh báo để lỗi SMTP không làm gãy giao dịch đăng ký. |
| `Persistence/IdentityRepository.cs` | Truy vấn 10 bảng PostgreSQL | **Thư viện**: `Npgsql 10.0.0`. Các câu SQL cốt lõi:<br>- `FindByIdentifierAsync`: Nếu chuỗi chứa `'@'` thì tra `WHERE normalized_email = @norm AND deleted_at IS NULL`, ngược lại tra `WHERE normalized_phone = @norm AND deleted_at IS NULL`.<br>- `RevokeFamilyAsync(Guid familyId, string reason, ...)`: `UPDATE refresh_sessions SET revoked_at = @now, revoke_reason = @reason WHERE family_id = @family AND revoked_at IS NULL;` — **chặt đứt toàn bộ cây phiên khi phát hiện đánh cắp Refresh Token!**<br>- `RevokeUserSessionsAsync`: Thu hồi toàn bộ phiên đang mở của 1 `user_id`.<br>- `CountRecentAuditsAsync`: Đếm số dòng `security_audits` trong cửa sổ 15 phút theo `reason_code = SHA256(normalizedEmail)` để làm **Rate Limiter cấp DB**.<br>- `CountPlatformAdminsAsync`: Đếm số lượng user `ACTIVE` có role `PLATFORM_ADMIN` để chặn hành vi tự khóa Admin cuối cùng của hệ thống. |
| `OutboxPublisher.cs` & `RegistrationEvents.cs` | `EnqueueAsync`, `UserRegisteredAsync` | Tuần tự hóa `EventMessage("UserRegistered")` ra JSONB và `INSERT INTO outbox_messages (...)` để `OutboxDispatchHostedService` đẩy lên exchange `platform.events` với routing key `identity.user.registered.v1`. |
| `SqlBaselineMigrator.cs` | `ApplyAsync` | Đọc luồng nhị phân `EmbeddedResource` (`000_integration_tables.sql`, `001_initial.sql`), kiểm tra bảng `schema_migrations`, đồng thời chạy DDL bổ sung tạo bảng `customer_preferences (user_id uuid PK, preferences jsonb)`. |

---

### 3. Tầng `Identity.Application` & `Identity.Api`
| File `.cs` | Các Hàm Trọng Tâm | Thuật Toán & Logic Kiểm Soát Cấp Dòng Lệnh |
|---|---|---|
| `AuthService.cs` | `RegisterAsync`, `VerifyAsync`, `LoginAsync`, `RefreshAsync`, `LogoutAsync`, `ForgotPasswordAsync`, `ResetPasswordAsync` | - **Băm OTP có muối theo Challenge ID**: `HashSecret($"{challengeId:N}:{code}")` bằng `SHA256.HashData` (2 người cùng nhận mã `123456` vẫn ra 2 mã băm hoàn toàn khác nhau, không đụng Unique Constraint `token_hash`!).<br>- **Thuật toán Lockout có tự hồi phục (`LoginAsync`)**: Nếu `Status == LOCKED && LockoutUntil <= UtcNow`, tự hạ cờ khóa trên RAM về `ACTIVE` để kiểm tra mật khẩu; nếu sai mật khẩu tăng `FailedLoginCount`, chạm ngưỡng `5` thì gán `Status = LOCKED, LockoutUntil = UtcNow.AddMinutes(15)` trả `423 ACCOUNT_LOCKED`.<br>- **Thuật toán Token Family Reuse Detection (`RefreshAsync`)**: Tra bảng `refresh_sessions` theo `SHA256(refreshToken)`. Nếu `session.RevokedAt is not null` $\rightarrow$ gọi ngay `RevokeFamilyAsync(session.FamilyId, "REUSE")`, ghi `security_audits` và trả `401 SESSION_REUSE_DETECTED`. Nếu hợp lệ $\rightarrow$ sinh `replacement` mới cùng `FamilyId`, cập nhật phiên cũ `revoked_at = now, replaced_by_session_id = replacement.Id, revoke_reason = 'ROTATED'`. |
| `ProfileService.cs` | `GetAsync`, `UpdateAsync` | Kiểm tra **Optimistic Concurrency** (`user.RowVersion != request.ExpectedVersion` $\rightarrow$ `409 VERSION_CONFLICT`). Nếu đổi `FullName`/`Phone` thì cập nhật ngay (`row_version + 1`); nếu đổi `Email` thì giữ nguyên email cũ, phát hành `EMAIL_VERIFICATION` challenge cho email mới và trả `202 Accepted` (chỉ ghi đè email thật sau khi `VerifyAsync` thành công!). |
| `AdminIdentityService.cs` | `SetStatusAsync`, `SetRolesAsync`, `AddMembershipAsync`, `ChangeMembershipAsync` | Chặn `actorId == targetUserId` (cấm tự nâng/hạ quyền chính mình), kiểm tra `CountPlatformAdminsAsync() <= 1` (cấm khóa Admin cuối cùng). Mọi thao tác khóa hoặc đổi Role đều tăng **`AuthorizationVersion + 1`** và gọi `RevokeUserSessionsAsync`. |
| `Identity.Api/Program.cs` | Cấu hình `JwtBearerEvents.OnTokenValidated` | Trên mỗi request có Bearer Token gọi vào `Identity.Api`, sự kiện `OnTokenValidated` đọc `sub` và `ver`, gọi `FindByIdAsync(userId)` đối chiếu trực tiếp `user.Status == "ACTIVE" && user.AuthorizationVersion == ver` — thu hồi hiệu lực JWT tức thì không cần chờ hết 15 phút! |
| `CustomerPreferencesEndpoints.cs` | `GET / PUT /api/v1/users/me/preferences` | Chống lỗ hổng **Stored XSS qua ảnh SVG**: kiểm tra `Avatar.Length <= 200_000` và ép khớp chính quy nghiêm ngặt `^data:image/webp;base64,[A-Za-z0-9+/=]+$` trước khi `INSERT ... ON CONFLICT (user_id) DO UPDATE` vào cột `jsonb`. |
| `AdminUserEndpoints.cs` & `IdentityOperatorStaffEndpoints.cs` | `/api/v1/admin/users`, `/api/v1/operator/staff` | Khởi tạo nhân sự nhà xe với mật khẩu mồi ngẫu nhiên 48 bytes không thể đoán (`RandomNumberGenerator.GetBytes(48)`), kiểm tra chống xóa/đình chỉ `OPERATOR_ADMIN` cuối cùng của tổ chức. |

---

## PHẦN B — `BusTicketPlatform.Transport.*` (`workspace/src/services/transport/`)

### 1. Tầng `Transport.Application/TransportService.cs` (1.008 dòng)
| Nhóm Chức Năng | Phương Thức Cụ Thể | Kỹ Thuật & Thuật Toán Trong Code |
|---|---|---|
| **Cô lập Đa thuê bao (Tenant Guard)** | `TryTenant(Actor actor, string[] roles, out Guid orgId, out AppError error)` | Kiểm tra Fail-Closed: `if (actor.OrganizationId is null \|\| !actor.Has(roles))` trả `403 ACCESS_DENIED`. Mọi hàm CRUD bên dưới chỉ dùng biến `orgId` rút ra từ hàm này, tuyệt đối không nhận `organizationId` từ request body. |
| **Quản lý Xe & Sơ đồ ghế** | `CreateBusAsync`, `UpdateBusAsync`, `SetSeatPermissionAsync`, `ReplaceSeatsAsync` | Chuẩn hóa biển số xe bằng LINQ `new string(plate.Where(char.IsLetterOrDigit).Select(char.ToUpperInvariant).ToArray())` để kiểm tra Partial Unique Index `uq_buses_active_plate`. Khi `ReplaceSeatsAsync`, gọi `BusHasActiveTripsAsync` chặn sửa sơ đồ ghế nếu xe đang gắn với chuyến chưa hoàn thành. |
| **Quản lý Tài xế** | `CreateDriverAsync`, `UpdateDriverAsync`, `ActivateDriverAsync`, `DeleteDriverAsync` | Tự động suy diễn trạng thái `EXPIRED` nếu `LicenseExpiresOn < DateOnly.FromDateTime(DateTime.UtcNow)`. Khi xóa mềm tài xế (`DeleteDriverAsync`), câu SQL dùng `NOT EXISTS (SELECT 1 FROM driver_assignments a JOIN trips t ...)` đảm bảo nguyên tử không thể xóa tài xế đang bận chạy chuyến! |
| **Xây dựng Tuyến & Điểm dừng** | `CreateRouteAsync`, `ReplaceRouteStopsAsync` | Kiểm tra tính liên tục của dãy chỉ số trạm dừng (`ordered.Select((item, idx) => item.Sequence == idx)`) và tính đơn điệu không giảm của thời gian di chuyển (`OffsetMinutes >= prev.OffsetMinutes`) trong $O(K \log K)$. |
| **Thuật toán Sinh Lịch Lặp Đa Tuần** | `CreateRecurringTripsAsync` (dòng 529–608) | 1. Đổi giờ khởi hành sang múi giờ Việt Nam `.ToOffset(TimeSpan.FromHours(7))` để lấy ngày bắt đầu `DateOnly`.<br>2. Ràng buộc cửa sổ tối đa 3 tháng (`EndDate <= start.AddMonths(3)`).<br>3. Duyệt từng ngày `date = start..EndDate`, lọc `Weekdays.Contains((int)date.DayOfWeek)`. Chỉ gọi DB chuẩn bị mẫu ở phần tử đầu `plans[0]`, các ngày sau nhân bản trên RAM bằng `with { Id = ids.NewUuidV7(), DepartureAt = ..., ArrivalAt = ... }` (giảm $N$ lần truy vấn DB xuống còn 1 lần!).<br>4. Kiểm tra chồng lấn giữa 2 chuyến liên tiếp trong $O(1)$: `plan.Assignment.Start < plans[^1].Assignment.End` (đã cộng đệm $\pm 1$ giờ).<br>5. Kiểm tra hạn bằng lái tài xế với chuyến xa nhất `plans[^1]` rồi ghi hàng loạt trong 1 Transaction `InsertTripsAsync`. |
| **Mở bán Chuyến 2 Pha & Vận hành** | `PublishTripAsync`, `TransitionTripAsync`, `CancelTripAsync`, `MarkInventoryReadyAsync` | - `PublishTripAsync`: Đóng gói 3 chuỗi JSON bất biến (`RouteSnapshot`, `BusSnapshot` chứa toàn bộ mảng ghế, `FareSnapshot` chứa `baseFare`, `policyVersion`, `allowPayLater`), lưu `status = 'SCHEDULED', sellable = false`. Bắt ngoại lệ `SCHEDULE_CONFLICT` từ GiST index, sau đó phát sự kiện `TripPublished`.<br>- `TransitionTripAsync`: Kiểm tra máy trạng thái bằng `switch` tuple `(from, to)` (`SCHEDULED -> BOARDING -> DEPARTED -> IN_TRANSIT -> ARRIVED -> COMPLETED`). Nếu người gọi chỉ có role `DRIVER`, bắt buộc thỏa `IsDriverAssignedToTripAsync(actor.UserId, tripId)`. |

---

### 2. Tầng `Transport.Infrastructure/Persistence/TransportRepository.cs` (1.091 dòng)
Các kỹ thuật SQL PostgreSQL bậc cao được sử dụng trực tiếp trong file này:
1. **Khoảng thời gian nửa mở `tstzrange(@winStart, @winEnd, '[)')` + Bắt lỗi GiST `23P01`**:
   - Dòng 889–890: `winStart = trip.DepartureAt.UtcDateTime.AddHours(-1)`, `winEnd = trip.ArrivalAt.UtcDateTime.AddHours(1)`.
   - Ký hiệu `'[)'` (đóng đầu trái, mở đầu phải) cho phép ca chạy kết thúc lúc `13:00` nối tiếp hoàn hảo với ca chạy tiếp theo bắt đầu lúc `13:00` mà không bị báo trùng điểm mút!
   - Dòng 579 & 607: `catch (PostgresException exception) when (exception.SqlState is "23P01" or "23505")` — mã `23P01` chính là `exclusion_violation` do chỉ mục cây `btree_gist` (`ex_bus_schedule` / `ex_driver_schedule`) ném ra khi 2 khoảng thời gian giao nhau (`&&`)!
2. **Truy vấn Tương quan Bên (`LEFT JOIN LATERAL (...) da ON TRUE` — dòng 814–818)**:
   - Lấy đúng 1 `driver_profile_id` ưu tiên cao nhất (`ORDER BY a.active DESC, a.created_at DESC, a.id DESC LIMIT 1`) cho mỗi dòng chuyến xe ngay trong 1 lần quét, tránh nhân bản dòng khi 1 chuyến từng đổi tài xế nhiều lần.
3. **Bộ máy Tìm kiếm 14 Bộ lọc Động + Toán tử Tập con JSONB `@>` (`SearchSellableAsync` — dòng 642–711)**:
   - Quy đổi múi giờ trực tiếp trong biểu thức lọc để khớp với Expression Index `ix_trips_public_search`: `(t.departure_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = @date`.
   - Kiểm tra điểm đón/trả trung gian bằng `EXISTS (SELECT 1 FROM route_stops rs WHERE rs.route_id = t.route_id AND rs.stop_id = @pickup AND rs.pickup_allowed)`.
   - Kiểm tra danh sách tiện ích xe (ví dụ `["WIFI", "USB"]`) bằng toán tử chứa JSONB của PostgreSQL: **`b.amenities @> @amenitiesJson::jsonb`**.
   - Sắp xếp ổn định chống nhảy trang bằng khóa phụ `ORDER BY {order}, t.id`.

---

### 3. Tầng `Transport.Api` (`TransportEndpoints.cs`, `AdminOrganizationProfiles.cs`, `TransportOperatorMetadata.cs`)
- **`AdminOrganizationProfiles.cs`**: Nối mở rộng bảng `organizations` với bảng JSONB `operator_resource_metadata`, sử dụng **toán tử ghép gộp JSONB `||` của PostgreSQL** (`SET data = operator_resource_metadata.data || EXCLUDED.data`) để cập nhật từng phần thông tin pháp lý (`legalName`, `taxId`, `address`, `contactName`) cùng khóa lạc quan `row_version`.
- **`TransportOperatorMetadata.cs`**:
  - Lưu metadata mở rộng (tối đa `128 KB` JSON) cho `buses`, `drivers`, `routes`, `organization`, dùng từ điển whitelist tên bảng `Tables` kết hợp `INSERT ... SELECT ... WHERE EXISTS(...)` để kiểm tra quyền sở hữu tổ chức nguyên tử trong 1 câu SQL.
  - Lưu trữ tệp đính kèm bằng lái tài xế (`operator_driver_files`, cột nhị phân `bytea`, giới hạn kích thước `1..10.485.760 bytes` = 10 MB, kiểm tra chặt MIME type `image/jpeg | image/png | application/pdf`).
