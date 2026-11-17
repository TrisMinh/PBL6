# Postman — các collection đang dùng

Chỉ giữ ba collection hiện hành; kiểm thử nghiệp vụ đầy đủ nằm trong `workspace/src/tests`.

| Collection | Mục đích | Môi trường |
|---|---|---|
| `BLUE_OWASP_Protected_Endpoints.postman_collection.json` | 68 kiểm tra API thiếu xác thực qua gateway | `localhost:5080`; không cần key |
| `BLUE_Coupons.postman_collection.json` | Danh sách ưu đãi và báo giá coupon thật | Chọn `baseUrl`, `tripId`, `customerToken` phù hợp |
| `BLUE_SePay.postman_collection.json` | Checkout và các trường hợp IPN | Chỉ database test tách biệt; không chạy fixture IPN trên đơn thật |

Chạy ma trận quyền từ repository root:

```powershell
postman collection run workspace/postman/BLUE_OWASP_Protected_Endpoints.postman_collection.json
```

Không lưu token, key hoặc environment có credential vào Git. Log/report sinh mới để ngoài source hoặc trong `runs/` đã được Git ignore.

Ngày 17/11/2026 đã dọn collection Round 1/2/3 dùng ID phiên chạy cũ, environment xuất sẵn, script chuẩn bị dữ liệu/dựng/kiểm tra workbook, runner Round 2 và test riêng của runner. Có thể lấy lại từ lịch sử Git ở commit `da68cf3a` nếu cần kiểm tra lịch sử, không dùng chúng làm bộ kiểm thử hiện hành.

Giữ báo cáo Round 2 cuối cùng và summary trong `outputs/pbl6-round2/`, task khắc phục bảo mật trong `docs/security/SECURITY-REMEDIATION-TASKS.md`, cùng bằng chứng audit ngày 16/11. Việc dọn artifact không thay đổi kết quả audit hoặc sửa các lỗ hổng đã ghi nhận.
