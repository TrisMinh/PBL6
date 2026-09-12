# Nhật ký thay đổi implementation baseline

Tài liệu này giữ lịch sử các quyết định công nghệ đã làm thay đổi cách scaffold/build code nhưng không thay đổi nghiệp vụ của SRS. Không dùng log cũ làm nguồn quyết định hiện hành; baseline active nằm trong [Technology Stack](../system-design/02-01-system-architecture/02-01-11-technology-stack.md).

| ID | Ngày | Thay đổi | Trạng thái | Ảnh hưởng |
|---|---|---|---|---|
| IBL-001 | 2026-09-10 | Đổi backend Target Framework từ `net10.0` sang `net8.0` theo quyết định của chủ dự án. | Accepted, active | Mọi API, Worker, Gateway, class library và test project phải target `net8.0`. OpenAPI, AsyncAPI, JSON Schema và database contract không đổi. |
| IBL-002 | 2026-09-10 | Gom toàn bộ application source dưới `src/` và dùng namespace prefix `BusTicketPlatform`. | Superseded một phần bởi IBL-003 | Gateway ở `src/gateway`, service ở `src/services`, client ở `src/apps`, technical shared library ở `src/building-blocks`; vị trí test được IBL-003 chuyển vào `src/tests`. |
| IBL-003 | 2026-09-10 | Thu gọn repository thành hai vùng chính `src/` và `docs/`. | Superseded bởi IBL-004 | Test/infra chuyển vào `src`; executable contracts, SQL baseline, Word snapshots và QA render chuyển vào `docs`; solution và build config vẫn ở root. |
| IBL-004 | 2026-09-12 | Tách SRS khỏi tài liệu kỹ thuật và loại bỏ artifact sinh tự động. | Superseded bởi IBL-005 | `srs/` giữ baseline và Word; `docs/` giữ tài liệu kỹ thuật; không lưu diagram HTML hoặc ảnh QA render trong repository. |
| IBL-005 | 2026-09-12 | Phân vùng repository thành tài liệu, tracking và workspace triển khai. | Accepted, active | SRS chuyển vào `docs/srs/`; tracking tách ngang cấp tại `task-tracking/`; source và cấu hình build/tool nằm trong `workspace/`; root chỉ giữ metadata và điểm vào repository. |

## Ghi chú về SDK và Target Framework

Target Framework quyết định runtime/API surface của ứng dụng. SDK là bộ công cụ dùng để tạo và build project; SDK mới hơn có thể build Target Framework cũ hơn. Workstation tại thời điểm đổi baseline có SDK `9.0.316`, .NET/ASP.NET Core runtime `8.0.29`, và đã xác minh template có thể tạo project `net8.0`.

Khi source được tạo, nhóm pin một SDK feature band trong `workspace/global.json` để local/CI tái lập được build. Dù SDK được pin là 8.x hay bản mới hơn tương thích, mọi `.csproj` vẫn phải chứa:

```xml
<TargetFramework>net8.0</TargetFramework>
```
