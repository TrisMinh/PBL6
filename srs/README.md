# Software Requirements Specification

Thư mục `srs/` là khu vực độc lập dành riêng cho đặc tả yêu cầu và các bản phát hành Word. Tài liệu thiết kế và triển khai nằm tại [`docs/`](../docs/README.md).

## Baseline

- [SRS 2.0 — Active baseline](./v2/README.md): nguồn quyết định hiện hành cho phạm vi, nghiệp vụ, yêu cầu, trạng thái và tiêu chí nghiệm thu.
- [SRS 1.0 — Historical baseline](./v1/README.md): giữ nguyên để truy vết; không dùng để quyết định hành vi mới khi khác SRS 2.0.
- [Lịch sử phiên bản](./CHANGELOG.md): quan hệ giữa baseline nội dung và các bản Word phát hành.
- [Word SRS](./word/README.md): release, nguồn, tài liệu tham chiếu và snapshot cũ.

## Cấu trúc

```text
srs/
├── README.md
├── CHANGELOG.md
├── v1/                 # historical baseline
├── v2/                 # active baseline
└── word/
    ├── releases/       # Word đã phát hành
    ├── legacy/         # snapshot cũ
    ├── references/     # tài liệu tham chiếu
    └── sources/        # nguồn DOCX/PDF
```

Không ghi đè baseline hoặc Word release cũ. Mọi thay đổi hành vi phải được chấp nhận trong baseline Markdown trước khi đóng gói thành bản Word mới.
