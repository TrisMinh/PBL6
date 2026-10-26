# 04 — Hạ tầng, database và messaging

## 1. Tạo cấu trúc

```text
workspace/src/infra/
├─ docker-compose.yml
├─ docker-compose.apps.yml
├─ README.md
├─ docker/
│  ├─ api.Dockerfile
│  ├─ web.Dockerfile
│  ├─ web-package.json
│  └─ nginx-web.conf
├─ payment-simulator/
│  ├─ Dockerfile
│  └─ simulator.py
├─ postgres/
│  ├─ bootstrap.sh
│  └─ init/00-create-databases.sql
└─ rabbitmq/
   ├─ definitions.json
   └─ rabbitmq.conf
```

## 2. Compose nền tảng

Trong `docker-compose.yml`, khai báo:

| Container | Image/chức năng | Port |
|---|---|---:|
| `postgres` | dữ liệu cho sáu logical database | 5432 |
| `rabbitmq` | message broker + management | 5672, 15672 |
| `redis` | cache/seat hold | 6379 |
| `mailpit` | SMTP giả và hộp thư web | 1025, 8025 |
| `payment-simulator` | giả lập VNPay callback | 8099 |
| `db-bootstrap` | áp SQL baseline một lần | không expose |

Mỗi service có database riêng:

```sql
CREATE DATABASE identity;
CREATE DATABASE transport;
CREATE DATABASE booking;
CREATE DATABASE payment;
CREATE DATABASE notification;
CREATE DATABASE reporting;
```

Không cho service A query trực tiếp database service B. Dữ liệu liên service đi qua API hoặc event.

## 3. SQL baseline

Từ root repository, tạo:

```text
docs/database/
├─ _shared/000_integration_tables.sql
├─ identity/001_initial.sql
├─ transport/001_initial.sql
├─ booking/001_initial.sql
├─ payment/001_initial.sql
├─ notification/001_initial.sql
└─ reporting/001_initial.sql
```

`000_integration_tables.sql` chứa bảng kỹ thuật dùng chung theo từng database:

- `schema_migrations`: file nào đã được áp;
- `outbox_messages`: event chờ publish;
- `inbox_messages`: event đã xử lý;
- `idempotency_records`: kết quả request có key chống lặp.

`001_initial.sql` chỉ chứa bảng thuộc bounded context đó. Ví dụ booking chứa booking/seat hold/ticket, không chứa bảng user đầy đủ.

Sau baseline, thêm seed development:

- `identity/010_synthetic_seed.sql`
- `identity/011_dev_login_seed.sql`
- `transport/010_synthetic_seed.sql`
- `transport/011_more_seed_seats.sql`
- `transport/012_seed_driver.sql`
- `transport/013_seed_amenities.sql`
- `booking/010_synthetic_seed.sql`
- `booking/012_rebook_after_cancel.sql`
- `booking/013_more_seed_seats.sql`
- `reporting/011_seed_occupancy.sql`

Seed phải idempotent: chạy lại không tạo bản ghi trùng. Dùng `ON CONFLICT` và bảng `schema_migrations`.

## 4. RabbitMQ

`rabbitmq/definitions.json` tạo sẵn vhost `bus-ticket`, exchange, queue và binding. Tên event/routing key phải khớp AsyncAPI trong `docs/contracts/asyncapi`.

Quy tắc:

- exchange kiểu topic;
- queue đặt theo consumer, không theo publisher;
- message có version;
- handler phải idempotent;
- không đưa password/token/PII không cần thiết vào payload.

## 5. Dockerfile

`api.Dockerfile` dùng multi-stage:

1. SDK image restore/build/publish;
2. ASP.NET runtime image chạy output;
3. nhận path project qua build argument nếu dùng chung cho nhiều API;
4. chạy bằng user không đặc quyền nếu môi trường cho phép.

`web.Dockerfile`:

1. Node image cài package và build Vite;
2. Nginx image phục vụ `dist`;
3. `nginx-web.conf` fallback về `index.html` cho client-side routing.

## 6. Kiểm tra compose trước khi chạy

```powershell
Set-Location workspace/src/infra
docker compose config
docker compose up -d --wait
docker compose ps
```

Kiểm tra dịch vụ:

```powershell
docker compose logs db-bootstrap
docker compose logs rabbitmq
Invoke-WebRequest http://localhost:8025
Invoke-WebRequest http://localhost:8099/health
```

Tắt nhưng giữ data:

```powershell
docker compose down
```

Reset toàn bộ data local:

```powershell
docker compose down -v
```

Lệnh `down -v` xóa volume và dữ liệu local, chỉ dùng khi chủ động reset.

## Checkpoint 04

`docker compose ps` phải báo healthy/running; PostgreSQL có đủ sáu database và RabbitMQ management mở được ở `http://localhost:15672`.
