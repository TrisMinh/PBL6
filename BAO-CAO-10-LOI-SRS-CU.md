# RÀ SOÁT TÀI LIỆU SRS

## Danh sách thành viên trong nhóm

- `[Họ và tên — Lớp/Nhóm]` — Scribe
- `[Họ và tên — Lớp/Nhóm]` — Reviewer
- `[Họ và tên — Lớp/Nhóm]` — Reviewer
- `[Họ và tên — Lớp/Nhóm]` — Reviewer

## Cấu trúc tài liệu SRS được rà soát

SRS cũ có 12 phần cấp 1. Số phần dưới đây được dùng thống nhất khi ghi vị trí của từng lỗi:

| Phần | Tên phần trong SRS cũ |
|---:|---|
| 1 | GIỚI THIỆU CHUNG |
| 2 | TỔNG QUAN SẢN PHẨM, PHẠM VI VÀ TÁC NHÂN |
| 3 | QUY TRÌNH VÀ QUY TẮC NGHIỆP VỤ |
| 4 | ĐẶC TẢ USE CASE |
| 5 | ĐẶC TẢ YÊU CẦU CHỨC NĂNG |
| 6 | YÊU CẦU VỀ TRẠNG THÁI NGHIỆP VỤ |
| 7 | YÊU CẦU MIỀN NGHIỆP VỤ VÀ DỮ LIỆU |
| 8 | YÊU CẦU GIAO DIỆN NGƯỜI DÙNG |
| 9 | YÊU CẦU CHẤT LƯỢNG, BẢO MẬT VÀ VẬN HÀNH |
| 10 | RÀNG BUỘC KIẾN TRÚC VÀ GIAO DIỆN DỊCH VỤ |
| 11 | NGHIỆM THU VÀ TRUY VẾT YÊU CẦU |
| 12 | PHỤ LỤC — NGUỒN TÀI LIỆU VÀ QUẢN LÝ THAY ĐỔI |

### Đối chiếu với cấu trúc Specific Requirements của template UCF

| Mục UCF | Nội dung tương ứng trong SRS cũ |
|---|---|
| 3.1 Functional Requirements | Phần 3, 4, 5 và 6 |
| 3.2 Interface Requirements | Phần 8 và 10 |
| 3.3 Physical Environment Requirements | Có một phần trong triển khai nhưng chưa thành mục độc lập |
| 3.4 Users and Human Factors Requirements | Phần 2 và 8 |
| 3.5 Documentation Requirements | Phần 1 và 12, chưa có mục yêu cầu tài liệu độc lập |
| 3.6 Data Requirements | Phần 6 và 7 |
| 3.7 Resource Requirements | Nằm rải rác trong Phần 9 và 10 |
| 3.8 Security Requirements | Phần 2, 7 và 9 |
| 3.9 Quality Assurance Requirements | Phần 9 và 11 |

## Rà soát tài liệu SRS

- **Yêu cầu 1 (5.4 `FR-PAY-003`):** Xác minh webhook thanh toán.
- **Yêu cầu 2 (10.2.5.1):** Transport API — tham số tìm kiếm chuyến.
- **Yêu cầu 3 (10.2.3 và 10.2.6):** API Gateway routing và Booking/Ticket API — định tuyến endpoint `/trips/**`.
- **Yêu cầu 4 (4.3.2; 6.1, 6.2 và 6.3):** `UC-BOOK-01` và trạng thái TripSeat/SeatHold/Booking — vòng đời giữ ghế.
- **Yêu cầu 5 (4.5.3 `UC-TRIP-01`):** Hủy chuyến có vé đã bán.
- **Yêu cầu 6 (10.2.10 và 11.2):** Event Catalog và Traceability Matrix — sự kiện Notification.
- **Yêu cầu 7 (3.2.4; 4.4.2; 5.3 `FR-BOOK-009`):** Hủy vé, tính phí và hoàn tiền.
- **Yêu cầu 8 (9.4 `NFR-SEC-002` và 3.2.6 `BR-TICKET-001`):** Password hash và QR token.
- **Yêu cầu 9 (9.1 `NFR-PERF-001..007` và 10.1.8):** Chỉ tiêu và môi trường đo hiệu năng.
- **Yêu cầu 10 (7.8):** Retention baseline — thời hạn lưu Booking, Payment và Ticket.

---

# Các lỗi rà soát

## Lỗi 1 (Tại 5.4 `FR-PAY-003`) — Yêu cầu gộp nhiều điều kiện, khó kiểm thử riêng biệt

**Loại lỗi:** Yêu cầu gộp nhiều nội dung trong cùng một mã, khó kiểm thử riêng biệt.

**Phân tích:** `FR-PAY-003` gộp năm kiểm tra độc lập gồm chữ ký, provider, transaction ID, amount và currency trong cùng một yêu cầu. Điều này làm requirement khó kiểm thử và khó truy vết riêng từng điều kiện.

**Giải pháp:** Tách thành các yêu cầu:

- `FR-PAY-003A`: Xác minh provider và chữ ký webhook.
- `FR-PAY-003B`: Kiểm tra transaction ID và chống xử lý lặp.
- `FR-PAY-003C`: Đối chiếu amount và currency với Payment Intent.
- `FR-PAY-003D`: Nếu một kiểm tra thất bại, không phát `PaymentSucceeded`, không chuyển Booking sang `PAID` và phải ghi log an toàn.

## Lỗi 2 (Tại 10.2.5.1) — Thiếu miền dữ liệu Transport API

**Loại lỗi:** Thiếu miền dữ liệu giao diện (Missing Interface Data Domain).

**Phân tích:** SRS chỉ liệt kê `originId`, `destinationId`, `departureDate`, `passengerCount`, `page`, `size`... nhưng không nêu kiểu dữ liệu, trường bắt buộc, giá trị mặc định và khoảng hợp lệ. Frontend và backend có thể hiểu khác nhau, đồng thời tester không viết được boundary test chính xác.

**Giải pháp:** Bổ sung OpenAPI hoặc bảng quy định:

- `originId`, `destinationId`: UUID/ULID, bắt buộc và phải khác nhau.
- `departureDate`: kiểu `date`, không được là ngày quá khứ.
- `passengerCount`: số nguyên từ 1 đến 10.
- `page`: số nguyên ≥ 0, mặc định 0.
- `size`: số nguyên từ 1 đến 100, mặc định 20.
- `minPrice`, `maxPrice`: số nguyên VND, `maxPrice ≥ minPrice`.

## Lỗi 3 (Tại 10.2.3 và 10.2.6) — Xung đột định tuyến API

**Loại lỗi:** Xung đột giao diện (Conflicting Interface Specification).

**Phân tích:** Bảng routing quy định `/api/v1/trips/**` thuộc Transport Service, nhưng Booking Service lại sở hữu `/api/v1/trips/{tripId}/seats` và `/api/v1/trips/{tripId}/seat-holds`. Một endpoint có thể khớp với hai service.

**Giải pháp:** Quy định route cụ thể:

- `GET /api/v1/trips` → Transport Service.
- `GET /api/v1/trips/{tripId}` → Transport Service.
- `GET /api/v1/trips/{tripId}/stops` → Transport Service.
- `GET /api/v1/trips/{tripId}/seats` → Booking Service.
- `POST /api/v1/trips/{tripId}/seat-holds` → Booking Service.

API Gateway phải ưu tiên route cụ thể và không sử dụng wildcard khiến một endpoint thuộc nhiều service.

## Lỗi 4 (Tại 4.3.2; 6.1, 6.2 và 6.3) — Không nhất quán vòng đời giữ ghế

**Loại lỗi:** Không nhất quán trạng thái (State Conflict).

**Phân tích:** Khi tạo Booking, SeatHold chuyển từ `ACTIVE` sang `CONSUMED`, nhưng TripSeat vẫn ở `HELD`. SRS chưa xác định Booking hay SeatHold sở hữu trạng thái giữ ghế và trigger nào giải phóng ghế khi Booking hết hạn.

**Giải pháp:** Bổ sung quy tắc:

> Khi tạo Booking, SeatHold chuyển sang `CONSUMED`, Booking sao chép `expiresAt` của SeatHold thành `paymentExpiresAt`, và TripSeat ở `HELD` tham chiếu `bookingId`. Khi Booking chuyển sang `EXPIRED` hoặc `CANCELLED`, TripSeat phải chuyển về `AVAILABLE` nếu Trip còn bán được.

## Lỗi 5 (Tại 4.5.3 `UC-TRIP-01`) — Tiền điều kiện hủy Trip sai logic

**Loại lỗi:** Lỗi logic và không rõ ràng (Logical Error/Ambiguity).

**Phân tích:** Tiền điều kiện ghi “Trip chưa hoàn thành hoặc đã hủy”. Cách viết này cho phép Trip đã `CANCELLED` tiếp tục thỏa điều kiện bắt đầu luồng hủy mới, có nguy cơ phát event, refund và notification lặp.

**Giải pháp:** Sửa thành:

> Actor có quyền hủy Trip trong tenant; Trip đang ở `SCHEDULED` hoặc `BOARDING`. Nếu Trip đã `CANCELLED` và request được gửi lặp với cùng idempotency key, hệ thống trả kết quả cũ và không phát event/refund/notification lần hai. Trip `COMPLETED` không được hủy.

## Lỗi 6 (Tại 10.2.10 và 11.2) — Event Notification không nhất quán

**Loại lỗi:** Không nhất quán và mất truy vết (Consistency/Traceability Error).

**Phân tích:** Traceability Matrix sử dụng event `NotificationRequested`, nhưng Event Catalog không định nghĩa event này. Catalog hiện cho Notification Service nhận các domain event như `BookingPaid`, `TicketIssued`, `PaymentFailed` và `TripCancelled`.

**Giải pháp:** Sửa dòng Notification trong Traceability Matrix để sử dụng các event đã có:

> `BookingPaid`, `TicketIssued`, `PaymentFailed`, `TripUpdated`, `TripCancelled`, `BookingCancelled`, `RefundSucceeded`.

Nếu dự án muốn sử dụng `NotificationRequested`, phải bổ sung event này vào Event Catalog với producer, consumer, version và payload cụ thể.

## Lỗi 7 (Tại 3.2.4; 4.4.2; 5.3 `FR-BOOK-009`) — Thiếu công thức refund

**Loại lỗi:** Thiếu công thức nghiệp vụ (Missing Calculation Rule).

**Phân tích:** SRS yêu cầu hiển thị phí hủy và số tiền hoàn nhưng chưa định nghĩa công thức, quy tắc làm tròn và cách xử lý khi chỉ hủy một Ticket trong Booking nhiều Ticket. Developer và tester có thể tính ra kết quả khác nhau.

**Giải pháp:** Bổ sung công thức:

```text
eligibleBase = tổng refundableAmountSnapshot của các Ticket được hủy
feeRate = policy.rateAt(minutesBeforeDeparture)
cancellationFee = roundVND(eligibleBase × feeRate + fixedFee)
refundAmount = max(0, eligibleBase - cancellationFee - nonRefundableAmount)
```

Preview và Refund phải dùng cùng `policyVersion`, timezone và quy tắc làm tròn phía server.

## Lỗi 8 (Tại 9.4 `NFR-SEC-002` và 3.2.6 `BR-TICKET-001`) — Yêu cầu bảo mật mơ hồ

**Loại lỗi:** Không rõ ràng và không thể kiểm thử (Ambiguous/Untestable).

**Phân tích:** Các cụm “thuật toán password hashing hiện đại” và “QR token đủ mạnh” không có tiêu chí đo lường. Developer và tester không biết thuật toán, tham số hoặc mức an toàn tối thiểu cần đạt.

**Giải pháp:** Sửa thành:

> Password phải được hash bằng Argon2id hoặc thuật toán adaptive password hashing được phê duyệt; mỗi password có salt ngẫu nhiên riêng tối thiểu 128 bit. QR token phải có tối thiểu 128 bit entropy từ CSPRNG hoặc mức an toàn tương đương, không chứa PII dạng rõ và database chỉ lưu token hash khi có thể.

## Lỗi 9 (Tại 9.1 `NFR-PERF-001..007` và 10.1.8) — Thiếu môi trường đo hiệu năng

**Loại lỗi:** Thiếu điều kiện đo lường (Undefined Measurement Environment).

**Phân tích:** SRS quy định p95, p99, 300 user đồng thời và 100.000 Trip nhưng không xác định CPU, RAM, số replica, database, network, request mix và thời gian chạy test. Kết quả hiệu năng không thể tái lập.

**Giải pháp:** Bổ sung cấu hình `PERF-ENV-01` và workload `PERF-WORKLOAD-01`, gồm:

- CPU/RAM và số replica từng service.
- Phiên bản/cấu hình database, Redis và broker.
- Kích thước dataset và trạng thái cache.
- Tỷ lệ Search/Detail/Hold/Booking/Payment.
- Warm-up, ramp-up, thời gian giữ tải và error rate tối đa.

Các chỉ tiêu `NFR-PERF-*` chỉ được nghiệm thu trên môi trường và workload đã công bố này.

## Lỗi 10 (Tại 7.8) — Retention chưa xác định

**Loại lỗi:** Thiếu tham số nghiệp vụ (Missing Business Parameter).

**Phân tích:** Retention của Booking, Payment và Ticket chỉ ghi “theo yêu cầu nghiệp vụ và quy định áp dụng”, không có thời hạn, mốc bắt đầu hoặc cách xử lý cuối kỳ. Không thể xây dựng retention job hoặc test nghiệm thu.

**Giải pháp:** Bổ sung bảng `DATA-RET-01` cho từng loại dữ liệu, bắt buộc có:

- Thời hạn lưu cụ thể theo tháng/năm.
- Mốc bắt đầu tính thời hạn.
- Hành động cuối kỳ: archive, anonymize hoặc delete.
- Quy tắc legal hold.
- Cách xử lý dữ liệu trong backup.
- Người chịu trách nhiệm phê duyệt.

Không triển khai production khi thời hạn của Booking, Payment, Refund hoặc Ticket còn để `TBD`.

---

# Bảng tổng hợp lỗi

| ID lỗi | Vị trí | Mô tả lỗi | Mức độ | Trạng thái | Hạn sửa |
|---|---|---|---|---|---|
| DEF-01 | 5.4 `FR-PAY-003` | Một requirement chứa nhiều kiểm tra độc lập | Medium | Open | `[Cập nhật]` |
| DEF-02 | 10.2.5.1 | Thiếu kiểu và miền dữ liệu input/output | High | Open | `[Cập nhật]` |
| DEF-03 | 10.2.3 và 10.2.6 | Route `/trips/**` thuộc đồng thời hai service | High | Open | `[Cập nhật]` |
| DEF-04 | 4.3.2; 6.1–6.3 | Vòng đời SeatHold–Booking–TripSeat không nhất quán | Critical | Open | `[Cập nhật]` |
| DEF-05 | 4.5.3 `UC-TRIP-01` | Tiền điều kiện hủy Trip sai logic | High | Open | `[Cập nhật]` |
| DEF-06 | 10.2.10 và 11.2 | Event Notification không nhất quán | High | Open | `[Cập nhật]` |
| DEF-07 | 3.2.4; 4.4.2; 5.3 | Thiếu công thức phí hủy/refund | High | Open | `[Cập nhật]` |
| DEF-08 | 9.4 và 3.2.6 | Yêu cầu bảo mật dùng từ mơ hồ | High | Open | `[Cập nhật]` |
| DEF-09 | 9.1 và 10.1.8 | Thiếu môi trường đo hiệu năng | High | Open | `[Cập nhật]` |
| DEF-10 | 7.8 | Thiếu thời hạn lưu dữ liệu giao dịch | High | Open | `[Cập nhật]` |

---

**Kết thúc báo cáo**
