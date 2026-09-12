# 3.1.6 Notification & Reporting API

## Notification API

Owner: Notification Service. Nguồn: `UC-NOTIF-01`, `FR-NOTIF-*`.

MVP active: in-app notification, đánh dấu đã đọc và email delivery qua SMTP. Preference và push/SMS là P1; hai preference route không được đăng ký trong MVP.

| Operation ID | Method/path | Permission | Success |
|---|---|---|---:|
| `listMyNotifications` | `GET /api/v1/notifications` | User owner | `200` |
| `markNotificationRead` | `PATCH /api/v1/notifications/{notificationId}/read` | User owner | `200` |

Thiết kế P1, không có trong OpenAPI/runtime MVP:

| Operation ID | Method/path | Permission | Success |
|---|---|---|---:|
| `getMyNotificationPreferences` | `GET /api/v1/notification-preferences` | User owner | `200` |
| `replaceMyNotificationPreferences` | `PUT /api/v1/notification-preferences` | User owner | `200` |

List dùng cursor theo `(createdAt,id)`. Preference body gồm `notificationType`, `channel`, `enabled`; service từ chối cấu hình tắt toàn bộ kênh bắt buộc bằng `ESSENTIAL_NOTIFICATION_REQUIRED`.

Mark-read là idempotent. Notification event/provider failure không ảnh hưởng transaction nguồn; UI vẫn đọc Ticket/Booking trực tiếp từ owner.

## Reporting API

Owner: Reporting Service. Nguồn: `UC-REPORT-01`, `FR-REPORT-*`.

MVP active: báo cáo revenue, booking và occupancy online trong giới hạn 10 giây. Export CSV là P1; các route `/exports` không được đăng ký trong MVP.

| Operation ID | Method/path | Permission | Scope |
|---|---|---|---|
| `getRevenueReport` | `GET /api/v1/reports/revenue` | `report.revenue.read` | platform hoặc token tenant |
| `getBookingReport` | `GET /api/v1/reports/bookings` | `report.booking.read` | platform hoặc token tenant |
| `getOccupancyReport` | `GET /api/v1/reports/occupancy` | `report.occupancy.read` | platform hoặc token tenant |

Thiết kế P1, không có trong OpenAPI/runtime MVP:

| Operation ID | Method/path | Permission | Scope |
|---|---|---|---|
| `createExport` | `POST /api/v1/exports` | `report.revenue.export`, `report.booking.export` hoặc `report.occupancy.export` theo report type | scoped filters |
| `getExport` | `GET /api/v1/exports/{exportId}` | requester + permission export tương ứng còn hiệu lực | owner/tenant scope |
| `downloadExport` | `POST /api/v1/exports/{exportId}/download-link` | requester + permission export tương ứng còn hiệu lực | recheck + audit |

Query bắt buộc `from`, `to`, `timezone`; optional tenant filter chỉ Admin platform được dùng. Operator Finance luôn dùng tenant từ token/context.

Response có:

```json
{
  "data": [],
  "generatedAt": "2026-09-04T08:30:00Z",
  "dataAsOf": "2026-09-04T08:29:10Z",
  "timezone": "Asia/Ho_Chi_Minh",
  "metricDefinitions": {
    "netRevenue": "grossRevenue - successfulRefunds"
  }
}
```

MVP phải giới hạn date range/pagination để online report hoàn tất trong 10 giây; không tự chuyển sang capability Export chưa kích hoạt. Sau khi P1 được đưa vào release, report lớn có thể trả `202` ExportJob; file nằm private Object Storage, signed URL ngắn hạn, download recheck permission và ghi audit nếu chứa PII.
