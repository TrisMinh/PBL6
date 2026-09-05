# 3.3.3 Transport Database

Logical DB/schema: `transport_db`; ERD: [Transport](../../system-design/02-07-database-erd/02-transport-db.md).

## Table và key

| Table | Unique/check chính | Index chính |
|---|---|---|
| `organizations` | code unique, status | status/code |
| `buses` | active `(organization_id,normalized_plate_number)` | tenant/status |
| `seats` | `(bus_id,code)`, coordinates/layout valid | bus/order |
| `driver_profiles` | `(organization_id,license_number)`, expiry/status | tenant/user external/status |
| `stops` | coordinates range | tenant/name/search |
| `routes` | origin/destination valid, row version | tenant/status/origin/destination |
| `route_stops` | `(route_id,stop_type,sequence_no)` | route/sequence |
| `trips` | arrival after departure, fare nonnegative, state/sellable | public search, tenant schedule |
| `driver_assignments` | trip/driver/role | driver time, trip |

## Schedule conflict

Persist `operating_window tstzrange` đã gồm buffer policy tại thời điểm assignment và dùng PostgreSQL `btree_gist`:

```sql
create extension if not exists btree_gist;

alter table trips add constraint ex_bus_schedule
  exclude using gist (
    bus_id with =,
    operating_window with &&
  ) where (status not in ('CANCELLED'));

alter table driver_assignments add constraint ex_driver_schedule
  exclude using gist (
    driver_profile_id with =,
    assignment_window with &&
  ) where (active = true);
```

Application check cung cấp lỗi dễ hiểu; exclusion constraint là race-condition guard cuối. Buffer thay đổi không âm thầm rewrite Trip đã publish.

## Search indexes

Baseline index phải được xác nhận bằng `EXPLAIN (ANALYZE, BUFFERS)` trên dataset nghiệm thu:

```sql
create index ix_trips_public_search
  on trips (departure_date, origin_stop_id, destination_stop_id, departure_at)
  include (organization_id, arrival_at, base_fare, bus_id)
  where sellable = true and status in ('SCHEDULED','BOARDING');

create index ix_trips_tenant_schedule
  on trips (organization_id, departure_at desc, status);
```

Nếu origin/destination dựa RouteStop thay vì materialized column, dùng projection/materialized search table do Transport sở hữu; không query Booking DB.

## Publish transaction

Trip publish ghi `SCHEDULED`, `sellable=false`, immutable fare/policy/route/seat snapshot metadata và `TripPublished` Outbox. `TripInventoryReady` consumer dùng Inbox + expected `sourceTripVersion` rồi mark `sellable=true`. Không mở bán nếu Trip/Bus/Driver đã đổi version không tương thích.

