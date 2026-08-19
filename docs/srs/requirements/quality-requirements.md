# Yêu cầu chất lượng, bảo mật và vận hành

Các giá trị dưới đây là baseline nghiệm thu cho môi trường test gần production. Nếu thay đổi phải cập nhật test plan.

## 1. Hiệu năng và tải

| ID | Chỉ tiêu |
|---|---|
| NFR-PERF-001 | Search API p95 ≤ 2 giây và p99 ≤ 4 giây ở 300 user đồng thời, dataset tối thiểu 100.000 Trip. |
| NFR-PERF-002 | Trip detail/seat availability p95 ≤ 1,5 giây ở 300 user đồng thời. |
| NFR-PERF-003 | SeatHold command p95 ≤ 1 giây, không tính network phía client. |
| NFR-PERF-004 | API CRUD thông thường p95 ≤ 1 giây ở tải baseline. |
| NFR-PERF-005 | Payment webhook hợp lệ được persist và acknowledge ≤ 2 giây p95; xử lý downstream có thể bất đồng bộ. |
| NFR-PERF-006 | Báo cáo online tối đa 10 giây; truy vấn lớn hơn phải chuyển thành export job. |
| NFR-PERF-007 | Kết quả load test không có double-booking hoặc duplicate ticket/payment. |

## 2. Sẵn sàng và phục hồi

| ID | Chỉ tiêu |
|---|---|
| NFR-REL-001 | Availability mục tiêu của API customer là 99,5% theo tháng, không tính bảo trì được thông báo. |
| NFR-REL-002 | RPO baseline ≤ 15 phút và RTO ≤ 4 giờ cho database nghiệp vụ. |
| NFR-REL-003 | Backup database hằng ngày và point-in-time/WAL theo khả năng hạ tầng; restore test ít nhất mỗi học kỳ/release lớn. |
| NFR-REL-004 | Notification/Reporting lỗi không được làm thất bại Booking/Payment đã commit. |
| NFR-REL-005 | Event chưa xử lý phải retry có backoff và chuyển dead-letter queue sau ngưỡng cấu hình. |
| NFR-REL-006 | Readiness check chỉ báo ready khi dependency thiết yếu của service có thể sử dụng. |

## 3. Khả năng mở rộng

| ID | Yêu cầu |
|---|---|
| NFR-SCALE-001 | Identity, Transport search, Booking, Payment và Notification có thể scale độc lập. |
| NFR-SCALE-002 | Service không lưu session bắt buộc trong memory cục bộ của một instance. |
| NFR-SCALE-003 | Job và event consumer hỗ trợ nhiều instance mà không xử lý logical event hai lần. |
| NFR-SCALE-004 | Search và Reporting có thể dùng read model/cache mà không làm thay đổi nguồn sự thật giao dịch. |

## 4. Bảo mật

| ID | Yêu cầu |
|---|---|
| NFR-SEC-001 | Tất cả traffic public và service-to-service qua mạng không tin cậy phải dùng TLS. |
| NFR-SEC-002 | Password được hash bằng thuật toán password hashing hiện đại với cấu hình được quản lý; không dùng hash nhanh thuần túy. |
| NFR-SEC-003 | Access token mặc định ≤ 15 phút; refresh token có rotation, revoke và thời hạn cấu hình. |
| NFR-SEC-004 | Login, OTP, reset password và endpoint public nhạy cảm có rate limit. |
| NFR-SEC-005 | Sau 5 lần login thất bại liên tiếp, tài khoản hoặc định danh bị khóa/chậm tối thiểu 15 phút theo policy chống abuse. |
| NFR-SEC-006 | Authorization được kiểm tra trong service, gồm ownership và tenant scope. |
| NFR-SEC-007 | Input được validate; query dùng parameterization/ORM an toàn; output Web được encode để giảm SQL injection/XSS. |
| NFR-SEC-008 | Web dùng cookie auth phải có CSRF protection; CORS chỉ cho phép origin cấu hình. |
| NFR-SEC-009 | Secret và key không commit vào repository hoặc ghi vào log. |
| NFR-SEC-010 | Webhook payment xác minh chữ ký và chống replay. |
| NFR-SEC-011 | PII nhạy cảm được mã hóa at rest khi phù hợp và mask trong log/UI. |
| NFR-SEC-012 | Dependency/container image được scan trước release; lỗ hổng critical phải được xử lý hoặc có phê duyệt rủi ro. |

## 5. Privacy và bảo vệ dữ liệu

- Chỉ thu thập CCCD/CMND khi Operator policy thực sự yêu cầu và phải nêu mục đích.
- Customer có thể xem/cập nhật dữ liệu hồ sơ và yêu cầu xử lý tài khoản theo policy được duyệt.
- Manifest chỉ hiển thị dữ liệu tối thiểu cho Driver.
- Export chứa PII phải kiểm tra permission, có thời hạn tải xuống và audit.
- Retention/deletion policy phải được duyệt trước production; không tự suy diễn yêu cầu pháp lý.

## 6. Logging và observability

| ID | Yêu cầu |
|---|---|
| NFR-OBS-001 | Log có timestamp UTC, service, environment, level, correlationId, event/action và error code. |
| NFR-OBS-002 | Không log password, OTP, access/refresh token, CVV, full card number hoặc full identity document. |
| NFR-OBS-003 | Có metrics cho latency, error rate, request rate, DB pool, queue lag, DLQ, hold expiry, payment success và refund failure. |
| NFR-OBS-004 | Có distributed trace hoặc trace context qua Gateway, REST và event cho luồng Booking–Payment. |
| NFR-OBS-005 | Alert tối thiểu cho error rate tăng, service unavailable, queue backlog, webhook signature failure bất thường và refund failure. |
| NFR-OBS-006 | Audit log tách khỏi application debug log và có quyền truy cập hạn chế. |

## 7. Tương thích và khả dụng

| ID | Yêu cầu |
|---|---|
| NFR-UX-001 | Web hỗ trợ hai phiên bản ổn định gần nhất của Chrome, Edge, Firefox và Safari tại thời điểm release. |
| NFR-UX-002 | Web responsive từ 360 px; luồng chính dùng được bằng bàn phím. |
| NFR-UX-003 | Mục tiêu WCAG 2.1 AA cho đăng nhập, tìm kiếm, giữ ghế, booking, payment và ticket. |
| NFR-UX-004 | API error và UI message dùng thuật ngữ nhất quán, không lộ chi tiết nội bộ. |

## 8. Maintainability và delivery

- Mỗi service có README, OpenAPI, migration, health endpoint và test riêng.
- CI chạy unit test, integration test, contract test, lint, dependency scan và build container.
- Core rule giữ ghế/payment phải có integration/concurrency test.
- Config tách khỏi image; dev/test/prod dùng cùng image với config khác.
- Rollback deployment không được rollback database phá hủy dữ liệu; migration cần backward-compatible khi rolling deploy.
