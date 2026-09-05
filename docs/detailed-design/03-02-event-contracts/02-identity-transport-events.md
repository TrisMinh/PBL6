# 3.2.2 Identity và Transport Events

## Identity

| Event v1 | Routing key | Aggregate | Required payload |
|---|---|---|---|
| `UserRegistered` | `identity.user.registered.v1` | User | `userId:string`, `verificationChannel:EMAIL\|SMS`, `registeredAt:datetime` |

`UserRegistered` không chứa OTP/link/token hoặc raw email/SMS body. Notification lấy destination từ scoped contract hoặc payload đã tokenized/encrypted theo provider design được phê duyệt.

## Transport baseline events

| Event v1 | Routing key | Aggregate/version | Required payload |
|---|---|---|---|
| `TripPublished` | `transport.trip.published.v1` | Trip | `tripId`, `organizationId`, `sourceVersion`, `departureAt`, `arrivalAt`, `routeSnapshot`, `seatSnapshot[]`, `fareSnapshot`, `policyVersion` |
| `TripUpdated` | `transport.trip.updated.v1` | Trip | `tripId`, `organizationId`, `sourceVersion`, `changedFields[]`, `effectiveAt` |
| `TripCancelled` | `transport.trip.cancelled.v1` | Trip | `tripId`, `organizationId`, `sourceVersion`, `reasonCode`, `cancelledAt`, `cancelledByType` |

### TripPublished payload shape

```json
{
  "tripId": "trip-1",
  "organizationId": "org-1",
  "sourceVersion": 3,
  "departureAt": "2026-09-10T01:00:00Z",
  "arrivalAt": "2026-09-10T05:00:00Z",
  "routeSnapshot": {
    "routeId": "route-1",
    "origin": "Đà Nẵng",
    "destination": "Huế",
    "stops": [{"stopId":"stop-1","sequence":1,"offsetMinutes":0}]
  },
  "seatSnapshot": [
    {"sourceSeatId":"seat-1","code":"A1","type":"STANDARD","enabled":true}
  ],
  "fareSnapshot": {"amount":150000,"currency":"VND"},
  "policyVersion": "policy-2026-01"
}
```

Booking phải xử lý toàn bộ seat snapshot idempotently; Trip chỉ sellable sau technical acknowledgement event.

## Transport design event

| Event v1 | Routing key | Consumer | Required payload |
|---|---|---|---|
| `TripStatusChanged` | `transport.trip.status-changed.v1` | Booking, Reporting | `tripId`, `organizationId`, `sourceStatus`, `targetStatus`, `sourceVersion`, `transitionedAt` |

`TripUpdated` dành cho lịch/điểm/policy field được phép; `TripStatusChanged` dành cho state machine. Không dùng `TripUpdated` để lách state guard.

## Consumer behavior

- Booking queue: validate trip version; tạo/cập nhật TripSnapshot, TripSeat; đóng inventory khi cancel/depart.
- Notification: chỉ Trip update/cancel ảnh hưởng Customer; không gửi cho mọi technical update.
- Reporting: projection update kèm `dataAsOf`; version gap được reconcile.

