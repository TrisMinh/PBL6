\ir common.sql

insert into organizations (
  id, code, name, legal_name, support_email, support_phone, status,
  allow_pay_later, commission_rate, created_at, updated_at
)
select
  id, code, name, legal_name, 'lienhe.' || lower(code) || '@demo.blue.example.test',
  '000900' || lpad(org_no::text, 4, '0'), 'ACTIVE',
  allow_pay_later, commission_rate, created_at, created_at
from demo_orgs
on conflict do nothing;

insert into buses (
  id, organization_id, plate_number, normalized_plate_number, display_name,
  bus_type, amenities, seat_count, status, created_at, updated_at
)
select
  id, organization_id, plate, regexp_replace(upper(plate), '[^A-Z0-9]', '', 'g'),
  display_name, bus_type, amenities, seat_count, status, created_at, created_at
from demo_buses
on conflict do nothing;

insert into seats (
  id, bus_id, code, deck, row_no, column_no, seat_type, active, created_at, updated_at
)
select id, bus_id, code, deck, row_no, column_no, seat_type, true, created_at, created_at
from demo_bus_seats
on conflict do nothing;

insert into driver_profiles (
  id, organization_id, user_id_external, employee_code, license_number,
  license_expires_on, status, created_at, updated_at
)
select
  id, organization_id, user_id, employee_code, license_number,
  (:'anchor'::timestamptz at time zone 'Asia/Ho_Chi_Minh')::date
    + (case when status = 'EXPIRED' then -1 - driver_no else 160 + org_no * 19 + driver_no * 31 end)::int,
  status, created_at, created_at
from demo_drivers
on conflict do nothing;

insert into stops (
  id, organization_id, code, name, address, province_code, latitude, longitude,
  status, created_at, updated_at
)
select
  id, organization_id, code, name, address, province_code, latitude, longitude,
  'ACTIVE', created_at, created_at
from demo_stops
on conflict do nothing;

insert into routes (
  id, organization_id, code, name, origin_stop_id, destination_stop_id,
  default_duration_minutes, distance_km, status, created_at, updated_at
)
select
  id, organization_id, code, name, origin_stop_id, destination_stop_id,
  duration_minutes, distance_km, 'ACTIVE', created_at, created_at
from demo_routes
on conflict do nothing;

insert into route_stops (
  id, route_id, stop_id, sequence_no, stop_role, arrival_offset_minutes,
  departure_offset_minutes, pickup_allowed, dropoff_allowed
)
select
  id, route_id, stop_id, sequence_no, stop_role, arrival_offset_minutes,
  departure_offset_minutes, pickup_allowed, dropoff_allowed
from demo_route_stops
on conflict do nothing;

insert into trips (
  id, organization_id, route_id, bus_id, origin_stop_id, destination_stop_id,
  departure_at, arrival_at, operating_window, base_fare, currency, status, sellable,
  published_version, route_snapshot, bus_snapshot, fare_policy_snapshot, created_at, updated_at,
  row_version
)
select
  id, organization_id, route_id, bus_id, origin_stop_id, destination_stop_id,
  departure_at, arrival_at, operating_window, base_fare, 'VND', status, sellable,
  case when status <> 'DRAFT' then 1 end,
  case when status <> 'DRAFT' then route_snapshot end,
  case when status <> 'DRAFT' then bus_snapshot end,
  case when status <> 'DRAFT' then fare_policy_snapshot end,
  created_at, updated_at,
  case status
    when 'DRAFT' then 0 when 'SCHEDULED' then 1 when 'BOARDING' then 2
    when 'DEPARTED' then 3 when 'IN_TRANSIT' then 4 when 'ARRIVED' then 5
    when 'COMPLETED' then 6 when 'CANCELLED' then 2
  end
from demo_trips
on conflict do nothing;

insert into driver_assignments (
  id, trip_id, driver_profile_id, assignment_role, assignment_window, active,
  assigned_by_external, created_at, ended_at, row_version
)
select
  md5('operating-demo:primary-assignment:' || t.id)::uuid,
  t.id, t.driver_id, 'PRIMARY', t.operating_window, t.status <> 'DRAFT',
  a.user_id, t.created_at, null, case when t.status = 'DRAFT' then 0 else 1 end
from demo_trips t
join demo_org_admins a on a.organization_id = t.organization_id
join trips inserted on inserted.id = t.id
on conflict do nothing;

-- Metadata uses the same keys as the operator workspace and organization profile APIs.
insert into operator_resource_metadata (organization_id, resource_kind, resource_id, data, updated_at)
select
  o.id, 'organization', o.id,
  jsonb_build_object(
    'legalName', o.legal_name,
    'taxId', '000900' || lpad(o.org_no::text, 4, '0'),
    'taxCode', '000900' || lpad(o.org_no::text, 4, '0'),
    'address', coalesce(home_stop.address, 'Văn phòng điều hành, ' || o.home_code),
    'contactName', admin.full_name,
    'additionalPhones', jsonb_build_array('000901' || lpad(o.org_no::text, 4, '0'))
  ),
  o.created_at
from demo_orgs o
join demo_org_admins a on a.organization_id = o.id
join demo_people admin on admin.id = a.user_id
left join lateral (
  select s.address
  from demo_stops s
  where s.org_no = o.org_no
  order by (s.place_code = o.home_code) desc, s.code
  limit 1
) home_stop on true
on conflict do nothing;

insert into operator_resource_metadata (organization_id, resource_kind, resource_id, data, updated_at)
select
  b.organization_id, 'buses', b.id,
  jsonb_strip_nulls(jsonb_build_object(
    'type', coalesce(array_position(array[
      'SLEEPER_40', 'LIMOUSINE_11', 'VIP_29', 'LIMOUSINE_10', 'LIMOUSINE_24',
      'SLEEPER_36', 'SLEEPER_34', 'SLEEPER_30', 'SLEEPER_24', 'LIMOUSINE_SLEEPER_22',
      'ROOM_24', 'ROOM_21', 'CABIN_24', 'CABIN_21_22', 'CABIN_22'
    ], b.bus_type) - 1, case when b.bus_type = 'STANDARD' then 2 else 0 end),
    'disabledSeats', '[]'::jsonb,
    'cabinCapacity', case when b.bus_type = 'CABIN_21_22' then b.seat_count end,
    'fleetNumber', 'XE-' || lpad(b.bus_no::text, 2, '0'),
    'modelYear', extract(year from :'anchor'::timestamptz)::int - 9 + (b.org_no + 2 * b.bus_no) % 9,
    'lastInspectionOn', ((:'anchor'::timestamptz at time zone 'Asia/Ho_Chi_Minh')::date
      - (21 + (b.org_no * 31 + b.bus_no * 13) % 130)::int)::text,
    'maintenanceNote', case when b.status = 'MAINTENANCE' then 'Bảo dưỡng định kỳ và kiểm tra điều hòa' end
  )),
  b.created_at
from demo_buses b
on conflict do nothing;

insert into operator_resource_metadata (organization_id, resource_kind, resource_id, data, updated_at)
select
  d.organization_id, 'drivers', d.id,
  jsonb_build_object(
    'name', d.full_name,
    'fullName', d.full_name,
    'phone', p.phone,
    'email', p.email,
    'birthDate', (date '1969-01-01' + ((d.org_no * 339 + d.driver_no * 541) % 10000)::int)::text,
    'address', 'Khu điều hành lái xe, ' || o.name,
    'licenseClass', case when d.driver_no % 5 = 0 then 'E' else 'D' end,
    'issuedAt', (dp.license_expires_on - interval '5 years')::date::text,
    'licenseIssuedOn', (dp.license_expires_on - interval '5 years')::date::text,
    'joinedAt', (d.created_at at time zone 'Asia/Ho_Chi_Minh')::date::text,
    'status', case when d.status = 'ACTIVE' then 'available' else 'paused' end,
    'notes', case d.status
      when 'EXPIRED' then 'Chờ cập nhật giấy phép lái xe'
      when 'SUSPENDED' then 'Tạm ngưng phân công'
      when 'INACTIVE' then 'Ngoài ca khai thác hiện tại'
      else (array['Ca sáng', 'Ca chiều', 'Ca đêm', 'Tăng cường cuối tuần'])[1 + d.driver_no % 4]
    end
  ),
  d.created_at
from demo_drivers d
join demo_people p on p.id = d.user_id
join demo_orgs o on o.id = d.organization_id
join driver_profiles dp on dp.id = d.id
on conflict do nothing;

insert into operator_resource_metadata (organization_id, resource_kind, resource_id, data, updated_at)
select
  r.organization_id, 'routes', r.id,
  jsonb_build_object(
    'direction', 'one-way',
    'region', concat_ws(' – ', src.province_code, dst.province_code),
    'note', case when r.duration_minutes >= 360
      then 'Tuyến đường dài có điểm dừng nghỉ theo hành trình.'
      else 'Đón trả khách tại các điểm đã công bố.' end,
    'stops', (
      select jsonb_agg(jsonb_build_object(
        'km', round(r.distance_km::numeric * coalesce(rs.arrival_offset_minutes, rs.departure_offset_minutes, 0)
          / r.duration_minutes, 1)
      ) order by rs.sequence_no)
      from demo_route_stops rs
      where rs.route_id = r.id
    )
  ),
  r.created_at
from demo_routes r
join demo_stops src on src.id = r.origin_stop_id
join demo_stops dst on dst.id = r.destination_stop_id
on conflict do nothing;
