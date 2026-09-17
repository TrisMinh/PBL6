# Báo cáo sẵn sàng triển khai code

- Baseline: SRS 2.0.1
- Ngày đánh giá ban đầu: 2026-09-09
- Cập nhật baseline runtime: 2026-09-10
- Cập nhật toolchain: 2026-09-12
- Cập nhật PAY_LATER và phí sàn: 2026-09-17
- Kết luận: **READY có điều kiện về toolchain**

## 1. Kết luận chuyên môn

Bộ tài liệu hiện tại đủ để bắt đầu **Slice 0 — Foundation và contract gate** mà không phải tự đoán thêm requirement, route, event hoặc schema nghiệp vụ. Phạm vi MVP được khóa ở toàn bộ `MUST`; `SHOULD/COULD` không được đưa vào route, UI hoặc consumer đang hoạt động.

Workstation đã có thể scaffold project target `net8.0`: SDK `9.0.316` nhận template `net8.0`, đồng thời máy có .NET/ASP.NET Core runtime 8. Docker client `29.7.2` và Compose `5.5.1` đã được cài, nhưng Docker Desktop Linux engine chưa chạy nên PostgreSQL, RabbitMQ và integration test vẫn bị chặn. Node.js/npm hiện đã đạt baseline.

## 2. Scope đã khóa

| Hạng mục | Baseline |
|---|---:|
| Functional Requirement | 71 |
| MVP `MUST` | 61 |
| Backlog `SHOULD` | 10 |
| `COULD` | 0 |
| Non-functional Requirement | 59 |
| Acceptance Criteria | 73 |

Mười requirement P1 không thuộc MVP: `FR-SEARCH-007`, `FR-BOOK-010`, `FR-PAY-010`, `FR-PROMO-001`, `FR-PROMO-002`, `FR-REVIEW-001`, `FR-REVIEW-002`, `FR-NOTIF-003`, `FR-ADMIN-003`, `FR-REPORT-003`.

## 3. Artifact đã sẵn sàng cho implementation

| Artifact | Kết quả |
|---|---|
| SRS 2.0.1 | Quy tắc trả sau + phí sàn, trạng thái, priority và acceptance đã thống nhất |
| ADR/System Design | Đã quyết định stack, service boundary, consistency, security và monorepo |
| OpenAPI 3.1 | 77 operation active; `operationId` duy nhất; không lộ route P1 |
| AsyncAPI 3.1 | 20 channel và 20 send operation active |
| JSON Schema | 20 event active dùng chung envelope; 45 definition |
| PostgreSQL baseline | Shared integration tables và initial schema cho 6 service |
| UI/UX contract | Information architecture, screen/state contract, token và client security |
| Traceability/test design | Requirement → API/event/DB/UI/test và test critical path |
| Delivery plan | Slice 0–8, Definition of Ready và Definition of Done |

## 4. Quyết định đã khóa để code không phải suy đoán

- Backend: mọi project target .NET 8 (`net8.0`), ASP.NET Core, EF Core/Npgsql; Gateway dùng YARP.
- Web/back-office: React 19.2 + TypeScript + Vite; Node.js 24 LTS và npm workspaces.
- Mobile: React Native 0.87 + TypeScript.
- Dữ liệu/message: PostgreSQL, RabbitMQ; Redis chỉ là auxiliary store.
- Thanh toán MVP: VNPay Sandbox và provider simulator cho test xác định.
- Xác minh tài khoản: email; SMS OTP để sau MVP.
- SeatHold và Booking payment window: cố định 10 phút cho chọn ghế/`PREPAID`, không gia hạn. `PAY_LATER` không dùng cửa sổ thanh toán cổng.
- Phí sàn mặc định 10% snapshot trên Organization, chỉ trừ khi thu `PREPAID` qua cổng; `PAY_LATER` commission = 0.
- Tồn kho ghế: khóa theo toàn bộ Trip trong MVP.
- Tiền: số nguyên `int64` theo VND; ID/correlation dùng UUIDv7.
- Mật khẩu: Argon2id qua adapter `IPasswordHasher`, có version và rehash policy.
- Customer thấy trạng thái trình bày `CONFIRMING` trong lúc hội tụ thanh toán.
- Notification MVP: in-app + email; push/SMS để sau.

## 5. Gate đã kiểm tra

- OpenAPI lint hợp lệ.
- AsyncAPI validate hợp lệ, không có governance issue.
- JSON/YAML parse thành công; sample event hợp lệ theo JSON Schema.
- Các SQL baseline đã qua PostgreSQL syntax parser.
- 398 liên kết Markdown nội bộ được kiểm tra không có link gãy.
- `git diff --check` không phát hiện whitespace error; cảnh báo LF/CRLF chỉ là line-ending của Git trên Windows.

Các gate cần thực hiện sau khi có source/toolchain:

1. Build/test toàn solution với mọi `.csproj` target `net8.0`.
2. Compose smoke test và migrate sáu database từ rỗng.
3. Sinh TypeScript client từ OpenAPI rồi compile Web/Mobile.
4. Chạy concurrency test SeatHold trên PostgreSQL thật.
5. Chạy publish/consume, retry/DLQ và crash-after-commit test với RabbitMQ thật.

## 6. Việc không chặn bắt đầu code

Các quyết định production như cloud/region, merchant VNPay thật, email provider thật, secret store, CI runner, observability backend và managed/self-hosted data services chưa cần khóa cho local MVP. Chúng phải có ADR riêng trước khi deploy production, nhưng không phải lý do trì hoãn Slice 0–8.

## 7. Bước triển khai kế tiếp

1. Đáp ứng [development prerequisites](./05-development-prerequisites.md).
2. Scaffold đúng [repository structure](./01-repository-structure.md).
3. Thực hiện [Slice 0](./02-mvp-delivery-plan.md#slice-0--foundation-và-contract-gate).
4. Chỉ chuyển Slice 1 khi toàn bộ exit gate của Slice 0 có evidence.
