# 3.1.6 Notification & Reporting API

## Notification API

Owner: Notification Service. Nguồn: `UC-NOTIF-01`, `FR-NOTIF-*`.

| Operation ID | Method/path | Permission | Success |
|---|---|---|---:|
| `listMyNotifications` | `GET /api/v1/notifications` | User owner | `200` |
| `markNotificationRead` | `PATCH /api/v1/notifications/{notificationId}/read` | User owner | `200` |
| `getMyNotificationPreferences` | `GET /api/v1/notification-preferences` | User owner | `200` |
| `replaceMyNotificationPreferences` | `PUT /api/v1/notification-preferences` | User owner | `200` |

List dùng cursor theo `(createdAt,id)`. Preference body gồm `notificationType`, `channel`, `enabled`; service từ chối cấu hình tắt toàn bộ kênh bắt buộc bằng `ESSENTIAL_NOTIFICATION_REQUIRED`.

Mark-read là idempotent. Notification event/provider failure không ảnh hưởng transaction nguồn; UI vẫn đọc Ticket/Booking trực tiếp từ owner.

## Reporting API

Owner: Reporting Service. Nguồn: `UC-REPORT-01`, `FR-REPORT-*`.

| Operation ID | Method/path | Permission | Scope |
|---|---|---|---|
| `getRevenueReport` | `GET /api/v1/reports/revenue` | `report.revenue.read` | platform hoặc token tenant |
| `getBookingReport` | `GET /api/v1/reports/bookings` | `report.booking.read` | platform hoặc token tenant |
| `getOccupancyReport` | `GET /api/v1/reports/occupancy` | `report.occupancy.read` | platform hoặc token tenant |
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

Online report quá 10 giây phải chuyển `202` ExportJob. Export file nằm private Object Storage, signed URL ngắn hạn; download recheck permission và ghi audit nếu chứa PII.
