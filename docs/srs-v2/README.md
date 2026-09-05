# SRS — Hệ thống đặt vé xe khách trực tuyến

## Thông tin tài liệu

| Thuộc tính | Giá trị |
|---|---|
| Mã tài liệu | PBL6-SRS-002 |
| Phiên bản nội dung | 2.0.0-draft |
| Trạng thái | Bản viết lại đang hoàn thiện |
| Phạm vi | Web End-user, Mobile App, Back-office Web và API dùng chung |
| Nguồn baseline | SRS phiên bản 1.0.0 và bộ đặc tả mô-đun trong `docs/srs` |

## Mục lục

1. [Giới thiệu](./01-gioi-thieu.md)
2. [Tổng quan sản phẩm](./02-tong-quan-san-pham.md)
3. [Quy trình và quy tắc nghiệp vụ](./03-quy-trinh-va-quy-tac-nghiep-vu.md)
4. [Đặc tả Use Case và sơ đồ](./04-use-cases/README.md)
5. [Yêu cầu chức năng](./05-yeu-cau-chuc-nang.md)
6. [Yêu cầu trạng thái nghiệp vụ](./06-yeu-cau-trang-thai.md)
7. [Yêu cầu giao diện và tích hợp](./07-giao-dien-va-tich-hop.md)
8. [Yêu cầu dữ liệu](./08-yeu-cau-du-lieu.md)
9. [Yêu cầu phi chức năng](./09-yeu-cau-phi-chuc-nang.md)
10. [Nghiệm thu và truy vết](./10-nghiem-thu-va-truy-vet.md)
11. [Phụ lục](./11-phu-luc.md)

## Phạm vi của bộ SRS

Bộ tài liệu mô tả sản phẩm phải phục vụ ai, cung cấp hành vi gì, tuân theo quy tắc nào, duy trì trạng thái và dữ liệu ra sao, đáp ứng chất lượng nào và được nghiệm thu bằng tiêu chí nào.

Các chi tiết thiết kế sau không phải nguồn yêu cầu chính của SRS:

- cấu trúc bảng, khóa và migration cụ thể;
- danh sách endpoint cùng request/response schema đầy đủ;
- topology triển khai, container và hạ tầng;
- thuật toán nội bộ hoặc lựa chọn framework;
- test script và test data chi tiết.

Các nội dung này được liên kết trong [Phụ lục](./11-phu-luc.md) để nhóm thiết kế triển khai tiếp mà không làm phần yêu cầu bị lan man.

## Quy tắc sử dụng mã

| Loại nội dung | Tiền tố |
|---|---|
| Mục tiêu sản phẩm | `GOAL-` |
| Quy trình nghiệp vụ | `BP-` |
| Quy tắc nghiệp vụ | `BR-` |
| Yêu cầu authorization | `AUTHZ-` |
| Use Case | `UC-` |
| Yêu cầu chức năng | `FR-` |
| Yêu cầu phi chức năng | `NFR-` |
| Yêu cầu giao diện | `UI-` |
| Tiêu chí chấp nhận | `AC-` |

Mã là định danh ổn định. Khi sắp xếp lại chương hoặc đổi tên file, các liên kết truy vết vẫn dùng mã, không dùng số trang.

## Nguồn quyết định khi có mâu thuẫn

Thứ tự ưu tiên là:

1. Yêu cầu có mã và đã được phê duyệt.
2. Business Rule và bảng chuyển trạng thái.
3. Acceptance Criteria.
4. Use Case.
5. Sơ đồ minh họa.

Sơ đồ hỗ trợ hiểu nhanh nhưng không được tạo thêm hành vi không tồn tại trong yêu cầu văn bản.

