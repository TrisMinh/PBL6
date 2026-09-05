# 3.6.8 FR/NFR/AC Coverage Register

Register này liệt kê từng requirement ID chính xác để CI/script phát hiện ID bị bỏ sót; range chỉ dùng trong văn bản giải thích, không dùng thay danh sách kiểm soát.

## Functional Requirements — 66/66

| Nhóm | Requirement IDs | Design/Test owner |
|---|---|---|
| Identity | `FR-IAM-001`, `FR-IAM-002`, `FR-IAM-003`, `FR-IAM-004`, `FR-IAM-005`, `FR-IAM-006`, `FR-IAM-007`, `FR-IAM-008`, `FR-IAM-009` | Identity API/Security; TS-AUTH/PROFILE/ADMIN-IAM |
| Search | `FR-SEARCH-001`, `FR-SEARCH-002`, `FR-SEARCH-003`, `FR-SEARCH-004`, `FR-SEARCH-005`, `FR-SEARCH-006`, `FR-SEARCH-007` | Transport API/DB; TS-SEARCH |
| Booking | `FR-BOOK-001`, `FR-BOOK-002`, `FR-BOOK-003`, `FR-BOOK-004`, `FR-BOOK-005`, `FR-BOOK-006`, `FR-BOOK-007`, `FR-BOOK-008`, `FR-BOOK-009`, `FR-BOOK-010`, `FR-BOOK-011` | Booking API/DB/Concurrency; TS-SEAT/BOOK/CANCEL/CHANGE |
| Payment | `FR-PAY-001`, `FR-PAY-002`, `FR-PAY-003`, `FR-PAY-004`, `FR-PAY-005`, `FR-PAY-006`, `FR-PAY-007`, `FR-PAY-008`, `FR-PAY-009`, `FR-PAY-010` | Payment API/DB/Recovery; TS-PAYMENT/CANCELLATION/ADMIN-TRACE |
| Ticket | `FR-TICKET-001`, `FR-TICKET-002`, `FR-TICKET-003`, `FR-TICKET-004`, `FR-TICKET-005`, `FR-TICKET-006` | Booking Ticket API/Security; TS-TICKET/CHECKIN |
| Operations | `FR-OPS-001`, `FR-OPS-002`, `FR-OPS-003`, `FR-OPS-004`, `FR-OPS-005`, `FR-OPS-006`, `FR-OPS-007`, `FR-OPS-008`, `FR-OPS-009`, `FR-OPS-010` | Transport/Booking; TS-OPS/TRIP |
| Promotion/Review/Notification | `FR-PROMO-001`, `FR-PROMO-002`, `FR-REVIEW-001`, `FR-REVIEW-002`, `FR-NOTIF-001`, `FR-NOTIF-002`, `FR-NOTIF-003` | Booking/Notification; TS-PROMOTION/REVIEW/NOTIFICATION |
| Admin/Reporting | `FR-ADMIN-001`, `FR-ADMIN-002`, `FR-ADMIN-003`, `FR-REPORT-001`, `FR-REPORT-002`, `FR-REPORT-003` | Identity/Booking/Reporting; TS-ADMIN/SUPPORT/REPORT |

## Non-functional Requirements — 58/58

| Nhóm | Requirement IDs | Verification suite |
|---|---|---|
| Performance | `NFR-PERF-001`, `NFR-PERF-002`, `NFR-PERF-003`, `NFR-PERF-004`, `NFR-PERF-005`, `NFR-PERF-006`, `NFR-PERF-007` | Performance + concurrency |
| Reliability | `NFR-REL-001`, `NFR-REL-002`, `NFR-REL-003`, `NFR-REL-004`, `NFR-REL-005`, `NFR-REL-006` | Availability/fault/restore/health |
| Consistency | `NFR-CONS-001`, `NFR-CONS-002`, `NFR-CONS-003`, `NFR-CONS-004`, `NFR-CONS-005`, `NFR-CONS-006` | Idempotency/redelivery/saga/reconcile |
| Scale | `NFR-SCALE-001`, `NFR-SCALE-002`, `NFR-SCALE-003`, `NFR-SCALE-004` | Horizontal scale and multi-consumer |
| Security | `NFR-SEC-001`, `NFR-SEC-002`, `NFR-SEC-003`, `NFR-SEC-004`, `NFR-SEC-005`, `NFR-SEC-006`, `NFR-SEC-007`, `NFR-SEC-008`, `NFR-SEC-009`, `NFR-SEC-010`, `NFR-SEC-011`, `NFR-SEC-012` | Security/privacy suite + CI scan |
| Privacy | `NFR-PRIV-001`, `NFR-PRIV-002`, `NFR-PRIV-003`, `NFR-PRIV-004`, `NFR-PRIV-005` | Data minimization/manifest/export/retention |
| Observability | `NFR-OBS-001`, `NFR-OBS-002`, `NFR-OBS-003`, `NFR-OBS-004`, `NFR-OBS-005`, `NFR-OBS-006` | Log/metric/trace/alert/audit assertions |
| UX/accessibility | `NFR-UX-001`, `NFR-UX-002`, `NFR-UX-003`, `NFR-UX-004`, `NFR-UX-005`, `NFR-UX-006` | Browser/mobile/accessibility/localization |
| Maintainability | `NFR-MAIN-001`, `NFR-MAIN-002`, `NFR-MAIN-003`, `NFR-MAIN-004`, `NFR-MAIN-005`, `NFR-MAIN-006` | Pipeline/contract/migration/rollback review |

## Acceptance Criteria — 68/68

| Nhóm | Acceptance IDs |
|---|---|
| Authentication/Profile | `AC-AUTH-001`, `AC-AUTH-002`, `AC-AUTH-003`, `AC-AUTH-004`, `AC-AUTH-005`, `AC-AUTH-006`, `AC-AUTH-007`, `AC-AUTH-008`, `AC-AUTH-009`, `AC-PROFILE-001` |
| Search/Seat/Booking | `AC-SEARCH-001`, `AC-SEARCH-002`, `AC-SEARCH-003`, `AC-SEAT-001`, `AC-SEAT-002`, `AC-SEAT-003`, `AC-BOOK-001`, `AC-BOOK-002`, `AC-BOOK-003`, `AC-BOOK-004`, `AC-BOOK-005` |
| Payment/Ticket/Cancel/Change | `AC-PAY-001`, `AC-PAY-002`, `AC-PAY-003`, `AC-PAY-004`, `AC-PAY-005`, `AC-PAY-006`, `AC-TICKET-001`, `AC-TICKET-002`, `AC-TICKET-003`, `AC-TICKET-004`, `AC-TICKET-005`, `AC-CANCEL-001`, `AC-CANCEL-002`, `AC-CANCEL-003`, `AC-CANCEL-004`, `AC-CHANGE-001`, `AC-CHANGE-002` |
| Operations/Trip | `AC-OPS-001`, `AC-OPS-002`, `AC-OPS-003`, `AC-OPS-004`, `AC-OPS-005`, `AC-OPS-006`, `AC-TRIP-001`, `AC-TRIP-002` |
| Promotion/Review/Notification | `AC-PROMO-001`, `AC-PROMO-002`, `AC-REVIEW-001`, `AC-REVIEW-002`, `AC-REVIEW-003`, `AC-NOTIF-001`, `AC-NOTIF-002` |
| Admin/Reporting | `AC-ADMIN-001`, `AC-ADMIN-002`, `AC-ADMIN-003`, `AC-ADMIN-004`, `AC-REPORT-001`, `AC-REPORT-002`, `AC-REPORT-003` |
| System quality | `AC-NFR-001`, `AC-NFR-002`, `AC-NFR-003`, `AC-SEC-001`, `AC-SEC-002`, `AC-UX-001`, `AC-UX-002`, `AC-OBS-001` |

Automation status và latest run ID sẽ được bổ sung khi repository có code/pipeline; requirement ID không được xóa khỏi register khi test chưa triển khai.

