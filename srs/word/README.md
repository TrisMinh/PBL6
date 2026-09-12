# Hồ sơ Word SRS PBL6

## Bản hiện hành

- Tài liệu: [`releases/PBL6-SRS-v001.docx`](./releases/PBL6-SRS-v001.docx)
- Phiên bản phát hành Word: `v001`
- Trạng thái: Current Word release
- Nhật ký chi tiết: [`CHANGELOG.md`](./CHANGELOG.md)

## Quan hệ phiên bản

Phiên bản nội dung và phiên bản file Word là hai trục độc lập:

| Trục | Bản lịch sử | Bản hiện hành | Nguồn quyết định |
|---|---|---|---|
| Baseline nội dung SRS | [1.0.0](../v1/README.md) | [2.0.0](../v2/README.md) | Markdown trong `srs/v2` |
| Bản đóng gói Word | Snapshot `docsv1` trong `legacy/` | `PBL6-SRS-v001.docx` | File phát hành trong `releases/` |

`v001` là số phát hành của file Word, không đồng nghĩa với phiên bản nội dung `1.0.0`. Xem [lịch sử baseline SRS](../CHANGELOG.md) để biết mốc nào đang active.

## Cấu trúc thư mục

- `releases/`: các bản SRS đã đánh số phiên bản.
- `sources/`: DOCX và PDF gốc trước khi bổ sung caption, diagram và định dạng.
- `references/`: SRS 2 và tài liệu mẫu dùng để đối chiếu.
- `legacy/`: snapshot Word cũ được giữ lại từ nhánh `docsv1` để truy vết.

Không chỉnh sửa trực tiếp các file trong `releases`, `sources`, `references` hoặc `legacy`. Khi cần chỉnh bản hiện hành, sao chép nguồn làm việc thành phiên bản kế tiếp, hoàn tất QA rồi mới đưa file mới vào `releases`.
