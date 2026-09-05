# 2.1 System Architecture

Kiến trúc cho nền tảng đặt vé xe khách trực tuyến dùng chung backend cho Web khách hàng, Mobile App và Back-office Web. Baseline là Microservices theo bounded context, REST/HTTPS cho tương tác cần phản hồi tức thời và RabbitMQ cho integration event hoặc command bất đồng bộ.

## Mục lục

| Mục | Nội dung | Câu hỏi được trả lời |
|---|---|---|
| [2.1.1](./02-01-01-architecture-goals.md) | Architecture Goals | Kiến trúc phải tối ưu điều gì và không nhằm giải quyết điều gì? |
| [2.1.2](./02-01-02-architecture-overview.md) | Architecture Overview | Các khối chính và luồng đầu-cuối là gì? |
| [2.1.3](./02-01-03-components.md) | Components | Mỗi thành phần chịu trách nhiệm gì? |
| [2.1.4](./02-01-04-microservices-architecture.md) | Microservices Architecture | Ranh giới, dữ liệu và giao diện của từng service là gì? |
| [2.1.5](./02-01-05-service-communication.md) | Service Communication | Khi nào dùng REST, khi nào dùng message? |
| [2.1.6](./02-01-06-message-broker.md) | Message Broker | RabbitMQ được tổ chức, retry và vận hành ra sao? |
| [2.1.7](./02-01-07-database-architecture.md) | Database Architecture | Dữ liệu được sở hữu và đồng bộ thế nào? |
| [2.1.8](./02-01-08-security-architecture.md) | Security Architecture | Authentication, authorization và bảo vệ dữ liệu ra sao? |
| [2.1.9](./02-01-09-deployment-architecture.md) | Deployment Architecture | Hệ thống chạy ở local và production-like như thế nào? |
| [2.1.10](./02-01-10-external-systems.md) | External Systems | Tích hợp ngoài, timeout và failure mode là gì? |
| [2.1.11](./02-01-11-technology-stack.md) | Technology Stack | Công nghệ baseline và trạng thái lựa chọn là gì? |
| [2.1.12](./02-01-12-architecture-decisions.md) | Architecture Decisions | Vì sao chọn kiến trúc này và hệ quả là gì? |

## Baseline tóm tắt

- Sáu business service: Identity, Transport, Booking, Payment, Notification và Reporting.
- API Gateway là public entry point; Gateway không chứa business rule.
- Mỗi service sở hữu logical database, migration và credential riêng.
- RabbitMQ là message broker duy nhất trong baseline; delivery semantic là at-least-once.
- Transactional outbox ở producer và inbox/deduplication ở consumer là bắt buộc cho event quan trọng.
- Không dùng distributed database transaction; luồng liên service dùng saga và compensation.
- Redis chỉ hỗ trợ cache/TTL; PostgreSQL của service vẫn là nguồn sự thật.
- Correlation ID và trace context đi xuyên Gateway, REST và message.

## Nguồn yêu cầu

- [Ràng buộc kiến trúc dịch vụ](../../srs/architecture/service-architecture-constraints.md)
- [Giao diện dịch vụ](../../srs/architecture/service-interfaces.md)
- [Ngoại lệ và phục hồi](../../srs/architecture/exceptions-and-recovery.md)
- [Yêu cầu chất lượng](../../srs/requirements/quality-requirements.md)
- [Yêu cầu dữ liệu](../../srs/requirements/data-requirements.md)

Khi tài liệu này và SRS mâu thuẫn về hành vi sản phẩm, SRS thắng. Khi mâu thuẫn về cách triển khai, Architecture Decision mới nhất thắng.
