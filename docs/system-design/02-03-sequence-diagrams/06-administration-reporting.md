# 2.3.6 Quản trị và báo cáo

Nguồn nghiệp vụ: [SRS — Quản trị và báo cáo](../../srs-v2/04-use-cases/06-administration-reporting.md).

## UC-ADMIN-01 — Quản lý User, Organization và quyền

```mermaid
sequenceDiagram
    autonumber
    actor A as Admin
    participant BO as Back-office Web
    participant GW as API Gateway
    participant ID as Identity Service
    participant DB as Identity DB
    participant MQ as RabbitMQ

    alt Quản lý Organization
        A->>BO: Tạo/cập nhật/khóa Organization
        BO->>GW: Organization command
        GW->>ID: Admin claims + command
        ID->>DB: Check privilege, uniqueness và impact
    else Quản lý User, role và membership
        A->>BO: Khóa User hoặc thay role/membership
        BO->>GW: User authorization command
        GW->>ID: Admin claims + command
        ID->>DB: Check escalation, tenant rule và last-admin guard
    end
    alt Không đủ quyền, conflict hoặc phá guard
        ID-->>BO: Từ chối, authorization state giữ nguyên
    else Hợp lệ
        ID->>DB: Persist change + audit, revoke sessions nếu cần + Outbox
        ID->>MQ: IdentityAuthorizationChanged
        ID-->>BO: Kết quả và version mới
    end
```

## UC-ADMIN-02 — Tra cứu giao dịch và audit

```mermaid
sequenceDiagram
    autonumber
    actor A as Admin/Operator Finance
    participant BO as Back-office Web
    participant GW as API Gateway
    participant REP as Reporting Service
    participant RDB as Reporting DB
    participant MQ as RabbitMQ
    participant PAY as Payment Service

    A->>BO: Nhập Booking/Ticket/Payment/Refund/correlation ID
    BO->>GW: Search transaction trail
    GW->>REP: Actor + tenant scope + search key
    REP->>RDB: Query linked projections và audit references
    alt Không tìm thấy trong scope
        REP-->>BO: Kết quả chung, không lộ tenant khác
    else Tìm thấy
        REP-->>BO: Timeline + status + dataAsOf + discrepancies
        opt Cần đối soát và actor có quyền
            A->>BO: Yêu cầu reconciliation + reason
            BO->>GW: Create reconciliation job
            GW->>REP: Audited command
            REP->>MQ: ReconciliationRequested
            MQ-->>PAY: Query provider và đối soát
            PAY->>MQ: ReconciliationCompleted/Failed
            MQ-->>REP: Cập nhật projection/case
            REP-->>BO: Job status
        end
    end
```

## UC-ADMIN-03 — Quản lý khiếu nại

```mermaid
sequenceDiagram
    autonumber
    actor S as Admin/Support Staff
    participant BO as Back-office Web
    participant GW as API Gateway
    participant ADM as Booking Support Capability
    participant DB as Booking DB / SupportCase
    participant REP as Reporting Service

    S->>BO: Tạo/mở khiếu nại
    BO->>GW: Complaint command/query
    GW->>ADM: Actor permission + tenant scope
    ADM->>DB: Load case và access policy
    opt Có Booking/Ticket/Payment liên quan
        ADM->>REP: Resolve reference trong đúng scope
        REP-->>ADM: Safe transaction summary
    end
    ADM-->>BO: Case đã mask dữ liệu nhạy cảm
    S->>BO: Phân loại, ưu tiên, owner và state
    BO->>GW: Update complaint + expected version
    GW->>ADM: Update command
    ADM->>DB: Validate transition, scope và evidence
    alt Ngoài scope, transition sai hoặc đóng thiếu resolution
        ADM-->>BO: Từ chối, lịch sử giữ nguyên
    else Hợp lệ
        ADM->>DB: Append history + update state + audit
        ADM-->>BO: Complaint version mới
    end
```

Theo `ADR-014`, Booking Service là owner baseline của SupportCase liên quan giao dịch; nếu capability hỗ trợ phát triển độc lập sẽ có ADR migration/tách service riêng.

## UC-REPORT-01 — Xem và xuất báo cáo

```mermaid
sequenceDiagram
    autonumber
    actor A as Admin/Operator Finance
    participant BO as Back-office Web
    participant GW as API Gateway
    participant REP as Reporting Service
    participant DB as Reporting DB
    participant OBJ as Object Storage
    participant MQ as RabbitMQ
    participant N as Notification Service

    alt Xem báo cáo online
        A->>BO: Chọn thời gian, timezone và bộ lọc
        BO->>GW: Get report
        GW->>REP: Actor + tenant scope + filters
        REP->>DB: Query read projection
        alt Filter sai hoặc ngoài scope
            REP-->>BO: Validation/forbidden
        else Hợp lệ
            REP-->>BO: Metrics + definitions + dataAsOf
        end
    else Xuất báo cáo
        A->>BO: Yêu cầu CSV với cùng bộ lọc
        BO->>GW: Create Export Job
        GW->>REP: Actor scope + export command
        REP->>DB: Persist ExportJob=PENDING + audit
        REP-->>BO: Job ID
        REP->>DB: Worker claim job và query projection
        REP->>OBJ: Write private file + checksum/expiry
        alt Export thất bại
            REP->>DB: ExportJob=FAILED + safe reason
        else Export thành công
            REP->>DB: ExportJob=SUCCEEDED + object key
            REP->>MQ: ExportReady
            MQ-->>N: Thông báo file sẵn sàng
            A->>BO: Yêu cầu tải file
            BO->>GW: Get download link
            GW->>REP: Recheck current permission
            REP-->>BO: Short-lived signed URL + audit
        end
    end
```
