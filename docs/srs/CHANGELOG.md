# Lịch sử baseline SRS

Tài liệu này theo dõi phiên bản nội dung SRS. Phiên bản file Word được quản lý riêng trong [`word/CHANGELOG.md`](./word/CHANGELOG.md).

## Trạng thái hiện hành

- Active baseline: [SRS 2.1.0](./v2/README.md).
- Historical baseline: [SRS 1.0.0](./v1/README.md).
- Current Word release: [`PBL6-SRS-v003.docx`](./word/releases/PBL6-SRS-v003.docx).

## Lịch sử phiên bản nội dung

| Phiên bản | Ngày baseline | Trạng thái | Vị trí | Ghi chú |
|---|---|---|---|---|
| 2.1.0 | 2026-09-21 | Accepted, active | [`docs/srs/v2`](./v2/README.md) | Bổ sung `FR-REPORT-004` (`SHOULD`) cho Power BI Embedded đa chiều, tenant/RLS, freshness, UI/integration/data/AC và liên kết Detailed Design; 61 FR `MUST` MVP không đổi. |
| 2.0.1 | 2026-09-17 | Superseded by 2.1.0 | [`docs/srs/v2`](./v2/README.md) | Bổ sung `MUST`: trả sau (nhà xe bật, in vé, sàn không đo tiền mặt, no-show do nhà xe chịu) và phí sàn trên tiền đã thu qua cổng. |
| 2.0.0 | 2026-09-09 | Superseded by 2.0.1 | [`docs/srs/v2`](./v2/README.md) | Baseline triển khai MVP; hợp nhất phạm vi, nghiệp vụ, yêu cầu, trạng thái và tiêu chí nghiệm thu. |
| 1.0.0 | 2026-08-19 | Superseded | [`docs/srs/v1`](./v1/README.md) | Baseline mô-đun ban đầu; được giữ nguyên để truy vết lịch sử. |

## Lịch sử phát hành Word

| Phiên bản Word | Ngày phát hành | Trạng thái | File | Ghi chú |
|---|---|---|---|---|
| Legacy `docsv1` | Trước 2026-09-11 | Historical snapshot | [`PBL6-SRS-docsv1.docx`](./word/legacy/PBL6-SRS-docsv1.docx) | Giữ lại nguyên trạng để đối chiếu trước tích hợp. |
| v001 | 2026-09-11 | Superseded by v002 | [`PBL6-SRS-v001.docx`](./word/releases/PBL6-SRS-v001.docx) | Chuẩn hóa caption/bảng và chèn 48 diagram từ bộ tài liệu SRS 2.0.0. |
| v002 | 2026-09-17 | Superseded by v003 | [`PBL6-SRS-v002.docx`](./word/releases/PBL6-SRS-v002.docx) | Đóng gói SRS 2.0.1: trả sau + phí sàn; không ghi đè v001. |
| v003 | 2026-09-21 | Current Word release | [`PBL6-SRS-v003.docx`](./word/releases/PBL6-SRS-v003.docx) | Đóng gói SRS 2.1.0: bổ sung Power BI Analytics `SHOULD`; không ghi đè v002. |

## Quy tắc duy trì

- Không sửa hoặc xóa baseline đã phát hành; tạo phiên bản mới và ghi thêm một dòng lịch sử.
- Mọi thay đổi hành vi phải được chấp nhận trong Markdown baseline trước khi đồng bộ sang Word.
- `docs/README.md` phải luôn trỏ tới baseline nội dung active và bản Word hiện hành.
- Mỗi bản Word mới phải có số phát hành, ngày, trạng thái, kích thước và SHA-256 trong `word/CHANGELOG.md`.
