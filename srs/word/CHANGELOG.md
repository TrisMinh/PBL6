# PBL6 SRS — Nhật ký phiên bản

Nhật ký này quản lý các file Word phát hành. Lịch sử phiên bản nội dung SRS 1.0.0 và 2.0.0 được quản lý riêng tại [`srs/CHANGELOG.md`](../CHANGELOG.md).

## PBL6 SRS v001

- Ngày phát hành: 11/09/2026
- Trạng thái: Bản hiện hành
- File: `releases/PBL6-SRS-v001.docx`
- Kích thước: 8.249.097 byte
- SHA-256: `6EC5C2EEE0308A398BD7752606306EACF3617EFE2DFE3CF4D2604C67700DFEA0`

### Ghi chú phiên bản

- Giữ nguyên nội dung SRS; chỉ bổ sung và chuẩn hóa phần trình bày được yêu cầu.
- Thêm caption bảng ở phía trên bảng và caption hình ở phía dưới hình.
- Sử dụng các style caption bảng và caption hình có sẵn trong tài liệu.
- Chèn 48 diagram trực tiếp từ mã Mermaid thuộc bộ tài liệu SRS 2, không dùng hình HTML.
- Cập nhật danh mục hình và danh mục bảng trong mục lục có sẵn.
- Loại bỏ lỗi caption bị lặp số và nội dung, ví dụ `Bảng 97`.
- Áp dụng style `Bảng Xanh Chuyên Nghiệp` cho 101 bảng nội dung.

### Nguồn sử dụng

- Bản SRS gốc: `sources/PBL6-SRS-original.docx`
- Bản PDF gốc: `sources/PBL6-SRS-original.pdf`
- Tài liệu SRS 2: `references/SRS-2-he-thong-dat-ve-xe-khach.docx`
- Tài liệu mẫu: `references/SRS-template.docx`

## Snapshot legacy từ `docsv1`

- Trạng thái: Historical snapshot, không phải bản phát hành hiện hành
- File: `legacy/PBL6-SRS-docsv1.docx`
- Kích thước: 2.533.363 byte
- SHA-256: `B595AE1269FE664C9095797777D12C4CFA3F538A5FBE792876DC8A692E20810A`
- Mục đích: giữ nguyên bản Word đã có trên `docsv1` trước khi tích hợp nhánh phát hành SRS.

## Quy tắc quản lý phiên bản

- Tên bản phát hành: `PBL6-SRS-vNNN.docx`.
- Mỗi lần chỉnh sửa, lưu thành một file mới với số phiên bản kế tiếp.
- Không ghi đè hoặc xóa phiên bản đã phát hành.
- Phiên bản có số lớn nhất trong `srs/word/releases` là bản Word hiện hành.
- Mỗi phiên bản phải có ngày, trạng thái, ghi chú thay đổi, kích thước và mã SHA-256.
