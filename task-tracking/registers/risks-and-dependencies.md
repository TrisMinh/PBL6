# Risk và Dependency Register

## 1. Thang đánh giá

- Probability/Impact: `L` thấp, `M` trung bình, `H` cao.
- Exposure: `RED` cần xử lý trong sprint, `AMBER` theo dõi hằng ngày/tuần, `GREEN` đã kiểm soát.
- Status: `OPEN`, `MITIGATING`, `BLOCKED`, `CLOSED`, `ACCEPTED`.

## 2. Risk register

| ID | Rủi ro | P | I | Exposure | Owner | Mitigation / trigger | Status | Review |
|---|---|:---:|:---:|:---:|---|---|---|---|
| `RISK-001` | Docker CLI/Compose đã cài nhưng Docker Desktop engine chưa chạy, chưa dùng được integration stack | H | H | RED | TEAM | Khởi động/xác nhận engine hoặc CI runner; trigger: `docker version` không trả Server section | OPEN | 2026-09-14 |
| `RISK-002` | Android/JDK/SDK không đồng nhất làm Mobile build chậm | M | H | AMBER | MOBILE | Ghi version matrix, clean-clone build trên máy thứ hai/CI | OPEN | S0 day 2 |
| `RISK-003` | 56 FR MUST quá lớn cho 4 người trong 9 sprint | H | H | RED | TEAM | Giữ scope MUST, WIP=1, demo vertical slice, dùng release buffer; trigger: Done <70% committed hai checkpoint liên tiếp | MITIGATING | Mỗi giữa sprint |
| `RISK-004` | OpenAPI/event/schema lệch giữa BE, FE và Mobile | M | H | AMBER | BE-1/BE-2 | Contract-first, generated client, compatibility CI; trigger: client tự tạo DTO hoặc compile fail | MITIGATING | Mỗi PR contract |
| `RISK-005` | Một backend thành bottleneck theo từng cụm Identity/Transport hoặc Booking/Payment | H | H | RED | BE-1/BE-2 | Backlog đã chia chéo account lifecycle, search, worker và reliability tests; rebalance nếu một BE vượt 10 PD P0 hoặc WIP vượt 1 | MITIGATING | Mỗi planning S1–S6 |
| `RISK-006` | FE/Mobile chờ API, cuối sprint mới tích hợp | M | H | AMBER | FE/MOBILE | Generated type + mock adapter; contract review trước sprint; integration checkpoint ngày 4 và 8 | MITIGATING | 2 lần/sprint |
| `RISK-007` | Repo trong thư mục OneDrive gây lock/path/node_modules hoặc build sync chậm | M | M | AMBER | TEAM | Không sync build artifacts; cân nhắc clone làm việc ngoài OneDrive; trigger: file lock/build không tái hiện | OPEN | S0 |
| `RISK-008` | Secret/payment credential bị commit | M | H | RED | BE-2 | `.env.example`, secret scan, user-secrets; rotate ngay nếu lộ | OPEN | Mỗi PR infra/payment |
| `RISK-009` | VNPay Sandbox/SMTP bên ngoài không ổn định | M | H | AMBER | BE-2 | Deterministic simulator/Mailpit, adapter boundary, timeout/retry | MITIGATING | S4/S5 |
| `RISK-010` | Main/develop/PR protection chưa thống nhất gây merge conflict hoặc mất baseline | M | H | RED | TEAM | Hoàn tất `S0-TEAM-01` trước code song song | OPEN | S0 day 1 |
| `RISK-011` | Eventual consistency tạo UI báo thành công sớm | M | H | AMBER | BE-2/FE/MOBILE | Presentation state `CONFIRMING`, polling/recovery E2E | OPEN | S4 |
| `RISK-012` | Thiếu evidence dù happy path demo chạy | M | H | AMBER | TEAM | Card không Done nếu thiếu test run/trace; audit board cuối sprint | MITIGATING | Mỗi review |

## 3. Dependency register

| ID | Dependency | Needed by | Owner | Due | Exit evidence | Status |
|---|---|---|---|---|---|---|
| `DEP-001` | Điền tên thật cho `BE-1`, `BE-2`, `FE`, `MOBILE` | Mọi card | TEAM | 2026-09-14 | Team ownership không còn ô trống | OPEN |
| `DEP-002` | Nhánh `develop` và branch protection | Code song song S0 | TEAM | 2026-09-14 | Rule/branch tồn tại, thử direct push bị chặn nếu hỗ trợ | OPEN |
| `DEP-003` | Docker engine hoạt động; CLI `29.7.2`, Compose `5.5.1` đã có | `S0-BE2-01..03`, `S0-TEAM-03` | TEAM | 2026-09-16 | `docker version` có Server section + Compose healthy log | BLOCKED |
| `DEP-004` | Android/JDK/SDK/emulator matrix | `S0-MOB-01` | MOBILE | 2026-09-15 | Debug build/install log | OPEN |
| `DEP-005` | .NET SDK feature band thống nhất | `S0-BE1-01` | BE-1 | 2026-09-15 | `workspace/global.json` + clean build | OPEN |
| `DEP-006` | Contract validation/generation command | FE/Mobile client | BE-2 | 2026-09-18 | Invalid fixture fails, valid baseline passes | OPEN |
| `DEP-007` | Seed/test identity + tenant | S1 client E2E, S2 operator flow | BE-1 | S1 midpoint | Reproducible seed + credentials local-only | PLANNED |
| `DEP-008` | `TripInventoryReady` contract | S2 client seat map, S3 SeatHold | BE-1/BE-2 | S2 midpoint | Producer/consumer test | PLANNED |
| `DEP-009` | Payment simulator behavior | S4 Web/Mobile integration | BE-2 | S4 day 3 | Deterministic success/fail/timeout cases | PLANNED |
| `DEP-010` | QR scanner permission/device test | S5 Driver check-in | MOBILE | S5 midpoint | Device/emulator evidence + manual fallback | PLANNED |

## 4. Escalation rule

1. Owner ghi blocker ngay khi không thể tiến tiếp quá 4 giờ.
2. Gắn risk/dependency ID vào card và chuyển `BLOCKED`.
3. Ghi next action, người cần hỗ trợ và thời hạn quyết định.
4. Nếu quá due date, facilitator gọi sync 15 phút và chọn: xử lý, mock/decouple, đổi owner, giảm scope không-MUST hoặc ghi waiver.
5. Không dùng “đang chờ” làm trạng thái nếu chưa có owner và next action.
