# Diagram

Nguồn yêu cầu chính thức được tổ chức trong [Software Requirements Specification](../srs/v1/README.md). Bộ sơ đồ dùng cho thiết kế và triển khai được viết bằng Mermaid trong [System Design](../system-design/README.md) để có thể review trực tiếp cùng tài liệu.

Thư mục này chỉ giữ đặc tả đầu vào và một số nguồn/hình tham chiếu không trùng với bộ System Design:

- [Đặc tả đầu vào cho sơ đồ](./specifications/diagram-specifications.md): nội dung, nguồn yêu cầu và ký pháp cho từng loại diagram.
- [System Context — mã nguồn Mermaid](./subdiagrams/overview/system-context-mermaid.mmd), kèm bản [SVG](./subdiagrams/overview/system-context-mermaid.svg) và [PNG](./subdiagrams/overview/system-context-mermaid.png).
- [Use Case đặt vé — mã nguồn PlantUML](./subdiagrams/use-cases/use-cases-booking.puml), kèm bản [PNG](./subdiagrams/use-cases/use-cases-booking.png).

Các bản HTML sinh tự động và ảnh QA render không được lưu trong repository.

## Ký pháp áp dụng theo loại diagram

| Loại | Ngôn ngữ hình học |
|---|---|
| System Context | C4 Person, Container, Software System và External System |
| Use Case | UML actor, system boundary, ellipse, association, `«include»`, `«extend»` |
| Activity | Initial/final node, action bo góc, decision hình thoi, guard và swimlane |
| Robustness | Boundary–Control–Entity icon; bắt buộc Actor → Boundary → Control → Entity |
| Sequence | Lifeline, activation, sync/async/return message và combined fragment `alt/par` |
| State Machine | Initial/final pseudostate, state và transition `event [guard] / action` |
| Domain Model | UML class, stereotype, attribute, operation, association/composition và multiplicity |
| ERD | Table, PK/FK/UK, tên vật lý dạng `snake_case` và cardinality ở hai đầu quan hệ |
| Microservices | C4/Component, service responsibility, database ownership, REST và event boundary |
| Event Flow | Transactional Outbox, event envelope, broker, Inbox/dedup, retry và DLQ |
| Deployment | UML node/device/execution environment/container, managed store và protocol |
