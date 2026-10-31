# Đưa phần kết nối PBL6_new vào dự án gốc

Ngày: 01/11/2026. Nhánh đích: `feature/frontend-integration`.

Chỉ đưa 29 file kết nối liên quan từ `D:/Project/PBL6_new/PBL6` sang `D:/Project/PBL6`. Không chép toàn bộ repository. Phần backend gồm Gateway, endpoint booking/payment và các lớp transport cần cho danh sách tổ chức, hành trình khám phá và thông tin phân công chuyến.

Giữ nguyên các ứng dụng `customer-web`, `backoffice-web`, `mobile`, các file môi trường, cấu hình Docker, dữ liệu database và các màn hình mock cũ.

## Những điểm chỉnh thêm khi đưa sang

- Request tạo dữ liệu dùng `liveApiJson(..., { idempotent: true })`. Mã chống trùng được lưu theo tài khoản và fingerprint của endpoint/payload; giữ nguyên sau lỗi mạng hoặc tải lại trang, xóa sau response thành công. Refresh token không làm đổi mã của thao tác đang thử lại. Bộ nhớ trình duyệt chỉ chứa digest và UUID, không chứa payload.
- Danh sách chuyến dùng phân trang đầy đủ khi tìm chuyến cần sửa.
- Form sửa chuyến lấy dữ liệu BE, không ưu tiên cache local cũ. Các form sửa tuyến/xe/tài xế/chuyến giữ version tại lúc nạp form để BE phát hiện xung đột cập nhật.
- Cache query của các form mới được phân biệt theo tài khoản và phiên đăng nhập.
- Bổ sung sửa vai trò, trạng thái thành viên tổ chức bằng endpoint PATCH. Ngừng quyền dùng trạng thái INACTIVE, không giả lập xóa vĩnh viễn.
- Đăng xuất dọn metadata thao tác và bản nháp vận hành local của các chức năng mới.

## Phạm vi và giới hạn

Các form mới phục vụ tạo/sửa tuyến, điểm dừng, xe, ghế, tài xế, chuyến; duyệt/phát hành, đổi trạng thái, hủy chuyến; quản trị tổ chức và quyền thành viên. Khám phá dùng danh mục hành trình BE. Tra cứu vé hiện giới hạn trong tài khoản đã đăng nhập, chưa phải tra cứu khách vãng lai.

Đây là đưa code và chỉnh cách tích hợp, chưa xác nhận chạy thực tế. Theo yêu cầu không chạy test, build, lint hoặc typecheck trong lần chuyển này. Không commit/push và không khởi động hay reset Docker/database.

Bản sao lưu và manifest file nằm ở thư mục được ghi trong `tmp/transfer-backup-path.txt` của frontend. Manifest phân biệt file có sẵn và file mới để có thể hoàn tác từng file. Không đưa bản sao lưu vào Git.
