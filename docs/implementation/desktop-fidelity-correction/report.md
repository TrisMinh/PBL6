# Sửa độ giống Results desktop — Travel v3 28:30

Nguồn đối chiếu: Figma `OCkWSOZQ8Pq8AejXccajpO`, node `28:30`, screenshot 1440 × 1280 và high-fidelity design context. Skill sử dụng: figma-design-to-code. Phạm vi sửa: Results desktop; không sửa native mobile.

## Kết luận được điều chỉnh

Bản trước chưa đạt độ giống thiết kế. Geometry test cũ xác nhận khung ngoài, trong khi nội dung bên trong vẫn lệch. Không dùng số lượng test chức năng để tuyên bố toàn FE hoàn thành 100% theo Figma.

## Đã sửa

- Header: vị trí navigation, bỏ khoảng trống notification khi chưa đăng nhập, độ đậm chữ.
- Search: vị trí swap, vị trí và độ đậm nội dung trường, nút tìm chuyến và khoảng cách phía phải của số kết quả.
- Bộ lọc: legend đặt dưới divider thay vì cắt ngang divider; chiều cao các nhóm; khoảng cách controls; placeholder giờ có thể focus và chọn giờ; checkbox bo góc; vị trí thanh giá và thumb; nút áp dụng.
- Tiêu đề dùng Be Vietnam Pro thay cho Bricolage. Thêm font weight 700 vào font request để browser không tổng hợp bold.
- Mỗi card: initial/name/badge cùng hàng, đúng vị trí badge; font nhà xe; giờ và bến xe; duration/track/bus/destination; font giá 20px; nút 282 × 42 ở vị trí y+240. Giữ disclosure điểm dừng qua hover/focus và bàn phím.
- Chỉ ba sort pill như Figma; căn lại pagination.

## Bằng chứng

- `figma.png`: screenshot Figma gốc, không dùng làm asset trong app.
- `after.png`: ảnh production Customer web thật ở viewport 1440 × 1280.
- `figma-context.txt`: context phục vụ đối chiếu; các URL asset tạm ở tài liệu, không ở source runtime.
- `unit.log`: 192/192 test trips và SEO qua.
- `desktop.log`: 7/7 test production desktop qua, gồm test mới đo geometry bên trong cả sáu card, fonts, asset load và tương tác sắp xếp/chọn giờ, cộng sáu luồng portal đã có.
- `build.log`, `lint.log`, `typecheck.log`: build Customer, ESLint phạm vi thay đổi và typecheck.

## Khác biệt dữ liệu còn được ghi nhận

- Ảnh runtime dùng ngày fixture 01/01/2099 để các chuyến luôn đặt được; Figma ghi 28/08/2026, là ngày đã qua tại thời điểm kiểm tra.
- Figma ghi “Tất cả 15 loại xe”; bộ lọc hiện có hai nhóm dữ liệu “Giường nằm” và “Cabin / phòng”, nên runtime vẫn ghi “Tất cả loại xe”. Chưa coi danh mục 15 loại là đã hoàn thành.
- Chưa kiểm tra ảnh từng trang khác trong đợt sửa này; không suy rộng kết quả Results sang toàn Customer/Operator/Admin.
