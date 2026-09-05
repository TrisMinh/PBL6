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
| BOOKING_EXPIRED | 410 | Booking hết hạn thanh toán | Không tạo Payment mới. |
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

- [Bộ Use Case Diagram Markdown — đủ 28 UC](../system-design/02-02-use-case-diagrams/README.md)

### Activity Diagram

- [Bộ Activity Diagram Markdown — đủ BP-01..07](../system-design/02-04-activity-diagrams/README.md)

### Sequence Diagram

- [Bộ Sequence Diagram Markdown — đủ 28 UC](../system-design/02-03-sequence-diagrams/README.md)

### State Diagram

- [Bộ State Machine Markdown](../system-design/02-05-state-machine-diagrams/README.md)

## 11.3. Sơ đồ/tài liệu thiết kế tham khảo

Các nội dung dưới đây hữu ích cho thiết kế nhưng không phải nguồn yêu cầu chính:

- [System Design](../system-design/README.md)
- [Detailed Design](../detailed-design/README.md)
- [Kiến trúc Microservices](../diagrams/subdiagrams/architecture/microservices-architecture.html)
- [ERD Identity](../diagrams/subdiagrams/data-models/erd-identity.html)
- [ERD Transport](../diagrams/subdiagrams/data-models/erd-transport.html)
- [ERD Booking](../diagrams/subdiagrams/data-models/erd-booking.html)
- [ERD Payment](../diagrams/subdiagrams/data-models/erd-payment.html)
- [Deployment mục tiêu](../diagrams/subdiagrams/deployment/deployment.html)
- [Deployment local/demo](../diagrams/subdiagrams/deployment/deployment-local-demo.html)
- [Luồng event Payment](../diagrams/subdiagrams/events/event-payment.html)
- [Luồng event cancellation](../diagrams/subdiagrams/events/event-cancellation.html)
- [Luồng event Trip](../diagrams/subdiagrams/events/event-trip.html)

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

## 11.5. Thông tin cần phê duyệt trước baseline

| Vấn đề | Ảnh hưởng | Chủ sở hữu quyết định |
|---|---|---|
| Payment Gateway chính thức | Webhook, trạng thái và reconciliation | Product/Tech Lead |
| Notification Provider/kênh MVP | Email, push, SMS và retry | Product/Tech Lead |
| Timeout SeatHold | UX, concurrency và Payment | Product Owner |
| Chính sách hủy/đổi và mức phí | Booking, Refund và AC | Product Owner/Operator |
| Promotion/Review có nằm trong MVP hay P1 | Phạm vi SHOULD | Product Owner |
| Retention/deletion | Privacy, audit và storage | Product/Legal/Operations |
| Dataset và tải nghiệm thu | NFR-PERF | Product/QA/Tech Lead |
| Browser/Mobile version tối thiểu | NFR-UX | Product/Frontend Lead |
| Offline Ticket/QR policy | Mobile và check-in | Product/Operations/Security |

## 11.6. Checklist baseline

- [ ] Tất cả trường người xem xét/phê duyệt đã được điền.
- [ ] Phạm vi MUST/SHOULD/COULD được chốt.
- [ ] Mọi Use Case có actor, tiền/hậu điều kiện, luồng chính và ngoại lệ.
- [ ] Mọi FR/NFR MUST có AC/Test Case.
- [ ] Business Rule không mâu thuẫn state transition.
- [ ] Web, Mobile và Back-office có scope rõ.
- [ ] Tenant isolation và ownership được kiểm thử âm tính.
- [ ] Payment callback lặp/trễ/sai amount có test.
- [ ] Double-booking có concurrency test.
- [ ] Sơ đồ không chứa hành vi ngoài văn bản.
- [ ] Các liên kết Markdown và sơ đồ mở được.

[← Chương 10](./10-nghiem-thu-va-truy-vet.md) · [Mục lục](./README.md)
