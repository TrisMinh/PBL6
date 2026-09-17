create extension if not exists btree_gist;

create table organizations (
  id uuid primary key,
  code varchar(40) not null,
  name varchar(200) not null,
  legal_name varchar(250),
  support_email varchar(254),
  support_phone varchar(20),
  status varchar(30) not null,
  allow_pay_later boolean not null default false,
  commission_rate numeric(5,4) not null default 0.1000,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  row_version bigint not null default 0,
  constraint uq_organizations_code unique (code),
  constraint ck_organizations_status check (status in ('ACTIVE','SUSPENDED','INACTIVE')),
  constraint ck_organizations_commission check (commission_rate >= 0 and commission_rate <= 1)
);

create index ix_organizations_status on organizations (status, name);

create table buses (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  plate_number varchar(20) not null,
  normalized_plate_number varchar(20) not null,
  display_name varchar(120) not null,
  bus_type varchar(50) not null,
  amenities jsonb not null default '[]'::jsonb,
  seat_count integer not null check (seat_count > 0),
  status varchar(30) not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  row_version bigint not null default 0,
  constraint ck_buses_status check (status in ('ACTIVE','MAINTENANCE','INACTIVE'))
);

create unique index uq_buses_active_plate
  on buses (organization_id, normalized_plate_number)
  where deleted_at is null;
create index ix_buses_tenant_status on buses (organization_id, status, display_name);

create table seats (
  id uuid primary key,
  bus_id uuid not null references buses(id),
  code varchar(20) not null,
  deck smallint not null default 1 check (deck between 1 and 2),
  row_no smallint not null check (row_no > 0),
  column_no smallint not null check (column_no > 0),
  seat_type varchar(30) not null,
  active boolean not null default true,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  row_version bigint not null default 0,
  constraint uq_seats_bus_code unique (bus_id, code),
  constraint uq_seats_bus_position unique (bus_id, deck, row_no, column_no),
  constraint ck_seats_type check (seat_type in ('STANDARD','VIP','SLEEPER'))
);

create index ix_seats_bus_order on seats (bus_id, deck, row_no, column_no);

create table driver_profiles (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  user_id_external uuid not null,
  employee_code varchar(50) not null,
  license_number varchar(80) not null,
  license_expires_on date not null,
  status varchar(30) not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  row_version bigint not null default 0,
  constraint ck_driver_profiles_status check (status in ('ACTIVE','SUSPENDED','INACTIVE','EXPIRED'))
);

create unique index uq_driver_profiles_employee
  on driver_profiles (organization_id, employee_code)
  where deleted_at is null;
create unique index uq_driver_profiles_license
  on driver_profiles (organization_id, license_number)
  where deleted_at is null;
create unique index uq_driver_profiles_active_user
  on driver_profiles (organization_id, user_id_external)
  where deleted_at is null;
create index ix_driver_profiles_tenant_status
  on driver_profiles (organization_id, status, license_expires_on);

create table stops (
  id uuid primary key,
  organization_id uuid references organizations(id),
  code varchar(50),
  name varchar(200) not null,
  address varchar(500) not null,
  province_code varchar(20) not null,
  latitude numeric(9,6),
  longitude numeric(9,6),
  status varchar(30) not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  row_version bigint not null default 0,
  constraint ck_stops_status check (status in ('ACTIVE','INACTIVE')),
  constraint ck_stops_latitude check (latitude is null or latitude between -90 and 90),
  constraint ck_stops_longitude check (longitude is null or longitude between -180 and 180)
);

create unique index uq_stops_tenant_code
  on stops (organization_id, code)
  where code is not null;
create index ix_stops_search on stops (province_code, status, name);

create table routes (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  code varchar(50) not null,
  name varchar(200) not null,
  origin_stop_id uuid not null references stops(id),
  destination_stop_id uuid not null references stops(id),
  default_duration_minutes integer not null check (default_duration_minutes > 0),
  distance_km numeric(9,2) check (distance_km is null or distance_km > 0),
  status varchar(30) not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  row_version bigint not null default 0,
  constraint uq_routes_tenant_code unique (organization_id, code),
  constraint ck_routes_endpoints check (origin_stop_id <> destination_stop_id),
  constraint ck_routes_status check (status in ('DRAFT','ACTIVE','INACTIVE'))
);

create index ix_routes_tenant_status on routes (organization_id, status, name);
create index ix_routes_endpoints on routes (origin_stop_id, destination_stop_id, status);

create table route_stops (
  id uuid primary key,
  route_id uuid not null references routes(id) on delete cascade,
  stop_id uuid not null references stops(id),
  sequence_no integer not null check (sequence_no >= 0),
  stop_role varchar(20) not null,
  arrival_offset_minutes integer check (arrival_offset_minutes is null or arrival_offset_minutes >= 0),
  departure_offset_minutes integer check (departure_offset_minutes is null or departure_offset_minutes >= 0),
  pickup_allowed boolean not null default true,
  dropoff_allowed boolean not null default true,
  constraint uq_route_stops_sequence unique (route_id, sequence_no),
  constraint uq_route_stops_stop unique (route_id, stop_id),
  constraint ck_route_stops_role check (stop_role in ('ORIGIN','INTERMEDIATE','DESTINATION')),
  constraint ck_route_stops_offsets check (
    arrival_offset_minutes is null or departure_offset_minutes is null
    or departure_offset_minutes >= arrival_offset_minutes
  )
);

create index ix_route_stops_route_order on route_stops (route_id, sequence_no);

create table trips (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  route_id uuid not null references routes(id),
  bus_id uuid not null references buses(id),
  origin_stop_id uuid not null references stops(id),
  destination_stop_id uuid not null references stops(id),
  departure_at timestamptz not null,
  arrival_at timestamptz not null,
  operating_window tstzrange not null,
  base_fare bigint not null check (base_fare >= 0),
  currency char(3) not null default 'VND',
  status varchar(30) not null,
  sellable boolean not null default false,
  published_version bigint,
  route_snapshot jsonb,
  bus_snapshot jsonb,
  fare_policy_snapshot jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  row_version bigint not null default 0,
  constraint ck_trips_time check (arrival_at > departure_at),
  constraint ck_trips_window check (
    not isempty(operating_window)
    and lower(operating_window) <= departure_at
    and upper(operating_window) >= arrival_at
  ),
  constraint ck_trips_endpoints check (origin_stop_id <> destination_stop_id),
  constraint ck_trips_currency check (currency ~ '^[A-Z]{3}$'),
  constraint ck_trips_status check (status in ('DRAFT','SCHEDULED','BOARDING','DEPARTED','IN_TRANSIT','ARRIVED','COMPLETED','CANCELLED')),
  constraint ck_trips_sellable check (not sellable or status in ('SCHEDULED','BOARDING')),
  constraint ck_trips_publish_version check (published_version is null or published_version > 0)
);

alter table trips add constraint ex_bus_schedule
  exclude using gist (bus_id with =, operating_window with &&)
  where (status in ('SCHEDULED','BOARDING','DEPARTED','IN_TRANSIT','ARRIVED'));

create index ix_trips_public_search
  on trips (((departure_at at time zone 'Asia/Ho_Chi_Minh')::date), origin_stop_id, destination_stop_id, departure_at)
  include (organization_id, arrival_at, base_fare, currency, bus_id)
  where sellable = true and status in ('SCHEDULED','BOARDING');
create index ix_trips_tenant_schedule
  on trips (organization_id, departure_at desc, status);

create table driver_assignments (
  id uuid primary key,
  trip_id uuid not null references trips(id),
  driver_profile_id uuid not null references driver_profiles(id),
  assignment_role varchar(20) not null,
  assignment_window tstzrange not null,
  active boolean not null default true,
  assigned_by_external uuid not null,
  created_at timestamptz not null,
  ended_at timestamptz,
  row_version bigint not null default 0,
  constraint uq_driver_assignments_trip_role unique (trip_id, assignment_role),
  constraint ck_driver_assignments_role check (assignment_role in ('PRIMARY','ASSISTANT')),
  constraint ck_driver_assignments_window check (not isempty(assignment_window))
);

alter table driver_assignments add constraint ex_driver_schedule
  exclude using gist (driver_profile_id with =, assignment_window with &&)
  where (active = true);

create index ix_driver_assignments_trip on driver_assignments (trip_id, active);
create index ix_driver_assignments_driver_time
  on driver_assignments (driver_profile_id, lower(assignment_window))
  where active = true;
