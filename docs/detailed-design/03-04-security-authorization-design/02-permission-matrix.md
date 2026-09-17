# 3.4.2 Permission Matrix

Permission code có dạng `<scope>.<resource>.<action>`. `platform.*` áp toàn nền tảng; `tenant.*` luôn yêu cầu active OrganizationMembership tương ứng.

## Actor capability

| Resource/action | Guest | Customer | Driver | Operator Staff | Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| Register/login/reset | ✓ | ✓ | ✓ | ✓ | ✓ |
| Search/view public Trip/review | ✓ | ✓ | ✓ | ✓ | ✓ |
| Profile/session | — | Own | Own | Own | Own |
| SeatHold/Booking/Payment | — | Own | — | Scoped read only | Scoped support/read |
| Ticket/QR/cancel/change/review | — | Own | Validate/check-in assigned Trip | Scoped operations/moderation | Scoped support/moderation |
| Manifest | — | — | Assigned Trip | Tenant + permission | Platform support only when justified |
| Organization/Bus/Driver/Route | — | — | Assignment read | Tenant + resource permission | Platform organization management |
| Trip create/publish/operate/cancel | — | — | Assigned transition permission | Tenant + permission | Platform override where approved |
| Payment/Refund intervention | — | Own status only | — | Finance read in tenant (settlement) | Explicit finance/reconcile/payout permission |
| User/role/membership | — | — | — | Limited tenant membership if approved | Platform permission |
| Report/export | — | — | — | Tenant finance/report permission | Platform/scoped report permission |
| Audit/support case | — | — | — | Tenant support permission | Platform support/audit permission |

## Permission catalog

Mỗi code dưới đây là một permission nguyên tử; ký hiệu kiểu `read/manage` không được dùng trong token hoặc policy.

| Capability | Permission codes |
|---|---|
| Tenant organization/fleet | `tenant.organization.manage`, `tenant.bus.read`, `tenant.bus.manage`, `tenant.driver.read`, `tenant.driver.manage` |
| Tenant schedule | `tenant.route.read`, `tenant.route.manage`, `tenant.trip.read`, `tenant.trip.manage`, `tenant.trip.publish`, `tenant.trip.operate`, `tenant.trip.cancel` |
| Booking operations | `tenant.booking.read`, `tenant.manifest.read`, `tenant.ticket.validate`, `tenant.ticket.checkin` |
| Content/support | `tenant.promotion.read`, `tenant.promotion.manage`, `tenant.review.moderate`, `tenant.support.read`, `tenant.support.manage` |
| Tenant finance | `tenant.payment.read` (kèm list settlement tenant), `tenant.refund.read`, `tenant.refund.request` |
| Report | `report.revenue.read`, `report.revenue.export`, `report.booking.read`, `report.booking.export`, `report.occupancy.read`, `report.occupancy.export` |
| Platform identity/organization | `platform.organization.read`, `platform.organization.manage`, `platform.user.read`, `platform.user.manage`, `platform.role.manage`, `platform.membership.read`, `platform.membership.manage` |
| Platform content/support | `platform.review.moderate`, `platform.support.read`, `platform.support.manage` |
| Platform finance | `platform.payment.read`, `platform.payment.manage` (kèm payout), `platform.refund.read`, `platform.refund.request`, `platform.payment.reconcile` |
| Platform security/operations | `platform.audit.read`, `platform.dlq.replay` |

## Separation of duties

- Payment/Refund manual intervention không tự động đi kèm user management.
- DLQ replay, secret management và deployment không mặc định thuộc business Admin.
- Role change không cho actor tự nâng quyền hoặc loại bỏ last active platform admin.
- Operator Finance không có fleet/trip mutation nếu chưa được cấp riêng.
- Permission check luôn kết hợp resource tenant/ownership; role name đơn lẻ không đủ.

## Default role profiles cho MVP

Đây là seed baseline. Role có thể được quản trị sau này nhưng không được tự động mở rộng quyền khi thêm permission mới; permission mới phải được gán tường minh bằng migration/administrative decision.

| Role code | Scope | Permission baseline |
|---|---|---|
| `CUSTOMER` | Own resources | Không dùng tenant/platform permission; policy ownership cho profile, Booking, Payment, Ticket, cancellation và Notification của chính User |
| `DRIVER` | Tenant + active assignment | `tenant.trip.read`, `tenant.manifest.read`, `tenant.ticket.validate`, `tenant.ticket.checkin`, `tenant.trip.operate` |
| `OPERATOR_ADMIN` | Tenant | Toàn bộ `tenant.*` và `report.*` ngoại trừ quyền chỉ dành platform; vẫn cần resource tenant check |
| `OPERATOR_SCHEDULER` | Tenant | `tenant.bus.read/manage`, `tenant.driver.read/manage`, `tenant.route.read/manage`, `tenant.trip.read/manage/publish` |
| `OPERATOR_OPERATIONS` | Tenant | `tenant.trip.read/operate/cancel`, `tenant.booking.read`, `tenant.manifest.read`, `tenant.ticket.validate/checkin` |
| `OPERATOR_FINANCE` | Tenant | `tenant.payment.read`, `tenant.refund.read/request`, toàn bộ `report.*.read`; export permission chưa cấp trong MVP |
| `PLATFORM_ADMIN` | Platform | `platform.organization.read/manage`, `platform.user.read/manage`, `platform.role.manage`, `platform.membership.read/manage`, `platform.audit.read` |
| `PLATFORM_SUPPORT` | Platform | `platform.support.read/manage`, `platform.payment.read`, `platform.refund.read`, `platform.audit.read` |
| `PLATFORM_FINANCE` | Platform | `platform.payment.read/manage/reconcile`, `platform.refund.read/request`, các `report.*.read` |
| `PLATFORM_AUDITOR` | Platform read-only | `platform.audit.read`, `platform.organization.read`, `platform.user.read`, `platform.payment.read`, `platform.refund.read`, các `report.*.read` |

Quy ước `tenant.bus.read/manage` trong bảng chỉ là cách viết gọn hai code `tenant.bus.read` và `tenant.bus.manage`; token luôn chứa permission nguyên tử đầy đủ. `OPERATOR_ADMIN` không có platform permission, DLQ replay, secret hoặc deployment permission.

## Bootstrap và thay đổi quyền

- Migration seed permission catalog và role profile bằng code ổn định; không seed user/password production.
- Local development tạo tài khoản demo qua seed riêng, credential lấy từ local secret/config không commit.
- Thay đổi role/permission tăng `authorizationVersion`, ghi audit và revoke/refresh các session bị ảnh hưởng.
- Repository query vẫn áp organization/ownership filter dù controller đã có policy authorization.
