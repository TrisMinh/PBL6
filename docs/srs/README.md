# Software Requirements Specification

Tài liệu đặc tả cho nền tảng đặt vé xe khách trực tuyến dùng chung backend cho Web khách hàng, Mobile App và Back-office Web. Hệ thống áp dụng kiến trúc Microservices; mỗi service chịu trách nhiệm cho một miền nghiệp vụ và cung cấp khả năng qua API hoặc sự kiện.

SRS tập trung trả lời: hệ thống phục vụ ai, phải làm gì, tuân theo quy tắc nào, xử lý thành công/thất bại ra sao và được nghiệm thu bằng tiêu chí nào. Chi tiết triển khai chỉ được đưa vào khi nó là một ràng buộc cần thiết của sản phẩm.

## Cấu trúc tài liệu

```text
srs/
├── README.md
├── overview/
│   ├── product-overview.md
│   ├── system-scope-and-context.md
│   └── actors-and-permissions.md
├── business/
│   ├── business-processes.md
│   ├── business-rules.md
│   └── use-cases/
│       ├── README.md
│       ├── identity-and-access.md
│       ├── journey-search-and-booking.md
│       ├── payment-cancellation-and-change.md
│       ├── trip-operations.md
│       └── administration-and-reporting.md
├── requirements/
│   ├── functional-requirements.md
│   ├── state-requirements.md
│   ├── data-requirements.md
│   ├── user-interface-requirements.md
│   └── quality-requirements.md
├── architecture/
│   ├── service-architecture-constraints.md
│   ├── service-interfaces.md
│   └── exceptions-and-recovery.md
└── verification/
    └── acceptance-and-traceability.md
```

Tên thư mục thể hiện tầng nội dung; tên file thể hiện chủ đề. Số thứ tự không được dùng trong tên file để tránh phải đổi hàng loạt khi thêm, tách hoặc sắp xếp lại tài liệu.

## Thứ tự đọc từ tổng quan đến chi tiết

### Hiểu sản phẩm và ranh giới

- [Tổng quan sản phẩm](./overview/product-overview.md): bài toán, mục tiêu, kênh sử dụng và phạm vi ưu tiên.
- [Phạm vi và bối cảnh hệ thống](./overview/system-scope-and-context.md): ranh giới hệ thống, hệ thống ngoài, giả định và thuật ngữ.
- [Actor và phân quyền](./overview/actors-and-permissions.md): vai trò, trách nhiệm và phạm vi dữ liệu.

### Hiểu nghiệp vụ

- [Quy trình nghiệp vụ](./business/business-processes.md): các luồng đầu-cuối ở mức dễ đọc.
- [Quy tắc nghiệp vụ](./business/business-rules.md): điều kiện bắt buộc, bất biến và chính sách.
- [Danh mục Use Case](./business/use-cases/README.md): luồng tương tác chi tiết theo mục tiêu của actor.

### Hiểu yêu cầu hệ thống

- [Yêu cầu chức năng](./requirements/functional-requirements.md): hành vi quan sát được và mức ưu tiên.
- [Yêu cầu trạng thái](./requirements/state-requirements.md): vòng đời và chuyển trạng thái hợp lệ.
- [Yêu cầu dữ liệu](./requirements/data-requirements.md): thực thể, quyền sở hữu và dữ liệu nhạy cảm.
- [Yêu cầu giao diện](./requirements/user-interface-requirements.md): màn hình, khả dụng, responsive và accessibility.
- [Yêu cầu chất lượng](./requirements/quality-requirements.md): hiệu năng, bảo mật, độ tin cậy, mở rộng và vận hành.

### Hiểu ràng buộc kỹ thuật

- [Ràng buộc kiến trúc dịch vụ](./architecture/service-architecture-constraints.md): ranh giới Microservices và nguyên tắc tích hợp.
- [Giao diện dịch vụ](./architecture/service-interfaces.md): API, error contract và event contract cần cung cấp.
- [Ngoại lệ và phục hồi](./architecture/exceptions-and-recovery.md): lỗi liên service, retry, bù trừ và xử lý thủ công.

### Nghiệm thu và trực quan hóa

- [Tiêu chí chấp nhận và truy vết](./verification/acceptance-and-traceability.md): liên kết requirement → rule → use case → test.
- [Đặc tả đầu vào cho sơ đồ](../diagrams/specifications/diagram-specifications.md): nội dung chuẩn để xây dựng từng loại diagram; được đặt ngoài SRS vì đây là tài liệu hỗ trợ thiết kế.
- [Thư viện diagram](../diagrams/README.md): các diagram đã được sinh và kiểm tra trực quan.

## Cách dùng theo công việc

| Công việc | Tài liệu nên dùng |
|---|---|
| Phân tích sản phẩm | `overview` → `business` |
| Thiết kế Web/Mobile | `overview/actors-and-permissions` → `business/use-cases` → `requirements/user-interface-requirements` |
| Thiết kế backend | `requirements` → `architecture/service-architecture-constraints` → `architecture/service-interfaces` |
| Thiết kế database | `requirements/data-requirements` → `requirements/state-requirements` → Business Rules liên quan |
| Vẽ diagram | `docs/diagrams/specifications/diagram-specifications` và tài liệu nguồn được liên kết trong từng diagram |
| Viết test | `business/use-cases` → `requirements/quality-requirements` → `verification` |

## Quy ước yêu cầu

- **MUST:** bắt buộc để nghiệm thu phạm vi cốt lõi.
- **SHOULD:** cần có nhưng có thể lùi khi có quyết định phạm vi rõ ràng.
- **COULD:** hướng mở rộng, không phải điều kiện nghiệm thu cốt lõi.
- Mỗi yêu cầu, quy tắc, Use Case, event và tiêu chí chấp nhận giữ một ID ổn định như `FR-*`, `BR-*`, `UC-*`, `EVT-*`, `AC-*`.
- Số thứ tự hiển thị của mục hoặc vị trí file không phải định danh và không được dùng để tham chiếu.

## Quy tắc duy trì

- Thay đổi hành vi phải cập nhật Functional Requirement và Business Rule trước.
- Thay đổi luồng phải cập nhật Use Case, trạng thái liên quan và nhánh lỗi.
- Thay đổi contract phải cập nhật Service Interface và khả năng tương thích.
- Thay đổi chỉ hoàn tất khi Acceptance Criteria và ma trận truy vết đã được cập nhật.
- Diagram là bản diễn giải trực quan; khi có mâu thuẫn, ID yêu cầu và văn bản SRS là nguồn quyết định.
