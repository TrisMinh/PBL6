# Cẩm Nang Kiến Trúc & Kỹ Thuật Dự Án PBL6 — BLUE Bus Ticket Platform

Luồng checkout web và demo hiện tại dùng **SePay Sandbox**. Các đoạn về VNPay mô tả mã tương thích cũ, thiết kế lịch sử hoặc phần mobile chưa chuyển sang SePay. [Hướng dẫn chạy SePay](../implementation/sepay-integration.md).

Bộ tài liệu này được chia thành **2 cấp độ rõ ràng** để bạn chọn đúng mức độ chi tiết mình cần:

---

## CẤP ĐỘ 1 (KHUYÊN ĐỌC ĐẦU TIÊN): BẢN TINH GỌN — CẤU TRÚC & CÁCH ÁP DỤNG CÔNG NGHỆ VỪA ĐỦ ĐỂ HIỂU NHANH & THUYẾT TRÌNH (`THƯ MỤC 00` · 6 BÀI NGẮN GỌN)

> **Đúng trọng tâm kỹ thuật kiến trúc**: Không lan man kịch bản nghiệp vụ (use-case), không sa đà chi tiết cú pháp ngôn ngữ vụn vặt. Mỗi bài chỉ dài **~110–130 dòng (đọc 5 phút/bài, 30 phút nắm trọn toàn dự án)** — giải thích thẳng cấu trúc dự án và cách từng công nghệ được lắp ghép, vận hành thực tế ra sao.

Thư mục: [`./00-trong-tam-ky-thuat-vua-du-de-thuyet-trinh/`](./00-trong-tam-ky-thuat-vua-du-de-thuyet-trinh/)

1. **[`01-cau-truc-du-an-clean-architecture-va-building-blocks.md`](./00-trong-tam-ky-thuat-vua-du-de-thuyet-trinh/01-cau-truc-du-an-clean-architecture-va-building-blocks.md)**
   - Cấu trúc `workspace/src/`, vai trò 4 tầng Clean Architecture (`Domain`, `Application`, `Infrastructure`, `Api`), khóa ranh giới bằng `NetArchTest`, và 3 cơ chế dùng chung trong `BuildingBlocks` (`Result<T>`, `ErrorEnvelope`, `X-Correlation-Id`, `Idempotency-Key`).
2. **[`02-api-gateway-yarp-dinh-tuyen-va-bao-ve-he-thong.md`](./00-trong-tam-ky-thuat-vua-du-de-thuyet-trinh/02-api-gateway-yarp-dinh-tuyen-va-bao-ve-he-thong.md)**
   - Tại sao dùng **YARP (`:5080`)**, cấu hình 6 `Clusters` & `Routes`, mẹo dùng trọng số ưu tiên `Order (-30, -20, 0, 10)` để gọt chung đường dẫn `/api/v1/trips` về cả `Booking` lẫn `Transport`, chặn lộ `/internal/*`, xử lý CORS và gom Health/Swagger.
3. **[`03-bao-mat-identity-jwt-refresh-token-rbac-va-hmac.md`](./00-trong-tam-ky-thuat-vua-du-de-thuyet-trinh/03-bao-mat-identity-jwt-refresh-token-rbac-va-hmac.md)**
   - Cách áp dụng băm mật khẩu `Argon2id`, khóa tạm 15 phút, cấu trúc `JWT` (`sub, role, org, ver`), xoay vòng `Refresh Token` phát hiện đánh cắp (`FamilyId`), cô lập đa nhà xe qua claim `"org"` và ký `HMAC` bảo vệ vé QR / Webhook thanh toán.
4. **[`04-postgresql-6-db-xu-ly-dong-thoi-chong-trung-ghe-va-redis.md`](./00-trong-tam-ky-thuat-vua-du-de-thuyet-trinh/04-postgresql-6-db-xu-ly-dong-thoi-chong-trung-ghe-va-redis.md)**
   - Tách 6 DB riêng biệt với `Npgsql` + `JSONB Snapshot`; 3 kỹ thuật khóa thực chiến: `btree_gist` chống trùng lịch xe/tài xế, `SELECT ... FOR UPDATE` + `ORDER BY id` chống bán trùng ghế & chống Deadlock, `pg_advisory_xact_lock` chống đụng độ Webhook; và vai trò thực tế của **Redis (`ADR-008`)**.
5. **[`05-rabbitmq-outbox-inbox-va-luong-su-kien-lien-service.md`](./00-trong-tam-ky-thuat-vua-du-de-thuyet-trinh/05-rabbitmq-outbox-inbox-va-luong-su-kien-lien-service.md)**
   - Topology `Topic Exchange` + `DLQ` trên RabbitMQ, cách kết hợp **Transactional Outbox + Inbox** để không bao giờ mất hoặc xử lý trùng sự kiện, và 3 luồng phối hợp Saga giữa `Transport` – `Booking` – `Payment` – `Reporting`.
6. **[`06-frontend-3-portals-mobile-docker-va-kiem-thu-kien-truc.md`](./00-trong-tam-ky-thuat-vua-du-de-thuyet-trinh/06-frontend-3-portals-mobile-docker-va-kiem-thu-kien-truc.md)**
   - Cách tách 1 codebase React 19 thành 3 cổng (`Customer`, `Operator`, `Admin`), `Single-Flight Token Refresh`, lưu vé offline trên Mobile (`expo-secure-store`), Docker Compose + Cloudflare Tunnel cho SePay thật, và các tầng kiểm thử `Testcontainers`.

---

## CẤP ĐỘ 2 (THAM KHẢO KHI CẦN TRA CỨU SÂU): KHO TÀI LIỆU MỞ RỘNG (`THƯ MỤC 01 – 10`)

> Chỉ mở đến các thư mục dưới đây khi bạn cần xem chi tiết từng màn hình/bảng DB hoặc tra cứu nhanh vị trí file code:

- **Nhóm Kịch Bản Bảo Vệ & Tra Cứu Nhanh Vị Trí Code**:
  - [`09-roadmap-doc-hieu-va-kich-ban-thuyet-trinh/`](./09-roadmap-doc-hieu-va-kich-ban-thuyet-trinh/) — Lộ trình 7 chặng, kịch bản 18 slides thuyết trình + Live Demo 5 phút, và **30 câu hỏi phản biện hội đồng kèm đáp án**.
  - [`10-ban-do-cong-nghe-va-tra-cuu-source-code/`](./10-ban-do-cong-nghe-va-tra-cuu-source-code/) — Bản đồ công nghệ/thư viện đang dùng ở đâu, tóm tắt hàm chính của từng service, và **bảng tra nhanh 96 API Endpoints $\rightarrow$ File C# / SQL**.
- **Nhóm Kiến Trúc Chi Tiết Theo Chuyên Đề (`01 – 08`)**:
  - [`01-tong-quan-va-nghiep-vu/`](./01-tong-quan-va-nghiep-vu/) — Actors, quy tắc nghiệp vụ, 7 máy trạng thái, 18 ADRs.
  - [`02-kien-truc-clean-architecture-va-building-blocks/`](./02-kien-truc-clean-architecture-va-building-blocks/) — Phân tích Clean Architecture, Minimal APIs, `Result<T>` & `Idempotency-Key`.
  - [`03-api-gateway-va-yarp/`](./03-api-gateway-va-yarp/) — Phân tích toàn bộ 50+ routes của YARP Gateway.
  - [`04-security-identity-jwt-rbac/`](./04-security-identity-jwt-rbac/) — Phân tích Identity, JWT, RBAC & kiểm toán OWASP.
  - [`05-database-postgresql-concurrency-va-redis/`](./05-database-postgresql-concurrency-va-redis/) — Phân tích PostgreSQL Concurrency, GiST, Row Locks & Redis.
  - [`06-rabbitmq-outbox-inbox-va-saga/`](./06-rabbitmq-outbox-inbox-va-saga/) — Phân tích RabbitMQ, Outbox/Inbox & Saga Compensation.
  - [`07-microservices-nghiep-vu-chi-tiet/`](./07-microservices-nghiep-vu-chi-tiet/) — ERD và API chi tiết của từng Microservice trong 6 services.
  - [`08-frontend-mobile-contracts-docker-testing/`](./08-frontend-mobile-contracts-docker-testing/) — Chi tiết Web, Mobile, Contracts, Docker Hardening & Test Pyramid.
