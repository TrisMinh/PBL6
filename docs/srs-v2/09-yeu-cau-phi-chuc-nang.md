# 9. Yêu cầu phi chức năng

[← Chương 8](./08-yeu-cau-du-lieu.md) · [Mục lục](./README.md) · [Chương 10 →](./10-nghiem-thu-va-truy-vet.md)

Các giá trị dưới đây là baseline nghiệm thu cho môi trường test gần production. Mọi thay đổi ngưỡng phải được phê duyệt và cập nhật Test Plan.

## 9.1. Hiệu năng và tải

| ID | Yêu cầu đo được |
|---|---|
| NFR-PERF-001 | Search API đạt p95 ≤ 2 giây và p99 ≤ 4 giây ở 300 User đồng thời với dataset tối thiểu 100.000 Trip. |
| NFR-PERF-002 | Trip detail/seat availability đạt p95 ≤ 1,5 giây ở 300 User đồng thời. |
| NFR-PERF-003 | SeatHold command đạt p95 ≤ 1 giây, không tính network phía client. |
| NFR-PERF-004 | API CRUD thông thường đạt p95 ≤ 1 giây ở tải baseline. |
| NFR-PERF-005 | Payment webhook hợp lệ được persist và acknowledge trong ≤ 2 giây p95; xử lý downstream có thể bất đồng bộ. |
| NFR-PERF-006 | Báo cáo online hoàn tất trong tối đa 10 giây; truy vấn lớn hơn phải chuyển thành Export Job. |
| NFR-PERF-007 | Load/concurrency test không tạo double-booking hoặc duplicate Booking, Payment, Ticket hay Refund. |

Điều kiện đo phải ghi rõ cấu hình môi trường, dữ liệu, thời lượng warm-up, phân bố request, tỷ lệ lỗi và tiêu chí loại trừ.

## 9.2. Sẵn sàng và phục hồi

| ID | Yêu cầu đo được |
|---|---|
| NFR-REL-001 | Availability mục tiêu của API Customer là 99,5% theo tháng, không tính bảo trì đã thông báo. |
| NFR-REL-002 | RPO baseline ≤ 15 phút và RTO ≤ 4 giờ cho dữ liệu nghiệp vụ. |
| NFR-REL-003 | Backup dữ liệu hằng ngày và point-in-time/WAL theo khả năng hạ tầng; restore test ít nhất mỗi học kỳ hoặc release lớn. |
| NFR-REL-004 | Lỗi Notification/Reporting không được làm thất bại Booking/Payment đã commit. |
| NFR-REL-005 | Sự kiện chưa xử lý phải retry có backoff và chuyển dead-letter sau ngưỡng cấu hình. |
| NFR-REL-006 | Readiness chỉ báo ready khi dependency thiết yếu của thành phần có thể sử dụng. |

## 9.3. Tính nhất quán và khả năng chịu lỗi

| ID | Yêu cầu |
|---|---|
| NFR-CONS-001 | Mọi command tạo SeatHold, Booking, Payment, cancellation và Refund phải hỗ trợ idempotency trong thời hạn nghiệp vụ phù hợp. |
| NFR-CONS-002 | Webhook/event được giả định có thể đến lặp, trễ hoặc sai thứ tự; consumer phải bảo toàn bất biến nghiệp vụ. |
| NFR-CONS-003 | Payment thành công không được tạo hai bộ Ticket cho cùng Booking Item. |
| NFR-CONS-004 | Khi không thể hoàn tất quy trình nhiều miền, hệ thống phải retry, bù trừ hoặc mở manual case; không bỏ dở âm thầm. |
| NFR-CONS-005 | Giao dịch chưa có kết quả cuối phải truy vết và đối soát được bằng mã giao dịch/correlation ID. |
| NFR-CONS-006 | Cache/read model có thể chậm nhưng không được dùng làm nguồn quyết định cuối cho ghế, Payment hoặc quyền truy cập. |

## 9.4. Khả năng mở rộng

| ID | Yêu cầu |
|---|---|
| NFR-SCALE-001 | Các miền Identity, Search/Trip, Booking, Payment và Notification có thể mở rộng năng lực độc lập. |
| NFR-SCALE-002 | Thành phần xử lý request không phụ thuộc session bắt buộc trong memory cục bộ của một instance. |
| NFR-SCALE-003 | Job và event consumer hỗ trợ nhiều instance mà không xử lý logical event hai lần. |
| NFR-SCALE-004 | Search và Reporting có thể dùng read model/cache mà không thay đổi nguồn sự thật giao dịch. |

## 9.5. Bảo mật

| ID | Yêu cầu |
|---|---|
| NFR-SEC-001 | Traffic public và service-to-service qua mạng không tin cậy phải dùng TLS. |
| NFR-SEC-002 | Password được hash bằng thuật toán password hashing hiện đại với cấu hình được quản lý; không dùng hash nhanh thuần túy. |
| NFR-SEC-003 | Access token mặc định có thời hạn ≤ 15 phút; refresh token có rotation, revoke và thời hạn cấu hình. |
| NFR-SEC-004 | Login, OTP, reset password và endpoint public nhạy cảm có rate limit. |
| NFR-SEC-005 | Sau 5 lần login thất bại liên tiếp, tài khoản/định danh bị khóa hoặc làm chậm tối thiểu 15 phút theo policy chống abuse. |
| NFR-SEC-006 | Authorization được kiểm tra tại thành phần xử lý nghiệp vụ, gồm ownership và tenant scope. |
| NFR-SEC-007 | Input được validate; truy vấn dùng parameterization/ORM an toàn; output Web được encode để giảm SQL injection/XSS. |
| NFR-SEC-008 | Web dùng cookie auth phải có CSRF protection; CORS chỉ cho phép origin được cấu hình. |
| NFR-SEC-009 | Secret và key không được commit vào repository hoặc ghi vào log. |
| NFR-SEC-010 | Payment webhook phải xác minh chữ ký và chống replay. |
| NFR-SEC-011 | PII nhạy cảm được mã hóa at rest khi phù hợp và mask trong log/UI. |
| NFR-SEC-012 | Dependency/container image được scan trước release; lỗ hổng critical phải xử lý hoặc có phê duyệt rủi ro. |

## 9.6. Quyền riêng tư

| ID | Yêu cầu |
|---|---|
| NFR-PRIV-001 | Chỉ thu thập CCCD/CMND khi policy thực sự yêu cầu và phải nêu mục đích. |
| NFR-PRIV-002 | Customer có thể xem/cập nhật dữ liệu hồ sơ và yêu cầu xử lý tài khoản theo policy được duyệt. |
| NFR-PRIV-003 | Manifest chỉ hiển thị dữ liệu tối thiểu cho Driver/Operator theo nhiệm vụ. |
| NFR-PRIV-004 | Export chứa PII phải kiểm tra permission, có thời hạn tải xuống và audit. |
| NFR-PRIV-005 | Retention/deletion policy phải được phê duyệt trước production; không tự suy diễn yêu cầu pháp lý. |

## 9.7. Logging, monitoring và audit

| ID | Yêu cầu |
|---|---|
| NFR-OBS-001 | Log có timestamp, thành phần, environment, level, correlation ID, event/action và error code. |
| NFR-OBS-002 | Không log password, OTP, access/refresh token, CVV, full card number hoặc full identity document. |
| NFR-OBS-003 | Có metrics cho latency, error rate, request rate, DB pool, queue lag, dead-letter, hold expiry, Payment success và Refund failure. |
| NFR-OBS-004 | Có trace context xuyên luồng request/event cho Booking–Payment và các luồng giao dịch quan trọng. |
| NFR-OBS-005 | Có alert tối thiểu cho error rate tăng, service unavailable, queue backlog, webhook signature failure bất thường và Refund failure. |
| NFR-OBS-006 | Audit log tách khỏi application debug log và có quyền truy cập hạn chế. |

## 9.8. Tương thích, khả dụng và accessibility

| ID | Yêu cầu |
|---|---|
| NFR-UX-001 | Web hỗ trợ hai phiên bản ổn định gần nhất của Chrome, Edge, Firefox và Safari tại thời điểm release. |
| NFR-UX-002 | Web responsive từ 360 px; luồng chính dùng được bằng bàn phím. |
| NFR-UX-003 | Mục tiêu WCAG 2.1 AA cho đăng nhập, tìm kiếm, giữ ghế, Booking, Payment và Ticket. |
| NFR-UX-004 | API error và UI message dùng thuật ngữ nhất quán, không lộ chi tiết nội bộ. |
| NFR-UX-005 | Web và Mobile hoàn tất được cùng luồng Customer MUST trên cùng trạng thái nghiệp vụ phía server. |
| NFR-UX-006 | Giao diện dùng tiếng Việt trong MVP; cấu trúc nội dung cho phép bổ sung ngôn ngữ mà không đổi nghiệp vụ. |

## 9.9. Bảo trì, kiểm thử và phát hành

| ID | Yêu cầu |
|---|---|
| NFR-MAIN-001 | Mỗi thành phần có tài liệu vận hành, hợp đồng, migration/upgrade và health check phù hợp. |
| NFR-MAIN-002 | CI chạy unit test, integration test, contract test, lint, security/dependency scan và build artifact. |
| NFR-MAIN-003 | Quy tắc giữ ghế, Payment, Refund và tenant isolation phải có integration/concurrency/negative test. |
| NFR-MAIN-004 | Cấu hình được tách khỏi build artifact; các môi trường dùng cùng artifact với cấu hình khác. |
| NFR-MAIN-005 | Rollback deployment không được rollback database theo cách phá hủy dữ liệu; migration hỗ trợ triển khai tương thích. |
| NFR-MAIN-006 | Breaking change của API/event phải có version mới hoặc kế hoạch migration được kiểm chứng. |

## 9.10. Phương pháp kiểm chứng

| Nhóm | Phương pháp |
|---|---|
| PERF/SCALE | Load test, stress test và theo dõi metrics. |
| REL/CONS | Fault injection, retry/replay test, recovery test và reconciliation test. |
| SEC/PRIV | Security test, authorization negative test, review cấu hình/log và scan tự động. |
| OBS | Truy vết một giao dịch bằng correlation ID, kiểm tra metric/alert/audit. |
| UX | Kiểm thử trình duyệt/thiết bị, bàn phím và accessibility audit. |
| MAIN | Review pipeline, test evidence, migration và rollback rehearsal. |

[← Chương 8](./08-yeu-cau-du-lieu.md) · [Mục lục](./README.md) · [Chương 10 →](./10-nghiem-thu-va-truy-vet.md)
