# 3.1.3 Transport API

Owner: Transport Service. Nguồn: `UC-SEARCH-01`, `UC-OPS-01..06`, `UC-TRIP-01`, `FR-SEARCH-*`, `FR-OPS-*`.

## Public Trip API

| Operation ID | Method/path | Auth | Query/body chính | Success |
|---|---|---|---|---:|
| `searchTrips` | `GET /api/v1/trips` | Public | origin, destination, departureDate, passengerCount, filters, sort, page/size | `200` |
| `getTrip` | `GET /api/v1/trips/{tripId}` | Public | — | `200` |
| `getTripStops` | `GET /api/v1/trips/{tripId}/stops` | Public | pickup/dropoff eligibility | `200` |

Search chỉ trả Trip `sellable=true` theo state/policy. Availability chỉ là snapshot tham khảo và phải trả `availabilityAsOf`; Booking kiểm tra lại khi hold.

Sort allow-list: `PRICE_ASC`, `PRICE_DESC`, `DEPARTURE_ASC`, `DURATION_ASC`, `RATING_DESC`. Filter không hợp lệ trả `VALIDATION_ERROR`, không bỏ qua âm thầm.

## Organization, Bus và Seat

| Operation ID | Method/path | Permission | Idempotency |
|---|---|---|---|
| `createOrganization` | `POST /api/v1/admin/organizations` | `platform.organization.manage` | Required |
| `getOrganization` | `GET /api/v1/admin/organizations/{organizationId}` | `platform.organization.read` | No |
| `updateOrganization` | `PATCH /api/v1/operator/organization` | `tenant.organization.manage` | Recommended |
| `listBuses` | `GET /api/v1/operator/buses` | `tenant.bus.read` | No |
| `createBus` | `POST /api/v1/operator/buses` | `tenant.bus.manage` | Required |
| `updateBus` | `PATCH /api/v1/operator/buses/{busId}` | `tenant.bus.manage` | Recommended |
| `deactivateBus` | `POST /api/v1/operator/buses/{busId}/deactivate` | `tenant.bus.manage` | Required |
| `replaceSeatLayout` | `PUT /api/v1/operator/buses/{busId}/seats` | `tenant.bus.manage` | Required |

Bus/Seat đã được Trip snapshot không hard delete. Thay layout tăng `seatTemplateVersion`; Trip đã publish giữ snapshot cũ.

## Driver, Route và Stop

| Operation ID | Method/path | Permission |
|---|---|---|
| `listDrivers` | `GET /api/v1/operator/drivers` | `tenant.driver.read` |
| `createDriverProfile` | `POST /api/v1/operator/drivers` | `tenant.driver.manage` |
| `updateDriverProfile` | `PATCH /api/v1/operator/drivers/{driverId}` | `tenant.driver.manage` |
| `deactivateDriver` | `POST /api/v1/operator/drivers/{driverId}/deactivate` | `tenant.driver.manage` |
| `listRoutes` | `GET /api/v1/operator/routes` | `tenant.route.read` |
| `createRoute` | `POST /api/v1/operator/routes` | `tenant.route.manage` |
| `updateRoute` | `PATCH /api/v1/operator/routes/{routeId}` | `tenant.route.manage` |
| `replaceRouteStops` | `PUT /api/v1/operator/routes/{routeId}/stops` | `tenant.route.manage` |
| `deactivateRoute` | `POST /api/v1/operator/routes/{routeId}/deactivate` | `tenant.route.manage` |

Server lấy organization từ identity context. `organizationId` trong body nếu có chỉ là data và phải khớp context; không dùng để cấp quyền.

## Trip lifecycle

| Operation ID | Method/path | Permission | Guard | Success |
|---|---|---|---|---:|
| `listOperatorTrips` | `GET /api/v1/operator/trips` | `tenant.trip.read` | tenant scope | `200` |
| `createTripDraft` | `POST /api/v1/operator/trips` | `tenant.trip.manage` | Route/Bus/Driver same tenant | `201` |
| `updateTripDraft` | `PATCH /api/v1/operator/trips/{tripId}` | `tenant.trip.manage` | expected version; immutable sold snapshot fields | `200` |
| `publishTrip` | `POST /api/v1/operator/trips/{tripId}/publish` | `tenant.trip.publish` | complete data, no schedule conflict | `202` |
| `cancelTrip` | `POST /api/v1/operator/trips/{tripId}/cancel` | `tenant.trip.cancel` or platform override | `SCHEDULED/BOARDING`, reason, expected version | `202` |
| `transitionTrip` | `POST /api/v1/operator/trips/{tripId}/status-transitions` | `tenant.trip.operate` | assignment/permission + valid transition | `200` |
| `getMyAssignments` | `GET /api/v1/driver/assignments` | Driver | active assignment only | `200` |

### Publish request/status

```json
{
  "expectedVersion": 3
}
```

`202` trả `{tripId, status:"SCHEDULED", sellable:false, operationId}`. Client poll Trip/operation; chỉ khi Booking phát `TripInventoryReady` thì `sellable=true`. Xung đột Bus/Driver trả `SCHEDULE_CONFLICT` với reference trong đúng tenant.

### Transition request

```json
{
  "targetStatus": "BOARDING",
  "expectedVersion": 5,
  "reason": null
}
```

Target phải nằm trong state machine; hủy không dùng endpoint transition chung. Audit ghi actor, Trip, source/target, version và correlation ID.

