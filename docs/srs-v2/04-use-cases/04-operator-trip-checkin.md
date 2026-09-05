# 4.4.4. Nhóm Use Case — Vận hành nhà xe, Trip và check-in

[← Danh mục Use Case](./README.md)

## UC-OPS-01 — Quản lý thông tin nhà xe

| Thuộc tính | Nội dung |
|---|---|
| Mục tiêu | Duy trì thông tin Organization trong đúng tenant và permission. |
| Actor chính | Operator Staff có quyền quản lý Organization |
| Tiền điều kiện | Actor đã xác thực, có membership active và permission phù hợp. |
| Hậu điều kiện thành công | Thông tin được cập nhật và audit khi cần. |
| Hậu điều kiện thất bại | Dữ liệu cũ được giữ nguyên; không tác động tenant khác. |
| Liên kết | FR-OPS-001; BR-TENANT-*; AUTHZ-002..003 |

### Luồng chính

1. Actor mở hồ sơ nhà xe của mình.
2. Hệ thống lấy organization ID từ identity context.
3. Hệ thống trả các trường actor được phép xem/sửa.
4. Actor cập nhật tên hiển thị, liên hệ, mô tả hoặc thuộc tính được phép.
5. Hệ thống kiểm tra dữ liệu và permission.
6. Hệ thống lưu thay đổi, ghi version/audit và trả kết quả.

### Ngoại lệ

- Actor gửi organization ID khác tenant: từ chối mà không tiết lộ dữ liệu.
- Trường pháp lý cần quyền cao hơn: từ chối hoặc chuyển quy trình phê duyệt.
- Version cũ: trả conflict và yêu cầu tải lại dữ liệu.

## UC-OPS-02 — Quản lý xe và sơ đồ ghế

| Thuộc tính | Nội dung |
|---|---|
| Mục tiêu | Quản lý Bus và Seat template dùng để tạo Trip. |
| Actor chính | Operator Fleet Manager |
| Tiền điều kiện | Actor có permission trong tenant. |
| Hậu điều kiện thành công | Bus/Seat template được tạo, cập nhật hoặc deactivate hợp lệ. |
| Hậu điều kiện thất bại | Không thay đổi dữ liệu hoặc snapshot của Trip đã publish. |
| Liên kết | FR-OPS-002, FR-OPS-009; BR-SEAT-010; BR-DATA-004 |

### Luồng chính

1. Actor xem danh sách Bus trong tenant.
2. Actor tạo mới hoặc chọn Bus để cập nhật.
3. Hệ thống kiểm tra biển số chuẩn hóa, tính duy nhất, loại xe và trạng thái.
4. Actor cấu hình Seat template gồm mã ghế, tầng, hàng/cột, loại và trạng thái enabled.
5. Hệ thống kiểm tra mã ghế duy nhất trong Bus và lưu version template.
6. Thay đổi được áp dụng cho Trip tạo sau hoặc Trip chưa publish theo policy.

### Ngoại lệ

- Biển số/mã ghế trùng: từ chối và chỉ rõ trường lỗi.
- Bus đang được dùng bởi Trip tương lai: deactivate/cập nhật phải tuân thủ policy.
- Bus/Seat đã được tham chiếu: không hard delete.
- Thay đổi template sau publish: không sửa snapshot ghế của Trip đã bán.

## UC-OPS-03 — Quản lý tài xế

| Thuộc tính | Nội dung |
|---|---|
| Mục tiêu | Quản lý DriverProfile và tình trạng giấy phép trong tenant. |
| Actor chính | Operator Staff có quyền nhân sự/vận hành |
| Tiền điều kiện | Actor có permission; User/Driver membership hợp lệ khi liên kết. |
| Hậu điều kiện thành công | DriverProfile được cập nhật và sẵn sàng/không sẵn sàng cho assignment đúng trạng thái. |
| Hậu điều kiện thất bại | Không tạo assignment hoặc dữ liệu không hợp lệ. |
| Liên kết | FR-OPS-003, FR-OPS-009; BR-TRIP-002; BR-DATA-004 |

### Luồng chính

1. Actor xem danh sách DriverProfile trong tenant.
2. Actor tạo hoặc cập nhật profile, số giấy phép và ngày hết hạn.
3. Hệ thống kiểm tra định dạng, tính duy nhất phù hợp và membership.
4. Hệ thống lưu profile và trạng thái.
5. Driver active với license hợp lệ có thể được chọn khi lập Trip.

### Ngoại lệ

- License hết hạn: profile vẫn có thể lưu nhưng không được assignment theo policy.
- User thuộc tenant khác hoặc membership inactive: từ chối liên kết.
- Driver đã được tham chiếu: chỉ deactivate/soft delete.
- Cập nhật xung đột version: trả conflict.

## UC-OPS-04 — Quản lý tuyến và điểm dừng

| Thuộc tính | Nội dung |
|---|---|
| Mục tiêu | Quản lý Route và RouteStop làm đầu vào lập Trip. |
| Actor chính | Operator Scheduler |
| Tiền điều kiện | Actor có permission trong tenant. |
| Hậu điều kiện thành công | Route/Stop hợp lệ được lưu hoặc deactivate. |
| Hậu điều kiện thất bại | Không thay đổi Route đang được tham chiếu ngoài policy. |
| Liên kết | FR-OPS-004, FR-OPS-009; BR-DATA-004 |

### Luồng chính

1. Actor tạo hoặc chọn Route.
2. Actor nhập điểm đầu, điểm cuối, khoảng cách và thời lượng dự kiến.
3. Actor thêm điểm đón/trả, địa chỉ, tọa độ nếu có, thứ tự và offset thời gian.
4. Hệ thống kiểm tra thứ tự, tính duy nhất và logic điểm đầu/điểm cuối.
5. Hệ thống lưu Route và danh sách Stop theo version.

### Ngoại lệ

- Điểm đầu trùng điểm cuối hoặc stop order không hợp lệ: từ chối.
- Route đã được Trip tham chiếu: không hard delete.
- Thay đổi Route sau khi Trip đã publish: Trip giữ snapshot lịch sử; thay đổi chỉ áp dụng theo policy.

## UC-OPS-05 — Tạo và mở bán chuyến xe

| Thuộc tính | Nội dung |
|---|---|
| Mục tiêu | Công bố một Trip hợp lệ và có inventory ghế trước khi mở bán. |
| Actor chính | Operator Scheduler |
| Tiền điều kiện | Route, Bus, Driver, fare và policy hợp lệ trong tenant. |
| Hậu điều kiện thành công | Trip SCHEDULED, TripSeat snapshot sẵn sàng và Trip sellable. |
| Hậu điều kiện thất bại | Trip không mở bán. |
| Liên kết | FR-OPS-005..006; BR-TRIP-001..002; AC-OPS-003..004 |

### Luồng chính

1. Actor tạo draft Trip.
2. Actor chọn Route, Bus, Driver, thời gian khởi hành/đến, fare và policy.
3. Hệ thống kiểm tra tenant, dữ liệu bắt buộc, Bus/Driver active và license.
4. Hệ thống kiểm tra xung đột lịch Bus/Driver, bao gồm buffer.
5. Actor xem summary và xác nhận publish.
6. Hệ thống chuyển Trip SCHEDULED và chốt snapshot lịch, giá, policy và seat template.
7. Inventory TripSeat được tạo từ snapshot.
8. Sau khi inventory sẵn sàng, Trip được đánh dấu sellable và xuất hiện trong tìm kiếm.

### Ngoại lệ

- Xung đột lịch: từ chối publish và trả Trip/khung thời gian xung đột trong scope.
- Bus/Driver inactive hoặc license hết hạn: từ chối.
- Thời gian đến không sau thời gian đi: validation error.
- Tạo TripSeat thất bại: Trip chưa sellable; tác vụ được retry an toàn.
- Publish lặp: không tạo Trip hoặc inventory trùng.

### Sơ đồ liên quan

- [Sequence Publish Trip](../../diagrams/subdiagrams/sequences/sequence-publish-trip.html)
- [Robustness Create Trip](../../diagrams/subdiagrams/robustness/robustness-create-trip.html)
- [State Trip](../../diagrams/subdiagrams/states/state-trip.html)

## UC-OPS-06 — Vận hành Trip và danh sách hành khách

| Thuộc tính | Nội dung |
|---|---|
| Mục tiêu | Cho phép Operator/Driver xem dữ liệu vận hành và chuyển Trip đúng vòng đời. |
| Actor chính | Operator Operations, Driver |
| Tiền điều kiện | Actor có quyền theo tenant hoặc assignment. |
| Hậu điều kiện thành công | Manifest đúng scope được hiển thị; Trip chuyển trạng thái hợp lệ. |
| Hậu điều kiện thất bại | Không rò rỉ PII và không có chuyển trạng thái sai. |
| Liên kết | FR-BOOK-011; FR-OPS-007, FR-OPS-010; BR-TRIP-003; AUTHZ-005..007 |

### Luồng xem manifest

1. Actor chọn Trip thuộc phạm vi được phép.
2. Hệ thống kiểm tra tenant/assignment và Trip state.
3. Hệ thống trả danh sách ghế, Ticket, Passenger và điểm đón/trả ở mức tối thiểu theo role.
4. Actor có thể lọc theo trạng thái check-in/điểm đón nhưng không truy cập dữ liệu ngoài Trip.

### Luồng chuyển trạng thái

1. Actor chọn hành động phù hợp với trạng thái hiện tại.
2. Hệ thống kiểm tra actor, assignment, version và transition guard.
3. Hệ thống cập nhật Trip, ghi audit và thông báo thay đổi cần thiết.
4. Khi Trip COMPLETED, hệ thống cập nhật/khởi tạo xử lý trạng thái Ticket và báo cáo theo policy.

### Ngoại lệ

- Driver không được assignment: từ chối.
- Transition không hợp lệ: giữ nguyên state và trả mã lỗi nghiệp vụ.
- Version conflict: yêu cầu tải lại Trip.
- Projection/manifest chậm: hiển thị thời điểm cập nhật và không cho rằng dữ liệu là thời gian thực.

## UC-DRIVER-01 — Check-in hành khách

| Thuộc tính | Nội dung |
|---|---|
| Mục tiêu | Xác nhận một Ticket hợp lệ đã lên đúng Trip. |
| Actor chính | Driver, Operator Operations |
| Tiền điều kiện | Actor được phân công/có quyền; Trip ở trạng thái cho phép check-in. |
| Hậu điều kiện thành công | Ticket chuyển ISSUED → CHECKED_IN và có audit. |
| Hậu điều kiện thất bại | Ticket giữ nguyên trạng thái. |
| Liên kết | FR-TICKET-004..006; BR-TICKET-002..003; AC-TICKET-* |

### Luồng chính

1. Actor mở Trip được phân công hoặc thuộc tenant/quyền.
2. Actor quét QR hoặc nhập public code.
3. Hệ thống xác minh token/code, Ticket, Trip và quyền actor.
4. Hệ thống kiểm tra Ticket đang ISSUED và Trip cho phép check-in.
5. Hệ thống cập nhật Ticket CHECKED_IN, lưu actor/time/Trip và audit.
6. Giao diện hiển thị Passenger/ghế tối thiểu cần thiết và kết quả thành công.

### Ngoại lệ

- QR/code không hợp lệ: từ chối, không tiết lộ PII.
- Ticket thuộc Trip khác: từ chối và giữ nguyên Ticket.
- Ticket CANCELLED/REFUNDED/USED: từ chối với lý do phù hợp.
- Scan lặp: trả “đã check-in” cùng thời điểm/actor trước đó, không tạo check-in thứ hai.
- Actor mất assignment: từ chối dù client vẫn còn màn hình cũ.

### Sơ đồ liên quan

- [Robustness Check-in](../../diagrams/subdiagrams/robustness/robustness-check-in.html)
- [State Ticket và Refund](../../diagrams/subdiagrams/states/state-ticket-refund.html)

## UC-TRIP-01 — Hủy chuyến xe có vé đã bán

| Thuộc tính | Nội dung |
|---|---|
| Mục tiêu | Dừng Trip, vô hiệu Ticket liên quan và khởi tạo Refund an toàn. |
| Actor chính | Operator Operations, Admin |
| Actor phụ | Payment Gateway, Notification Provider |
| Tiền điều kiện | Actor có quyền; Trip chưa hoàn thành và transition hủy được policy cho phép. |
| Hậu điều kiện thành công | Trip CANCELLED; Ticket không còn sử dụng; Refund được tạo theo policy. |
| Hậu điều kiện thất bại | Không hủy một phần âm thầm; lỗi được retry hoặc đưa vào manual case. |
| Liên kết | FR-OPS-008; BR-TRIP-004..006; BR-CANCEL-008; AC-TRIP-001..002 |

### Luồng chính

1. Actor chọn Trip và nhập lý do hủy.
2. Hệ thống hiển thị số Booking/Ticket/Payment có thể bị ảnh hưởng.
3. Actor xác nhận command có idempotency key.
4. Hệ thống kiểm tra quyền, Trip state và version.
5. Hệ thống chuyển Trip CANCELLED và ghi logical cancellation.
6. Hệ thống xác định Booking/Ticket bị ảnh hưởng và vô hiệu quyền sử dụng.
7. Hệ thống tạo Refund cho khoản đủ điều kiện theo policy nhà xe.
8. Customer được thông báo; báo cáo/đối soát được cập nhật.

### Ngoại lệ và phục hồi

- Hủy lặp: trả cùng logical cancellation.
- Trip đã DEPARTED: yêu cầu quyền/quy trình đặc biệt hoặc từ chối theo policy.
- Xử lý batch gián đoạn: tiếp tục từ checkpoint; mỗi Booking/Refund có idempotency riêng.
- Refund lỗi: Trip và Ticket không quay lại trạng thái cũ; tạo retry/manual case.
- Notification lỗi: giao dịch vẫn có hiệu lực; retry Notification độc lập.

### Sơ đồ liên quan

- [Sequence Cancel Trip](../../diagrams/subdiagrams/sequences/sequence-cancel-trip.html)
- [Robustness Cancel Trip](../../diagrams/subdiagrams/robustness/robustness-cancel-trip.html)
- [State Trip](../../diagrams/subdiagrams/states/state-trip.html)

[← Danh mục Use Case](./README.md)
