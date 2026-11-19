# Rà trực quan FE desktop — 15/11/2026

## Cách kiểm tra

Chụp production Customer/Operator/Admin và xem bảng ảnh toàn trang, sau đó mở lớn các modal, form và luồng đặt vé. Đợt rà soát có **50 ảnh trạng thái ở 1440 px**, thêm kiểm tra 1280/1920 px. Các ảnh minh họa được liệt kê ở phần bằng chứng bên dưới.

Test chức năng, geometry và accessibility là kiểm tra bổ sung. Chúng không phải kết luận về chất lượng thẩm mỹ. Không lập screenshot baseline từ giao diện đang sai rồi coi baseline đó là thiết kế chuẩn.

Nguồn đối chiếu Figma Travel v3: BLUE/Button `14:20` (Default/Hover/Disabled), modal tổ chức `1185:834`, Tạo chuyến `764:8`, Hành khách `30:344`, cùng các frame Customer đã lấy ở các vòng trước. Dùng skill `figma-design-to-code` và `ui-ux-pro-max`. Modal tài khoản và các trang mở rộng chưa có frame riêng, nên dùng typography/spacing/control của các modal hiện có; không ghi chúng là bản sao Figma 1:1.

## Đã sửa từ lớn đến nhỏ

| Phần | Lỗi quan sát được | Thay đổi |
|---|---|---|
| Modal tài khoản Admin | Mô tả và hai hành động dính nhau; font/close không đồng nhất | Header riêng, chữ 20/30 semibold, mô tả 14/22; footer có divider và gap 12px; hai nút cao 44px bằng nhau, close 36px với icon 20px |
| CSS dùng chung | Button có cùng độ ưu tiên với CSS layout, nên thứ tự tải chunk có thể làm menu desktop hiện ra và ghi đè kiểu thành phần | Đặt nền tảng Button trong layer `components`, để CSS thành phần ghi đè ổn định; kiểm tra sau khi chuyển route |
| Button | Hover primary chuyển sang màu gần đen; secondary không theo Figma; loading thay nhãn làm thay đổi kích thước | Primary hover `#1557c9`; secondary dùng các màu Figma; disabled riêng; loading giữ chỗ cho nội dung và hiển thị spinner; giữ focus ring và reduced motion |
| Tạo/chỉnh sửa/review chuyến | Bị mất sidebar ở mock portal, form giãn hết viewport | Khôi phục shell/sidebar ở luồng mock; header (214,16,1210,68), stepper (214,92,1210,72) tại 1440; giữ shell live riêng |
| Chọn tuyến | Một select Tuyến và hai ô thông tin đọc lại làm lệch bố cục | Hai select Điểm đi/Điểm đến và nút swap dùng asset đang có của Figma; giữ chính xác route ID, trạng thái tuyến và cập nhật điểm đón/trả; gom các ô thời gian desktop thành một hàng |
| Modal Operator | Token `--op-*` chỉ ở ancestor, không truyền qua Radix Portal; label/select thiếu style và không có close ở header | Khai báo token ở dialog, bổ sung typography/viền/spacing/scroll; style label/select trong portal; dùng header có nút đóng chung cho modal thành viên/đối soát/xác nhận |
| Form và thông báo | `--color-border-default`, `--color-status-danger`, `--color-text-error`, `--space-1`, `--space-3` chưa được khai báo | Dùng token hiện có; phục hồi viền textarea/card hỗ trợ, màu lỗi form và khoảng cách tooltip điều kiện vé |
| Typography | Font request thiếu Bricolage 600 dù nhiều heading yêu cầu semibold | Tải đúng weight; giữ Be Vietnam Pro ở modal và control; đưa các màu Results về semantic token |
| Header Customer | Navigation lệch theo chiều rộng khối tài khoản; underline ngoài thiết kế; header đè nội dung khi cuộn | Căn giữa navigation độc lập với actions; ẩn notification slot rỗng; active bằng weight/màu; header desktop nằm trong luồng trang |
| Nút Đặt vé | Dẫn tới Results không có tham số tìm kiếm | Dẫn về `/#booking-search`, anchor tồn tại cả khi danh sách địa điểm đang tải; đã mở thật tại 1280/1920 |
| Nhãn hành trình | Có nơi dùng tên tỉnh, có nơi dùng nhãn điểm đến | Dùng `displayName` nhất quán ở chọn ghế, tóm tắt, kết quả thanh toán và vé; ví dụ TP. Hồ Chí Minh → Đà Lạt |

Ảnh tập trung: [modal trước/sau](account-before-after.png), [các trạng thái Button](button-states.png), [Tạo chuyến](reviewed/operator-new-trip.png), [modal Operator](reviewed/operator-add-member.png). Bảng Button chỉ là preview CSS dùng chung; các button còn được xem trong ảnh production, không dùng bảng này thay thế review từng trang.

## Phạm vi ảnh đã rà

- Customer: Home, Explore/detail, login/register/forgot, Results, tra cứu và danh sách vé, hỗ trợ; chọn ghế, hành khách, review, thanh toán, gateway QR/ngân hàng, kết quả, xác thực và vé điện tử.
- Operator: lịch, tạo chuyến trống/chọn tuyến, đặt chỗ, danh sách hành khách, tuyến/tạo tuyến, xe, tài xế/thêm tài xế, báo cáo, hủy/hoàn, tổ chức/đối soát và các modal thành viên/đối soát.
- Admin: login, tổ chức/danh sách/chi tiết/tạo, nhân viên/danh sách/chi tiết/thêm thành viên, booking/payment/refund, tài khoản default/hover/focus.

Ảnh được rà theo bố cục, vùng trống, nhịp chữ, alignment, hierarchy, kích thước control, icon và trạng thái. Các khối chưa có frame riêng vẫn là phần mở rộng. Nội dung mock, số dòng bảng và các field nghiệp vụ động có thể làm chiều cao trang khác frame mẫu. Chưa nghiệm thu pixel-perfect toàn bộ node của file Figma; danh mục khách hàng 15 loại xe được ghi thiếu từ vòng trước vẫn chưa hoàn tất.

## Kiểm tra hồi quy bổ sung

- Build độc lập Customer/Operator/Admin qua (`build-*.log`).
- Lint và typecheck qua (`lint.log`, `typecheck.log`).
- 1.443/1.443 unit/integration qua (`unit-final.log`).
- 11/11 production desktop qua (`desktop-final.log`), bao gồm chuyển route rồi mở modal, hover/focus, geometry shell và đổi chiều tuyến.
- Operator tạo → review → phát hành → reload → logout qua (`operator-workflow.log`).
- Anchor tìm chuyến và modal tại 1280/1920 qua, không tràn ngang (`wide-check.json`).
- Quét tham chiếu CSS variable chưa khai báo trả về rỗng (`tokens.py`).

Không đổi native mobile, không nối API mới, không commit/push/deploy. Các log thất bại trong lúc sửa được giữ để truy vết; trạng thái cuối dùng các log nêu ở đây.
