# Nhật ký thay đổi implementation baseline

Tài liệu này giữ lịch sử các quyết định công nghệ đã làm thay đổi cách scaffold/build code nhưng không thay đổi nghiệp vụ của SRS. Không dùng log cũ làm nguồn quyết định hiện hành; baseline active nằm trong [Technology Stack](../system-design/02-01-system-architecture/02-01-11-technology-stack.md).

| ID | Ngày | Thay đổi | Trạng thái | Ảnh hưởng |
|---|---|---|---|---|
| IBL-001 | 2026-09-10 | Đổi backend Target Framework từ `net10.0` sang `net8.0` theo quyết định của chủ dự án. | Superseded bởi IBL-007 | Mọi API, Worker, Gateway, class library và test project từng được yêu cầu target `net8.0`. OpenAPI, AsyncAPI, JSON Schema và database contract không đổi. |
| IBL-002 | 2026-09-10 | Gom toàn bộ application source dưới `src/` và dùng namespace prefix `BusTicketPlatform`. | Superseded một phần bởi IBL-003 | Gateway ở `src/gateway`, service ở `src/services`, client ở `src/apps`, technical shared library ở `src/building-blocks`; vị trí test được IBL-003 chuyển vào `src/tests`. |
| IBL-003 | 2026-09-10 | Thu gọn repository thành hai vùng chính `src/` và `docs/`. | Superseded bởi IBL-004 | Test/infra chuyển vào `src`; executable contracts, SQL baseline, Word snapshots và QA render chuyển vào `docs`; solution và build config vẫn ở root. |
| IBL-004 | 2026-09-12 | Tách SRS khỏi tài liệu kỹ thuật và loại bỏ artifact sinh tự động. | Superseded bởi IBL-005 | `srs/` giữ baseline và Word; `docs/` giữ tài liệu kỹ thuật; không lưu diagram HTML hoặc ảnh QA render trong repository. |
| IBL-006 | 2026-09-17 | Bổ sung `PAY_LATER` (in vé, không đo tiền mặt, no-show do nhà xe) và phí sàn trên tiền `PREPAID` đã thu qua cổng. | Accepted, active | SRS 2.0.1; Booking/Payment/Transport/Reporting SQL; OpenAPI 77 operation; settlement/ledger/payout. |
| IBL-007 | 2026-09-17 | Nâng backend Target Framework từ `net8.0` lên `.NET 10 LTS / net10.0`. | Accepted, active | Mọi API, Worker, Gateway, class library và test project target `net10.0`; SDK `10.0.401` được pin cho local/CI. Contract nghiệp vụ và database schema không đổi. |

## Ghi chú về SDK và Target Framework

Target Framework quyết định runtime/API surface của ứng dụng. SDK là bộ công cụ dùng để tạo và build project. Tại IBL-001, workstation dùng SDK `9.0.316` để xác minh template `net8.0`; IBL-007 thay baseline hiện hành bằng SDK `10.0.401` và Target Framework `net10.0`.

Nhóm pin SDK feature band trong `workspace/global.json` để local/CI tái lập được build. Theo baseline hiện hành, mọi `.csproj` phải chứa:

```xml
<TargetFramework>net10.0</TargetFramework>
```
