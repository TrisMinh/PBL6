# AUTH-01 — Test đăng ký tài khoản thành công

## Thông tin request

- **Method:** `POST`
- **URL:** `http://localhost:5080/api/v1/auth/register`
- **Header:** `Content-Type: application/json`
- **Body:** chọn `raw` → `JSON`:

```json
{
  "fullName": "Minh Tridz",
  "email": "MINHTRIDZ@GMAIL.COM",
  "phone": "0914966707",
  "password": "CorrectHorse1"
}
```

## Thực hiện

1. Đảm bảo API đang chạy tại `http://localhost:5080`.
2. Tạo request theo thông tin ở trên trong Postman.
3. Nhấn **Send**.
4. So sánh kết quả thực tế với kết quả mong đợi bên dưới. Không cần thêm script.

## Kết quả mong đợi

- HTTP status: `202 Accepted`.
- Response có `status` bằng `ACCEPTED` và có `operationId`.
- Tài khoản được đăng ký ở trạng thái chờ xác minh OTP. Test case này chỉ kiểm tra đăng ký, không xác minh OTP.
