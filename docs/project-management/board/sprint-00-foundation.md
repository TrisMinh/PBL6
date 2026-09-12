# Sprint 0 — Foundation & Contract Gate

## 1. Sprint contract

- Thời gian: 2026-09-14 → 2026-09-27.
- Mục tiêu: tạo nền tảng build/test/integration chung để bốn thành viên phát triển độc lập mà không tự viết lại contract.
- Capacity danh nghĩa: 32 PD; committed: 26 PD; buffer: 6 PD.
- Không thuộc scope: business feature hoàn chỉnh, UI polish, deployment production và mọi FR `SHOULD`.

## 2. Checklist khởi động chung

### `S0-TEAM-01` — Team/Git setup

- [x] Điền tên vào [team ownership](../01-team-ownership.md).
- [ ] Chọn một người facilitator cho Sprint 0; facilitator không phải “sếp kỹ thuật”.
- [ ] Tạo/xác nhận `develop`; bảo vệ `main`, cấm direct push.
- [ ] Thống nhất branch/commit/PR convention.
- [ ] Gán reviewer chéo BE và TypeScript.
- [ ] Tạo `.env.example`; xác nhận `.env`, secret và local volume bị ignore.
- [ ] Cập nhật board: owner, Started và ngày cập nhật.

### `S0-TEAM-02` — Toolchain matrix

- [ ] Cả 4 người chạy `git --version`, ghi khác biệt gây ảnh hưởng nếu có.
- [ ] BE chạy `dotnet --info`; xác nhận build target `net8.0`.
- [ ] FE/Mobile chạy `node --version` và `npm --version`; baseline Node 24/npm 11.
- [ ] Máy chạy integration xác nhận `docker version` và `docker compose version`.
- [ ] Mobile xác nhận JDK/Android SDK/emulator/device phù hợp React Native.
- [ ] Ghi blocker vào [risk register](../registers/risks-and-dependencies.md), không để trong chat rồi thất lạc.

## 3. Hoàng Minh Trí (`BE-1`) checklist

### `S0-BE1-01` — .NET solution/build baseline

- [ ] Tạo `BusTicketPlatform.sln`, `global.json`, `Directory.Build.props`, `Directory.Packages.props`.
- [ ] Pin package versions tập trung; mọi project target `net8.0`.
- [ ] Scaffold đúng boundary `Api/Application/Domain/Infrastructure`; không tạo Worker rỗng.
- [ ] Bật nullable, warnings phù hợp và analyzers thống nhất.
- [ ] Thêm architecture test cho dependency rule tối thiểu.
- [ ] `dotnet restore` và `dotnet build` pass từ root.

### `S0-BE1-02` — Gateway và HTTP baseline

- [ ] Tạo YARP Gateway, route thử tới một health endpoint.
- [ ] Chuẩn hóa correlation ID nhận/tạo/trả về response.
- [ ] Áp dụng error envelope theo OpenAPI.
- [ ] Tách liveness/readiness; dependency lỗi không làm liveness fail sai.
- [ ] Integration test request đi qua Gateway và assert error/correlation.

### `S0-BE1-03` — Technical building blocks

- [ ] Event/message primitives không chứa domain entity.
- [ ] Clock/UUIDv7 abstraction để test xác định.
- [ ] Structured logging redaction hook và telemetry convention.
- [ ] Result/error mapping có unit tests.
- [ ] Test fixture dùng được bởi service khác mà không project-reference domain.

### `S0-BE1-04` — Identity skeleton

- [ ] Tạo đúng project/layer cho Identity.
- [ ] Kết nối database qua config/secret convention.
- [ ] Thêm initial EF migration hoặc adapter chạy baseline SQL đã thống nhất.
- [ ] Health/readiness phản ánh database connectivity.
- [ ] Unit + integration smoke pass; chưa thêm auth flow ngoài scope.

## 4. Ngô Quang Sinh (`BE-2`) checklist

### `S0-BE2-01` — Local Compose stack

- [ ] Compose có PostgreSQL, RabbitMQ, Redis, Mailpit và payment simulator.
- [ ] Có healthcheck, network, port và volume naming ổn định.
- [ ] Không hard-code secret thật; local credential chỉ dùng dev và được mô tả.
- [ ] Có lệnh start/stop/reset an toàn trong README.
- [ ] `docker compose config` pass.
- [ ] `docker compose up` đạt healthy trên máy/CI có Docker.

### `S0-BE2-02` — Database bootstrap

- [ ] Tạo database/schema ownership cho 6 bounded context.
- [ ] Chạy shared integration tables đúng service.
- [ ] Migration từ empty pass và chạy lại không gây tác động sai.
- [ ] Seed synthetic tenant/user/trip không chứa PII thật.
- [ ] Test reset có xác nhận target môi trường local/test.

### `S0-BE2-03` — Messaging smoke

- [ ] Cài topology/exchange/queue theo AsyncAPI baseline.
- [ ] Publish message có envelope/version/correlation/occurredAt.
- [ ] Consumer validate schema, Inbox dedupe và ACK sau commit.
- [ ] Outbox publisher retry được; poison message đi đúng DLQ.
- [ ] Test publish/consume, duplicate delivery và broker restart.

### `S0-BE2-04` — Contract gates

- [ ] Validate OpenAPI 3.1 và uniqueness của `operationId`.
- [ ] Validate AsyncAPI + JSON Schema và sample events.
- [ ] Parse/lint SQL baseline.
- [ ] Tạo command ổn định để local và CI gọi cùng cách.
- [ ] Gate fail với fixture sai để chứng minh check thực sự hoạt động.

## 5. Đinh Công Trung Sỹ (`FE`) checklist

### `S0-FE-01` — Web workspace

- [ ] Tạo root npm workspace và một root lockfile.
- [ ] Cấu hình TypeScript strict, Vite, lint, format và unit test.
- [ ] Không trộn npm/pnpm/yarn.
- [ ] Root commands chạy build/test/lint từng app và toàn workspace.

### `S0-FE-02` — Web application shells

- [ ] Scaffold `customer-web` và `backoffice-web`.
- [ ] Routing, public/protected layout và not-found.
- [ ] Error boundary + global loading state.
- [ ] Environment adapter; không đọc biến môi trường rải rác.
- [ ] Smoke component test cho mỗi app.

### `S0-FE-03` — Generated API client

- [ ] Sinh TypeScript client từ OpenAPI bằng command reproducible.
- [ ] Generated code tách khỏi handwritten adapter.
- [ ] CI phát hiện generated client lệch contract.
- [ ] Health adapter test success/network/error envelope.

### `S0-FE-04` — Web UI foundation

- [ ] Token màu/spacing/type theo UI design.
- [ ] Button/input/form validation states.
- [ ] Loading/skeleton, empty, error và retry primitives.
- [ ] Focus visible, keyboard flow và contrast baseline.

## 6. Ngô Thành Đạt (`MOBILE`) checklist

### `S0-MOB-01` — React Native baseline

- [ ] Scaffold app đúng React Native baseline đã khóa.
- [ ] Android debug build/install/run pass.
- [ ] TypeScript strict, lint, unit/component test commands pass.
- [ ] Package/version không tạo lockfile thứ hai.

### `S0-MOB-02` — Navigation, config và session boundary

- [ ] Root navigation + auth/app stacks.
- [ ] Environment adapter cho base URL/deep link.
- [ ] Secure storage interface; chưa lưu token trong plain async storage.
- [ ] Error boundary + app resume/network status hooks.
- [ ] Unit test cho route guard/session state.

### `S0-MOB-03` — Generated API client

- [ ] Dùng cùng generated contract hoặc cùng generator config với Web.
- [ ] Adapter hỗ trợ correlation/error envelope.
- [ ] Health call compile và test được với mock server.
- [ ] Không tự định nghĩa lại request/response DTO.

### `S0-MOB-04` — Mobile UI foundation

- [ ] Theme/token và typography cơ bản.
- [ ] Button/input/form feedback.
- [ ] Loading/empty/error/retry và offline banner.
- [ ] Touch target, screen reader label và font scaling baseline.

## 7. Integration/CI exit checklist — `S0-TEAM-03`

- [ ] Clean clone restore/build/lint/test thành công.
- [ ] Compose stack healthy và migrate từ empty.
- [ ] Request health đi qua Gateway có correlation ID.
- [ ] Event publish/consume + duplicate delivery test pass.
- [ ] Generated client compile cho Customer Web, Back-office và Mobile.
- [ ] Không có secret hoặc generated build artifact bị commit.
- [ ] README có một luồng setup local từ clone đến smoke.
- [ ] CI log/test result được link vào evidence.
- [ ] Toàn bộ card P0 Sprint 0 Done hoặc waiver có owner/due date.

## 8. Demo script

1. Clone/restore repository trên môi trường sạch.
2. Khởi động local stack và xem health các dependency.
3. Migrate database từ empty.
4. Gọi health qua Gateway từ generated client Web/Mobile test.
5. Publish một event, consumer ghi Inbox đúng một lần khi message gửi lặp.
6. Cho xem CI pass và board/evidence tương ứng.
