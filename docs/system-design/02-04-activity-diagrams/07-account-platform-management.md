# BP-07 — Quản lý tài khoản, nhà xe và nền tảng

Nguồn: `BP-07`, nhóm `UC-AUTH-*`, `UC-PROFILE-01`, `UC-OPS-01..04`, `UC-PROMO-01`, `UC-REVIEW-02`, `UC-NOTIF-01`, `UC-ADMIN-*`, `UC-REPORT-01`.

BP-07 gồm các luồng quản lý độc lập, vì vậy decision đầu tiên chọn mục tiêu thay vì ngụ ý chúng diễn ra tuần tự.

```mermaid
flowchart TB
    START((Bắt đầu)) --> D0{"Mục tiêu quản lý"}
    D0 -- Tài khoản --> A1["Guest/User: đăng ký, xác minh, đăng nhập, reset hoặc cập nhật hồ sơ"]
    A1 --> A2["Identity Service: validation, rate limit, OTP/token expiry và session rotation"]
    A2 --> D1{"Hợp lệ?"}
    D1 -- Không --> N1["Không tạo quyền/phiên; trả lỗi an toàn và audit phù hợp"] --> END((Kết thúc))
    D1 -- Có --> A3["Persist User/Session; thu hồi phiên khi thay đổi nhạy cảm"] --> END

    D0 -- Dữ liệu nhà xe --> B1["Operator Staff: quản lý Organization, Bus, Seat, Driver, Route hoặc Stop"]
    B1 --> B2["Transport Service: kiểm tra permission, tenant và expected version"]
    B2 --> D2{"Được phép và không bị tham chiếu/xung đột?"}
    D2 -- Không --> N2["Từ chối hoặc yêu cầu reload; không hard delete lịch sử"] --> END
    D2 -- Có --> B3["Persist thay đổi, soft-delete/deactivate khi cần và ghi audit"] --> END

    D0 -- Quản trị nền tảng --> C1["Admin: quản lý Organization, User, role, membership, review/khiếu nại"]
    C1 --> C2["Service owner: kiểm tra platform permission, reason và target scope"]
    C2 --> D3{"Action hợp lệ?"}
    D3 -- Không --> N3["Từ chối và không lộ tenant khác"] --> END
    D3 -- Có --> C3["Commit thay đổi; audit append-only; revoke session nếu cần"] --> END

    D0 -- Báo cáo/export --> E1["Admin/Operator Finance: chọn scope, filter và metric"]
    E1 --> E2["Reporting Service: kiểm tra quyền và đọc projection kèm dataAsOf"]
    E2 --> D4{"Export lớn?"}
    D4 -- Không --> E3["Trả báo cáo phân trang"] --> END
    D4 -- Có --> E4["Tạo ExportJob bất đồng bộ và file có expiry"]
    E4 --> E5["Kiểm tra lại quyền và audit khi tải"] --> END
```

## Điểm kiểm soát

- Tenant lấy từ identity context, không lấy body/query làm nguồn quyền.
- Entity đã được tham chiếu dùng deactivate/soft delete thay vì hard delete.
- Reporting projection công bố `dataAsOf`; export chứa PII có expiry và audit download.

