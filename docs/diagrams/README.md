# Diagram

Nguồn yêu cầu chính thức được tổ chức trong [Software Requirements Specification](../srs/README.md). Footer của từng diagram dùng tên tài liệu và requirement ID thay vì số thứ tự file để liên kết không bị lỗi khi SRS được sắp xếp lại.

- [Online Bus Ticket Platform — Super Diagram](./bus-ticket-platform-super-diagram.html): bản đồ tổng hợp một canvas từ nghiệp vụ đến kiến trúc, trạng thái và dữ liệu.
- [Bộ diagram con](./subdiagrams/index.html): 38 diagram độc lập, đi từ System Context đến Use Case, Activity, Robustness, Sequence, State, Domain Model, ERD, Microservices, Event Flow và Deployment.
- [Đặc tả đầu vào cho sơ đồ](./specifications/diagram-specifications.md): quy định nội dung, nguồn yêu cầu và ký pháp cần dùng cho từng loại diagram.

## Cấu trúc bộ diagram con

```text
subdiagrams/
├── overview/        Tổng quan bối cảnh hệ thống
├── use-cases/       Chức năng theo actor
├── processes/       Quy trình nghiệp vụ xuyên actor
├── robustness/      Boundary – Control – Entity
├── sequences/       Tương tác theo thời gian
├── states/          Vòng đời trạng thái
├── domain-models/   Mô hình miền
├── data-models/     ERD theo service sở hữu dữ liệu
├── architecture/    Kiến trúc microservice
├── events/          Luồng sự kiện bất đồng bộ
└── deployment/      Topology local/demo và production
```

Nguồn sinh toàn bộ diagram con: [`subdiagrams/generate-subdiagrams.js`](./subdiagrams/generate-subdiagrams.js). Chỉnh nội dung trong nguồn này rồi chạy `node docs/diagrams/subdiagrams/generate-subdiagrams.js`; không sửa trực tiếp các HTML được sinh ra.

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
