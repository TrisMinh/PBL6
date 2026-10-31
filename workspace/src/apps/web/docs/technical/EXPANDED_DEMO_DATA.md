# Bộ dữ liệu demo mở rộng — 01/11/2026

Đã thêm trực tiếp vào PostgreSQL local. Không sửa source BE, schema hoặc dữ liệu của nhà xe/tài khoản cũ.

## Quy mô được thêm

| Loại | Số lượng |
| --- | ---: |
| Tài khoản | 23 |
| Nhà xe | 6: 2 hoạt động, 2 tạm ngưng, 2 ngừng hoạt động |
| Chuyến | 149 |
| Đơn đặt vé | 84 |
| Vé | 82 |
| Thanh toán | 78 |
| Hoàn tiền | 12 |
| Đối soát | 74 |
| Payout | 6 |

Nhà xe chính là **BLUE Demo B** và **BLUE Demo C**. Mã của chúng bắt đầu `XB-` / `XC-`; UUID bắt đầu `019aff01` / `019aff02`. Tài khoản dùng để thử trạng thái/quyền nền tảng có UUID bắt đầu `019aff03`.

## Tài khoản

Mật khẩu của **tất cả tài khoản mới**: `OperatorPass1`. Tài khoản seed cũ giữ nguyên mật khẩu cũ.

| Email | Dùng để thử |
| --- | --- |
| `customer.b@demo.test` | 42 đơn, 41 vé của khách B |
| `customer.c@demo.test` | 42 đơn, 41 vé của khách C; thử truy cập vé/đơn của B bị từ chối |
| `operator.b@demo.test` / `operator.c@demo.test` | Quản trị từng nhà xe, danh sách chuyến, tài nguyên, hành khách |
| `operator_finance.b@demo.test` / `operator_finance.c@demo.test` | Giao dịch, hoàn tiền, đối soát trong phạm vi nhà xe |
| `operator_scheduler.b@demo.test` / `operator_scheduler.c@demo.test` | Vai trò xếp lịch |
| `operator_operations.b@demo.test` / `operator_operations.c@demo.test` | Vai trò vận hành |
| `driver.b@demo.test` / `driver.c@demo.test` | Phân công chuyến, check-in |
| `driver.suspended.b@demo.test` / `driver.suspended.c@demo.test` | Hồ sơ tài xế bị đình chỉ |
| `driver.expired.b@demo.test` / `driver.expired.c@demo.test` | Hồ sơ tài xế hết hạn bằng lái |
| `platform_finance@demo.test` | API tài chính toàn nền tảng |
| `platform_support@demo.test` | Vai trò hỗ trợ |
| `platform_auditor@demo.test` | Vai trò kiểm toán |
| `empty.customer@demo.test` | Danh sách đơn/vé trống |
| `disabled@demo.test` | Tài khoản vô hiệu hóa, đăng nhập bị từ chối |
| `locked@demo.test` | Tài khoản đang khóa, đăng nhập bị từ chối |
| `pending_verification@demo.test` | Tài khoản chưa xác minh, đăng nhập bị từ chối |

Quyền API không đồng nghĩa FE đã có trang riêng cho mọi vai trò. Ví dụ `PLATFORM_FINANCE` gọi được API tài chính nhưng guard admin của FE cần được đối chiếu riêng. Endpoint `/admin/payments` của BE hiện cho phép kế toán nhà xe, nhưng lọc dữ liệu theo nhà xe; đường dẫn có chữ `admin` không đồng nghĩa chỉ admin mới được gọi.

## Các luồng có thể thử

### Tìm chuyến và tài nguyên

- **Đà Nẵng → Huế, 15/11/2026**: API có **111 chuyến đang bán** trên cùng ngày, đủ kiểm tra vượt giới hạn 100 kết quả, phân trang, lọc giá, tiện ích, loại xe, nhiều nhà xe.
- Ngày **03–08/11/2026**: các chuyến cơ bản, có điểm trung gian **Lăng Cô**, trả trước/trả sau và chuyến `BOARDING`.
- **Huế → Đà Nẵng, 16/11/2026**: thử chiều ngược lại và nút đổi chiều.
- **TP.HCM → Đà Lạt, 17/11/2026**; **Hà Nội → Sa Pa, 18/11/2026**; **Đà Nẵng → TP.HCM, 19/11/2026**: thử danh sách địa điểm và quan hệ tuyến.
- Có `DRAFT`, `SCHEDULED`, `BOARDING`, `DEPARTED`, `IN_TRANSIT`, `ARRIVED`, `COMPLETED`, `CANCELLED`, chuyến ngừng bán, xe bảo trì/ngừng hoạt động, ghế vô hiệu hóa.
- Chuyến `SOLD_OUT` có đủ **24 đơn/vé và 24 ghế BOOKED**, không dùng ghế disabled để giả hết vé. ID chính xác nằm trong manifest. Kiểm tra hết ghế bằng API inventory; số `availableSeatCount` ở API tìm chuyến hiện do BE tính riêng và cần đối chiếu, không dùng fixture để che sai khác đó.

### Đơn và vé

- `XB-0001` … `XB-0009` và `XC-0001` … `XC-0009`: trả trước, trả sau, đã thanh toán, chờ thanh toán, hết hạn, đã hủy, đã hoàn tiền, hoàn thành.
- `XB-FAMILY-1` / `XC-FAMILY-1`: **3 hành khách, trả trước**, đủ thử chọn nhiều vé khi xem chính sách/hủy.
- `XB-FAMILY-2` / `XC-FAMILY-2`: **3 hành khách, trả sau**.
- Có vé `ISSUED`, `CHECKED_IN`, `USED`, `CANCELLED`, `REFUNDED`.
- Có hold `ACTIVE`, `RELEASED`, `EXPIRED`. Token, chủ sở hữu và trip ID có trong manifest. Hold active và đơn pending hết hạn tự nhiên sau khoảng 10 phút từ lúc tạo; tạo đơn mới để thử pending sau khi các mẫu này đã hết hạn.

### Tài chính và thông báo

- Thanh toán `PENDING`, `PROCESSING`, `SUCCEEDED`, `FAILED`, `CANCELLED`, `PARTIALLY_REFUNDED`, `REFUND_PENDING`, `REFUNDED`.
- `XB-EDGE-1` / `XC-EDGE-1`: đã hoàn **40%**, có thể thử hoàn phần còn lại hoặc số tiền vượt phần còn lại.
- `EDGE-2` đến `EDGE-5`: hoàn tiền requested, processing, failed và đơn refund-pending. Các trạng thái này là fixture, không phải cam kết có worker tự chuyển trạng thái.
- Có payout `PENDING`, `SENT`, `FAILED` trong DB; khả năng xem danh sách phụ thuộc API/UI đang cung cấp.
- Đã bổ sung ledger và đồng bộ báo cáo doanh thu, đơn, tồn ghế cho hai nhà xe demo.
- Mỗi khách B/C có 28 thông báo để thử đánh dấu đọc và cursor trang thứ hai.

## Kiểm tra đã thực hiện

- **34 kiểm tra API**: đăng nhập, tài khoản không hoạt động, dữ liệu từng nhà xe, chặn đọc đơn/vé/giao dịch chéo, phân trang chuyến, inventory hết vé, manifest, thông báo và báo cáo.
- Mỗi khách mới: **42 đơn / 41 vé**.
- Chuyến hết vé: API inventory không có ghế AVAILABLE; manifest có 24 khách.
- Kiểm tra DB: **0** đơn lệch tổng dòng tiền, **0** ghế BOOKED có liên kết chủ sai, **0** thanh toán bị hoàn quá số tiền đã thu.
- Dữ liệu trực tiếp không thay cho kiểm thử webhook, email, timeout, refresh token và hai khách đặt cùng một ghế. Các trường hợp đó cần thao tác runtime riêng.

## File và backup

- Manifest: `workspace/src/apps/web/tmp/expanded-demo/manifest.json` — đủ ID cho từng trường hợp, tài khoản, ngày đi, hold token.
- Kết quả API: `workspace/src/apps/web/tmp/expanded-demo/api-verification.json`.
- SQL đã áp dụng: cùng thư mục, gồm 6 DB và các file `completion-*.sql`.
- Backup trước khi nạp: `C:\Users\ADMIN\AppData\Local\Temp\pbl6-before-expanded-1793542523904`.
- Script: `workspace/scripts/load-expanded-fe-demo.cjs`, `complete-expanded-fe-demo.cjs`, `verify-expanded-fe-demo.cjs`.
- Script chính từ chối nạp lại khi phát hiện UUID bộ demo đã tồn tại, để tránh thay đổi các tình huống bạn đã thao tác thử. `--resume` chỉ dùng để xử lý nạp bị gián đoạn, không dùng để reset dữ liệu.
