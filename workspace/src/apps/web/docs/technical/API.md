# API Reference — trạng thái frontend mock

Tài liệu canonical cho request/response, lỗi và quy tắc dữ liệu mock là [`API_CONTRACT.md`](./API_CONTRACT.md). Đây là interface nội bộ giúp component, query hook, service và MSW thống nhất dữ liệu.

## Trạng thái

- Nguồn dữ liệu: MSW handlers và fixtures triển khai theo contract.
- JSON: camelCase; thời gian: ISO 8601 UTC; tiền: integer VND; lỗi: RFC 7807 Problem Details.
- Mutation tạo booking/thanh toán mô phỏng idempotency để test double-submit.

Mọi thay đổi contract phải cập nhật đồng thời `API_CONTRACT.md`, MSW handler, schema Zod, fixture và test liên quan.
