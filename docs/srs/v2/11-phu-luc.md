# 11. Phụ lục

[← Chương 10](./10-nghiem-thu-va-truy-vet.md) · [Mục lục](./README.md)

## 11.1. Danh mục mã lỗi baseline

| Code | HTTP gợi ý | Tình huống | Hành vi |
|---|---:|---|---|
| VALIDATION_ERROR | 400 | Dữ liệu không hợp lệ | Trả field error an toàn. |
| AUTHENTICATION_REQUIRED | 401 | Thiếu/hết hạn phiên | Yêu cầu đăng nhập/refresh. |
| ACCESS_DENIED | 403 | Sai role, tenant hoặc ownership | Không tiết lộ dữ liệu ngoài scope. |
| RESOURCE_NOT_FOUND | 404 | Không tìm thấy trong scope | Trả mã chung. |
| IDEMPOTENCY_CONFLICT | 409 | Cùng key nhưng payload khác | Không thực hiện command mới. |
| TRIP_NOT_SELLABLE | 409 | Trip đóng bán, đã đi hoặc bị hủy | Yêu cầu chọn Trip khác. |
| SCHEDULE_CONFLICT | 409 | Bus/Driver trùng lịch | Trả xung đột trong scope. |
| SEAT_UNAVAILABLE | 409 | Ghế không còn AVAILABLE | Trả seat code bị ảnh hưởng. |
| SEAT_HOLD_EXPIRED | 410 | SeatHold hết hạn | Yêu cầu giữ lại ghế. |
| PAY_LATER_NOT_ALLOWED | 409 | Nhà xe không bật trả sau | Không tạo Booking `PAY_LATER`. |
| PAYMENT_PROCESSING | 202 | Chưa có kết quả cuối | Client chờ/polling có backoff. |
| PAYMENT_VERIFICATION_FAILED | 422 | Webhook không hợp lệ/mismatch | Không xác nhận Booking; tạo log/case. |
| CANCELLATION_NOT_ALLOWED | 422 | Không thỏa policy | Trả lý do và policy snapshot. |
| INVALID_STATE_TRANSITION | 409 | Chuyển trạng thái không hợp lệ | Giữ state cũ và trả state hiện thời. |
| TICKET_ALREADY_CHECKED_IN | 409 | Scan lặp | Trả thời điểm check-in trước. |
| TICKET_NOT_VALID_FOR_TRIP | 422 | Ticket sai Trip | Không đổi Ticket. |
| UPSTREAM_UNAVAILABLE | 503 | Dependency thiết yếu lỗi | Retry-After nếu phù hợp. |
| RATE_LIMITED | 429 | Vượt rate limit | Trả Retry-After. |

Chi tiết code, schema và mapping HTTP được quản lý trong API Specification. Message tiếng Việt/tiếng Anh có thể thay đổi nhưng `code` không đổi trong cùng phiên bản contract.

## 11.2. Danh mục sơ đồ nghiệp vụ

### Use Case Diagram

- [Bộ Use Case Diagram Markdown — đủ 28 UC](../../system-design/02-02-use-case-diagrams/README.md)

### Activity Diagram

- [Bộ Activity Diagram Markdown — đủ BP-01..07](../../system-design/02-04-activity-diagrams/README.md)

### Sequence Diagram

- [Bộ Sequence Diagram Markdown — đủ 28 UC](../../system-design/02-03-sequence-diagrams/README.md)

### State Diagram

- [Bộ State Machine Markdown](../../system-design/02-05-state-machine-diagrams/README.md)

## 11.3. Sơ đồ/tài liệu thiết kế tham khảo

Các nội dung dưới đây hữu ích cho thiết kế nhưng không phải nguồn yêu cầu chính:

- [System Design](../../system-design/README.md)
- [Detailed Design](../../detailed-design/README.md)
- [Kiến trúc Microservices](../../system-design/02-01-system-architecture/02-01-04-microservices-architecture.md)
- [ERD Identity](../../system-design/02-07-database-erd/01-identity-db.md)
- [ERD Transport](../../system-design/02-07-database-erd/02-transport-db.md)
- [ERD Booking](../../system-design/02-07-database-erd/03-booking-db.md)
- [ERD Payment](../../system-design/02-07-database-erd/04-payment-db.md)
- [Kiến trúc triển khai](../../system-design/02-01-system-architecture/02-01-09-deployment-architecture.md)
- [Luồng event Payment](../../system-design/02-08-rabbitmq-event-flow/04-payment-booking-events.md)
- [Luồng event cancellation](../../system-design/02-08-rabbitmq-event-flow/05-cancellation-refund-events.md)
- [Luồng event Trip](../../system-design/02-08-rabbitmq-event-flow/03-trip-lifecycle-events.md)

## 11.4. Phân tách tài liệu

| Nội dung | Tài liệu sở hữu |
|---|---|
| Goal, BP, BR, UC, FR/NFR, state, UI, dữ liệu logic và AC | Bộ SRS này |
| Boundary, container, dependency và quyết định kiến trúc | Software Architecture Document |
| Endpoint, request/response, authentication và error schema | API/OpenAPI Specification |
| Event payload/version/compatibility | Event Contract Specification |
| ERD vật lý, PK/FK/index/migration | Database Design Document |
| Container, environment, secret, backup và release procedure | Deployment/Operations Guide |
| Test step, test data và evidence | Test Plan/Test Case Specification |

## 11.5. Quyết định baseline MVP 2.0

| Vấn đề | Quyết định | Trạng thái |
|---|---|---|
| Phạm vi | Triển khai và nghiệm thu toàn bộ `MUST`; chuyển toàn bộ `SHOULD/COULD` sang backlog sau MVP. | Accepted |
| Backend | C# target .NET 8 (`net8.0`) cho toàn bộ API, Worker, Gateway, class library và test project; dùng ASP.NET Core Web API, EF Core và YARP Gateway. | Accepted, cập nhật 2026-09-10 |
| Web | Customer Web và Back-office dùng React 19.2 + TypeScript/Vite trên Node.js 24 LTS và npm workspaces; tách application nhưng dùng chung package UI/tooling thuần kỹ thuật. | Accepted |
| Mobile | React Native 0.87 stable + TypeScript; dùng cùng OpenAPI, error code và state semantics với Web. | Accepted |
| Payment | Adapter port thống nhất; provider MVP là VNPay Sandbox cho `PREPAID`. `PAY_LATER` không đi qua cổng. Phí sàn mặc định 10% snapshot trên Organization, chỉ trừ khi thu `PREPAID`. | Accepted, cập nhật 2026-09-17 |
| Notification | In-app và email là kênh MVP; email qua SMTP adapter, local dùng Mailpit. Push/SMS là backlog `SHOULD/COULD`. | Accepted |
| SeatHold/payment window | Một transaction window 10 phút từ lúc tạo SeatHold cho chọn ghế/`PREPAID`. `PAY_LATER` không dùng cửa sổ thanh toán cổng. | Accepted, cập nhật 2026-09-17 |
| Hủy/đổi | Hủy Ticket theo policy versioned tại mục 11.5.1. Đổi vé là `SHOULD`, không thuộc MVP 2.0. | Accepted |
| Promotion/Review | Không thuộc MVP 2.0 vì là `SHOULD`; endpoint/UI/event liên quan mặc định tắt. | Accepted |
| Retention | Dùng baseline tại Chương 8 cho môi trường đồ án; production thực tế cần legal review trước go-live. | Accepted cho đồ án |
| Dataset/tải | Giữ ngưỡng NFR: tối thiểu 100.000 Trip và 300 User đồng thời cho kịch bản search/seat liên quan. | Accepted |
| Browser | Hai phiên bản ổn định gần nhất tại thời điểm release; responsive từ 360 px. | Accepted |
| Offline Ticket/QR | Customer có thể xem bản Ticket đã cache; check-in của Driver bắt buộc xác minh online trong MVP. | Accepted |
| Seat inventory | Một TripSeat chiếm quyền cho toàn bộ Trip; chưa bán lại cùng ghế theo các chặng không giao nhau. | Accepted |
| Xác minh tài khoản | Email và số điện thoại là dữ liệu đăng ký; MVP xác minh email. SMS OTP không thuộc MVP. | Accepted |

### 11.5.1. Policy hủy vé mặc định

Policy được cấu hình, có version và snapshot vào Booking/Ticket. Mốc thời gian tính theo `departureAt` của Trip:

| Thời điểm Customer xác nhận hủy | Phí hủy | Cho phép self-service |
|---|---:|:---:|
| Từ 24 giờ trở lên trước giờ đi | 10% giá trị Ticket | Có |
| Từ 6 giờ đến dưới 24 giờ | 20% giá trị Ticket | Có |
| Từ 2 giờ đến dưới 6 giờ | 30% giá trị Ticket | Có |
| Dưới 2 giờ hoặc sau giờ đi | Không áp dụng | Không |

- Phí làm tròn đến đồng theo quy tắc half-up; số tiền hoàn `PREPAID` bằng `paidAmount - cancellationFee`, không âm. `PAY_LATER`: hoàn nền tảng = 0.
- Nhà xe hủy Trip: hoàn 100% phần **đã thu `PREPAID`**; `PAY_LATER` hủy vé không hoàn cổng.
- Ticket `CHECKED_IN`, `USED`, `CANCELLED` hoặc `REFUNDED` không được Customer hủy.
- Policy riêng của Operator chỉ có hiệu lực sau khi được version hóa và snapshot vào Trip trước khi mở bán.

### 11.5.2. Passenger và Booking contact MVP

- Mỗi Passenger bắt buộc có `fullName`; `documentType/documentNumber` chỉ bắt buộc khi Trip policy yêu cầu.
- Booking bắt buộc có `contactName`, `contactEmail` và `contactPhone`; mặc định lấy từ hồ sơ nhưng Customer được sửa cho riêng Booking.
- Không yêu cầu ngày sinh/giới tính/CCCD nếu Trip policy không chứng minh nhu cầu.
- Email/phone/document được mask trong màn hình hỗ trợ, log và event theo data-classification rule.

## 11.6. Checklist baseline

- [x] Baseline active và lịch sử phiên bản đã được chỉ rõ trong `docs/README.md`.
- [x] Phạm vi MUST/SHOULD/COULD được chốt.
- [x] Mọi Use Case có actor, tiền/hậu điều kiện, luồng chính và ngoại lệ.
- [x] Mọi FR/NFR MUST có AC/Test Case design và coverage register.
- [x] Business Rule không mâu thuẫn state transition tại baseline tài liệu.
- [x] Web, Mobile và Back-office có scope rõ.
- [ ] Tenant isolation và ownership được kiểm thử âm tính.
- [ ] Payment callback lặp/trễ/sai amount có test.
- [ ] Double-booking có concurrency test.
- [x] Sơ đồ không chứa hành vi ngoài văn bản; node SHOULD/P1 được ghi rõ không thuộc runtime MVP.
- [x] Các liên kết Markdown nội bộ mở được tại lần kiểm tra baseline 2026-09-09.

[← Chương 10](./10-nghiem-thu-va-truy-vet.md) · [Mục lục](./README.md)
