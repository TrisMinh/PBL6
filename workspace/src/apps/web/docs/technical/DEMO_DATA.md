# Dữ liệu demo FE — 01/11/2026

Đã thêm trực tiếp vào DB local, không thay đổi code BE. Dữ liệu cũ được giữ lại; mã demo có tiền tố `DEMO-` và UUID bắt đầu `019afeee`.

- Khách: `seed.customer@example.test` / `CustomerPass1`.
- Nhà xe: `operator.seed@example.test` / `OperatorPass1`.
- Admin: `admin.seed@example.test` / `AdminPass1234`.
- Tài xế: `driver.seed@example.test` / `DriverPass1`.

Tìm tuyến **Đà Nẵng → Huế**, ngày **03–08/11/2026**. Ngày **04, 06, 08/11** hỗ trợ thanh toán sau. Có điểm trung gian **Lăng Cô**, xe 24 ghế và ghế trống để tạo đơn mới.

| Đơn | Trường hợp |
| --- | --- |
| DEMO-0001 | Đã thanh toán, vé chưa check-in |
| DEMO-0002 | Thanh toán sau, vé chưa check-in, chuyến BOARDING |
| DEMO-0003 | Vé đã check-in |
| DEMO-0004 | Đã hủy và hoàn tiền |
| DEMO-0005 | Đơn thanh toán sau đã hủy |
| DEMO-0006 | Chờ thanh toán; hết hạn theo thời gian thực sau khoảng 10 phút từ lúc seed |
| DEMO-0007 | Đơn hết hạn, giao dịch thất bại |
| DEMO-0008 | Đơn và giao dịch đã hủy |
| DEMO-0009 | Chuyến hoàn thành, vé đã sử dụng |

Khách có 28 thông báo để thử đọc và tải trang tiếp. Nhà xe có dữ liệu danh sách hành khách, phân công tài xế, đối soát và báo cáo. Admin có giao dịch và hoàn tiền để xem chi tiết.

Script nạp: `workspace/scripts/load-fe-demo.cjs`. Manifest và SQL từng DB lưu tại `workspace/src/apps/web/tmp/demo-fixtures/`.

Backup trước khi nạp: `C:\Users\ADMIN\AppData\Local\Temp\pbl6-before-demo-20261101-164251`.

Các trạng thái lịch sử là dữ liệu minh họa được chèn trực tiếp, không chứng minh luồng webhook/event đã chạy. Có thể tạo đơn mới trên các ghế trống để thử luồng thực tế.
