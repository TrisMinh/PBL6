-- Shared input for the six service databases. All records describe a fictional operator network.
SET LOCAL TIME ZONE 'Asia/Ho_Chi_Minh';

CREATE FUNCTION pg_temp.demo_id(entity text, VARIADIC keys bigint[])
RETURNS uuid LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT ('da7a2026' || substr(md5('blue-operating-demo-v1/' || entity || '/' || array_to_string(keys, '/')), 9))::uuid;
$$;

CREATE FUNCTION pg_temp.demo_id(entity text, key uuid)
RETURNS uuid LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT ('da7a2026' || substr(md5('blue-operating-demo-v1/' || entity || '/' || key), 9))::uuid;
$$;

CREATE FUNCTION pg_temp.demo_name(n bigint)
RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT concat_ws(' ',
    (ARRAY['Nguyễn','Trần','Lê','Phạm','Hoàng','Phan','Vũ','Đặng','Bùi','Võ','Đỗ','Hồ','Ngô','Dương','Trương','Đinh','Đoàn'])[1+n%17],
    (ARRAY['Minh','Thanh','Hải','Thành','Thùy','Quang','Mai','Bảo','Khánh','Phương','Gia','Ngọc','Đức','Thu','Anh','Hoài','Kim','Tấn','Xuân'])[1+(n/17)%19],
    (ARRAY['An','Bình','Chi','Châu','Dũng','Duy','Giang','Hà','Hân','Hiếu','Hòa','Huy','Khang','Lâm','Linh','Long','Ly','My','Nam','Nga','Nhi','Ninh','Phong','Phúc','Quân','Sơn','Tâm','Thảo','Trang','Trí','Trúc','Tú','Uyên','Vi','Vân','Yến','Đạt'])[1+(n/323)%37]);
$$;

CREATE TEMP TABLE demo_config AS SELECT :'anchor'::timestamptz AS anchor;

CREATE TEMP TABLE demo_orgs AS
SELECT org_no, pg_temp.demo_id('operator', org_no) AS id,
       'DEMO' || lpad(org_no::text, 2, '0') AS code, name,
       'Công ty TNHH Vận tải ' || name AS legal_name, home_code,
       (0.075 + ((org_no * 3) % 7 + org_no % 4) * 0.005)::numeric(5,4) AS commission_rate,
       org_no % 4 <> 0 AS allow_pay_later,
       anchor - make_interval(days => 500 + 31 * org_no) AS created_at
FROM demo_config CROSS JOIN (VALUES
  (1,'Hải Vân Lam','DN'), (2,'Cánh Buồm Sông Hàn','DN'),
  (3,'Đường Mây Kinh Bắc','HN'), (4,'Sao Sớm Thăng Long','HN'),
  (5,'Gió Mùa Phương Nam','SG'), (6,'Sài Thành Ban Mai','SG'),
  (7,'Sương Mai Lang Biang','DL'), (8,'Triền Thông Cao Nguyên','DL'),
  (9,'Bờ Cát Hạ Long','QN'), (10,'Hành Trình Vịnh Xanh','QN'),
  (11,'Phù Sa Tây Đô','CT'), (12,'Bến Nước Phương Nam','CT'),
  (13,'Miền Thương Sông Hương','HUE'), (14,'Đường Xưa Cố Đô','HUE'),
  (15,'Vịnh Lam Nha Trang','NT'), (16,'Gió Biển Nam Trung Bộ','NT')
) AS org(org_no, name, home_code);
CREATE UNIQUE INDEX ON demo_orgs(id);

CREATE TEMP TABLE demo_places AS
SELECT * FROM (VALUES
  (1,'DN','Đà Nẵng','DA_NANG',16.0544,108.2022),
  (2,'HN','Hà Nội','HA_NOI',21.0285,105.8542),
  (3,'SG','TP. Hồ Chí Minh','HO_CHI_MINH',10.7769,106.7009),
  (4,'DL','Đà Lạt','LAM_DONG',11.9404,108.4583),
  (5,'QN','Hạ Long','QUANG_NINH',20.9505,107.0734),
  (6,'CT','Cần Thơ','CAN_THO',10.0452,105.7469),
  (7,'HUE','Huế','HUE',16.4637,107.5909),
  (8,'NT','Nha Trang','KHANH_HOA',12.2388,109.1967),
  (9,'HA','Hội An','DA_NANG',15.8801,108.3380),
  (10,'QNG','Quảng Ngãi','QUANG_NGAI',15.1214,108.8044),
  (11,'HP','Hải Phòng','HAI_PHONG',20.8449,106.6881),
  (12,'NB','Ninh Bình','NINH_BINH',20.2506,105.9745),
  (13,'VT','Vũng Tàu','HO_CHI_MINH',10.4114,107.1362),
  (14,'BMT','Buôn Ma Thuột','DAK_LAK',12.6664,108.0378),
  (15,'BD','Bảo Lộc','LAM_DONG',11.5475,107.8079),
  (16,'CM','Cà Mau','CA_MAU',9.1527,105.1961),
  (17,'RG','Rạch Giá','AN_GIANG',10.0060,105.0809),
  (18,'DH','Đồng Hới','QUANG_TRI',17.4688,106.6223),
  (19,'LC','Lăng Cô','HUE',16.2469,108.0781),
  (20,'PT','Phan Thiết','LAM_DONG',10.9805,108.2615),
  (21,'TH','Thanh Hóa','THANH_HOA',19.8067,105.7852),
  (22,'HL','Hòa Lạc','HA_NOI',21.0125,105.5254),
  (23,'DLT','Di Linh','LAM_DONG',11.5841,108.0808),
  (24,'LX','Long Xuyên','AN_GIANG',10.3864,105.4356),
  (25,'MM','Mỹ Tho','DONG_THAP',10.3600,106.3630),
  (26,'CR','Cam Ranh','KHANH_HOA',11.9214,109.1591),
  (27,'DX','Đồng Xoài','DONG_NAI',11.5370,106.8810),
  (28,'HM','Hưng Mỹ','VINH_LONG',9.8065,106.2935),
  (29,'PC','Phủ Lý','NINH_BINH',20.5411,105.9140),
  (30,'HG','Hải Dương','HAI_PHONG',20.9410,106.3330),
  (31,'LT','Long Thành','DONG_NAI',10.7980,106.9520),
  (32,'DXU','Dầu Giây','DONG_NAI',10.9480,107.1410),
  (33,'AL','Ái Nghĩa','DA_NANG',15.8780,108.1220),
  (34,'QN2','Quy Nhơn','GIA_LAI',13.7820,109.2190),
  (35,'BL','Bạc Liêu','CA_MAU',9.2940,105.7210),
  (36,'DH2','Đức Hòa','TAY_NINH',10.8260,106.4220),
  (37,'QT','Đông Hà','QUANG_TRI',16.8180,107.1000),
  (38,'PR','Phan Rang','KHANH_HOA',11.5650,108.9930),
  (39,'EA','Ea H’leo','DAK_LAK',13.1980,108.2340),
  (40,'V','Vinh','NGHE_AN',18.6790,105.6810),
  (41,'DLK','Đắk Mil','LAM_DONG',12.4580,107.6270)
) AS p(place_no, code, name, province_code, latitude, longitude);

CREATE TEMP TABLE demo_corridors AS
SELECT * FROM (VALUES
  ('DN',1,'HUE','LC',135,105,160000), ('DN',2,'HN','V',780,765,470000), ('DN',3,'QNG','HA',180,145,180000),
  ('HN',1,'HP','HG',130,120,160000), ('HN',2,'QN','HG',170,160,220000), ('HN',3,'NB','PC',115,100,145000),
  ('SG',1,'DL','BD',390,315,350000), ('SG',2,'VT','LT',145,105,180000), ('SG',3,'CT','MM',220,170,210000),
  ('DL',1,'SG','BD',410,315,360000), ('DL',2,'NT','DLT',225,145,240000), ('DL',3,'BMT','DLK',300,210,260000),
  ('QN',1,'HN','HG',175,160,230000), ('QN',2,'HP','HG',105,90,145000), ('QN',3,'NB','PC',245,205,240000),
  ('CT',1,'SG','MM',215,170,215000), ('CT',2,'CM','BL',235,180,225000), ('CT',3,'RG','LX',160,120,175000),
  ('HUE',1,'DN','LC',145,105,155000), ('HUE',2,'HA','LC',195,130,195000), ('HUE',3,'DH','QT',215,168,220000),
  ('NT',1,'DL','DLT',220,145,245000), ('NT',2,'PT','PR',260,230,245000), ('NT',3,'SG','CR',520,435,370000)
) AS c(home_code, corridor_no, destination_code, via_code, duration_minutes, distance_km, base_fare);

CREATE TEMP TABLE demo_stops AS
SELECT o.org_no, pg_temp.demo_id('stop', o.org_no, p.place_no) AS id, o.id AS organization_id,
       o.code || '-' || p.code AS code, p.name AS name,
       'Điểm đón ' || o.name || ' · ' || p.name AS address, p.province_code, p.latitude, p.longitude,
       o.created_at, p.code AS place_code
FROM demo_orgs o
JOIN demo_places p ON p.code = o.home_code OR EXISTS (
  SELECT FROM demo_corridors c WHERE c.home_code = o.home_code AND p.code IN (c.destination_code, c.via_code)
);
CREATE UNIQUE INDEX ON demo_stops(id);

CREATE TEMP TABLE demo_routes AS
SELECT o.org_no, (c.corridor_no-1)*2 + direction AS route_no,
       pg_temp.demo_id('route', o.org_no, c.corridor_no, direction) AS id, o.id AS organization_id,
       o.code || '-R' || ((c.corridor_no-1)*2 + direction)::text AS code,
       origin.name || ' – ' || destination.name AS name,
       origin.id AS origin_stop_id, destination.id AS destination_stop_id, via.id AS via_stop_id,
       c.duration_minutes, c.distance_km, c.base_fare + ((o.org_no % 3) * 10000) AS base_fare, o.created_at,
       o.allow_pay_later
FROM demo_orgs o
JOIN demo_corridors c ON c.home_code = o.home_code
CROSS JOIN generate_series(1,2) AS direction
JOIN demo_stops origin ON origin.org_no = o.org_no AND origin.place_code = CASE direction WHEN 1 THEN o.home_code ELSE c.destination_code END
JOIN demo_stops destination ON destination.org_no = o.org_no AND destination.place_code = CASE direction WHEN 1 THEN c.destination_code ELSE o.home_code END
JOIN demo_stops via ON via.org_no = o.org_no AND via.place_code = c.via_code;
CREATE UNIQUE INDEX ON demo_routes(id);

CREATE TEMP TABLE demo_route_stops AS
SELECT pg_temp.demo_id('route-stop', r.org_no, r.route_no, sequence_no) AS id, r.id AS route_id, stop_id,
       sequence_no, stop_role, offset_minutes AS arrival_offset_minutes,
       offset_minutes + CASE WHEN stop_role = 'INTERMEDIATE' THEN 10 ELSE 0 END AS departure_offset_minutes,
       sequence_no < 2 AS pickup_allowed, sequence_no > 0 AS dropoff_allowed
FROM demo_routes r CROSS JOIN LATERAL (VALUES
  (0, r.origin_stop_id, 'ORIGIN', 0),
  (1, r.via_stop_id, 'INTERMEDIATE', r.duration_minutes / 2),
  (2, r.destination_stop_id, 'DESTINATION', r.duration_minutes)
) AS stops(sequence_no, stop_id, stop_role, offset_minutes);

CREATE TEMP TABLE demo_customers AS
SELECT n AS customer_no, pg_temp.demo_id('customer', n) AS id, pg_temp.demo_name(n * 127 % 11951) AS full_name,
       'customer.' || lpad(n::text,5,'0') || '@demo.blue.example.test' AS email,
       '+84081' || lpad(n::text,7,'0') AS phone,
       anchor - make_interval(days => 115 + (n * 17) % 610) AS created_at
FROM demo_config CROSS JOIN generate_series(1,12000) n;
CREATE UNIQUE INDEX ON demo_customers(customer_no);

CREATE TEMP TABLE demo_drivers AS
SELECT o.org_no, n AS driver_no, pg_temp.demo_id('driver-profile', o.org_no, n) AS id,
       o.id AS organization_id, pg_temp.demo_id('driver-user', o.org_no, n) AS user_id,
       pg_temp.demo_name(16000 + o.org_no*595 + n*131) AS full_name,
       o.code || '-LX' || lpad(n::text,2,'0') AS employee_code,
       o.code || '-GPLX-' || lpad(n::text,4,'0') AS license_number,
       CASE WHEN n=19 AND o.org_no%3=0 THEN 'EXPIRED' WHEN n=20 THEN 'INACTIVE' ELSE 'ACTIVE' END AS status,
       o.created_at + interval '10 days' + make_interval(days => n) AS created_at
FROM demo_orgs o CROSS JOIN generate_series(1,20) n;

CREATE TEMP TABLE demo_people AS
SELECT id, full_name, email, phone, 'CUSTOMER'::text AS role, NULL::uuid AS organization_id, created_at
FROM demo_customers
UNION ALL
SELECT user_id, full_name,
       'driver.' || lpad(org_no::text,2,'0') || '.' || lpad(driver_no::text,2,'0') || '@demo.blue.example.test',
       '+84001' || lpad((org_no*100+driver_no)::text,7,'0'), 'DRIVER', organization_id, created_at
FROM demo_drivers
UNION ALL
SELECT pg_temp.demo_id('staff', o.org_no, slot), pg_temp.demo_name(33000 + o.org_no*389 + slot*237),
       username || '.' || lpad(o.org_no::text,2,'0') || '@demo.blue.example.test',
       '+84002' || lpad((o.org_no*100+slot)::text,7,'0'), role, o.id,
       o.created_at + make_interval(days => slot)
FROM demo_orgs o CROSS JOIN (VALUES
  (1,'operator','OPERATOR_ADMIN'), (2,'finance','OPERATOR_FINANCE'), (3,'scheduler','OPERATOR_SCHEDULER'),
  (4,'support','OPERATOR_OPERATIONS'), (5,'dispatch','OPERATOR_OPERATIONS')
) AS team(slot, username, role);

CREATE TEMP TABLE demo_org_admins AS
SELECT organization_id, id AS user_id FROM demo_people WHERE role = 'OPERATOR_ADMIN';

CREATE TEMP TABLE demo_buses AS
SELECT o.org_no, n AS bus_no, pg_temp.demo_id('bus', o.org_no, n) AS id, o.id AS organization_id,
       'DM-' || lpad(o.org_no::text,2,'0') || '-' || lpad(n::text,3,'0') AS plate,
       CASE WHEN n%3=0 THEN 'Cabin riêng' ELSE 'Giường nằm' END || ' ' || o.name || ' ' || lpad(n::text,2,'0') AS display_name,
       CASE WHEN n%3=0 THEN 'CABIN_22' ELSE 'SLEEPER_34' END AS bus_type,
       CASE WHEN n%3=0 THEN 22 ELSE 34 END AS seat_count,
       CASE n WHEN 19 THEN 'MAINTENANCE' WHEN 20 THEN 'INACTIVE' ELSE 'ACTIVE' END AS status,
       CASE WHEN n%3=0 THEN '["WIFI","AC","WATER","CHARGING","RESTROOM"]'::jsonb
            ELSE '["WIFI","AC","WATER","CHARGING"]'::jsonb END AS amenities,
       o.created_at + interval '15 days' + make_interval(days => n) AS created_at
FROM demo_orgs o CROSS JOIN generate_series(1,20) n;
CREATE UNIQUE INDEX ON demo_buses(id);

CREATE TEMP TABLE demo_bus_seats AS
SELECT b.id AS bus_id, pg_temp.demo_id('bus-seat', b.org_no, b.bus_no, n) AS id, n AS seat_no,
       CASE WHEN n<=b.seat_count/2 THEN 'A' ELSE 'B' END || lpad(((n-1)%(b.seat_count/2)+1)::text,2,'0') AS code,
       ((n-1)/(b.seat_count/2)+1)::smallint AS deck,
       (((n-1)%(b.seat_count/2))/width+1)::smallint AS row_no,
       (((n-1)%(b.seat_count/2))%width+1)::smallint AS column_no,
       CASE b.bus_type WHEN 'CABIN_22' THEN 'VIP' ELSE 'SLEEPER' END AS seat_type, b.created_at
FROM demo_buses b CROSS JOIN LATERAL generate_series(1,b.seat_count) n
CROSS JOIN LATERAL (SELECT CASE b.bus_type WHEN 'CABIN_22' THEN 2 ELSE 3 END) layout(width);
CREATE INDEX ON demo_bus_seats(bus_id);

CREATE TEMP TABLE demo_route_snapshots AS
SELECT r.id AS route_id, jsonb_build_object('Id', r.id, 'Name', r.name, 'Stops',
  jsonb_agg(jsonb_build_object('Id',rs.id,'RouteId',rs.route_id,'StopId',rs.stop_id,'Sequence',rs.sequence_no,
    'Role',rs.stop_role,'OffsetMinutes',rs.departure_offset_minutes,'PickupAllowed',rs.pickup_allowed,
    'DropoffAllowed',rs.dropoff_allowed,'StopName',s.name,'Address',s.address) ORDER BY rs.sequence_no)) AS snapshot
FROM demo_routes r JOIN demo_route_stops rs ON rs.route_id=r.id JOIN demo_stops s ON s.id=rs.stop_id
GROUP BY r.id,r.name;
CREATE UNIQUE INDEX ON demo_route_snapshots(route_id);

CREATE TEMP TABLE demo_bus_snapshots AS
SELECT b.id AS bus_id, jsonb_build_object('Id',b.id,'Type',b.bus_type,'Amenities',b.amenities,'seats',
  jsonb_agg(jsonb_build_object('Id',s.id,'Code',s.code,'Deck',s.deck,'row',s.row_no,'column',s.column_no,
    'Type',s.seat_type,'Active',true) ORDER BY s.seat_no)) AS snapshot
FROM demo_buses b JOIN demo_bus_seats s ON s.bus_id=b.id GROUP BY b.id,b.bus_type,b.amenities;
CREATE UNIQUE INDEX ON demo_bus_snapshots(bus_id);

CREATE TEMP TABLE demo_trips AS
WITH schedule AS (
  SELECT r.*, day_no, anchor, (r.org_no*100000 + r.route_no*1000 + day_no + 100)::bigint AS trip_no,
         (r.route_no-1)*3 + ((day_no+90)%3) + 1 AS fleet_slot,
         date_trunc('day',anchor) + make_interval(days => day_no,
           hours => (ARRAY[8,18,7,16,10,21])[r.route_no], mins => (r.org_no*15+r.route_no*10)%60) AS departure_at
  FROM demo_routes r CROSS JOIN demo_config CROSS JOIN generate_series(-90,30) day_no
), timing AS (
  SELECT s.*, departure_at + make_interval(mins => duration_minutes) AS arrival_at,
         b.id AS bus_id, d.id AS driver_id, d.user_id AS driver_user_id, b.seat_count,
         (base_fare + CASE WHEN b.bus_type='CABIN_22' THEN 80000 ELSE 0 END
                    + CASE WHEN extract(isodow FROM departure_at) IN (5,6,7) THEN 30000 ELSE 0 END)::bigint AS fare
  FROM schedule s JOIN demo_buses b ON b.org_no=s.org_no AND b.bus_no=s.fleet_slot
  JOIN demo_drivers d ON d.org_no=s.org_no AND d.driver_no=s.fleet_slot
), lifecycle AS (
  SELECT t.*, CASE
    WHEN day_no >= 10 AND trip_no%31=0 THEN 'DRAFT'
    WHEN day_no < -1 AND trip_no%53=0 THEN 'CANCELLED'
    WHEN arrival_at < anchor - interval '90 minutes' THEN 'COMPLETED'
    WHEN arrival_at <= anchor THEN 'ARRIVED'
    WHEN departure_at < anchor - interval '25 minutes' THEN 'IN_TRANSIT'
    WHEN departure_at <= anchor THEN 'DEPARTED'
    WHEN departure_at <= anchor + interval '40 minutes' THEN 'BOARDING'
    ELSE 'SCHEDULED' END AS status
  FROM timing t
)
SELECT pg_temp.demo_id('trip', t.trip_no) AS id, t.organization_id, t.id AS route_id,
       t.bus_id,t.driver_id,t.driver_user_id,t.origin_stop_id,t.destination_stop_id,t.departure_at,t.arrival_at,
       tstzrange(t.departure_at-interval '1 hour',t.arrival_at+interval '1 hour','[)') AS operating_window,
       t.fare AS base_fare,t.status,t.status IN ('SCHEDULED','BOARDING') AS sellable,
       r.snapshot AS route_snapshot,b.snapshot AS bus_snapshot,
       jsonb_build_object('baseFare',t.fare,'Currency','VND','policyVersion','cancel-mvp-v1',
          'allowPayLater',t.allow_pay_later,'driverUserId',t.driver_user_id) AS fare_policy_snapshot,
       LEAST(t.departure_at-interval '45 days',t.anchor-interval '1 hour') AS created_at,
       LEAST(CASE t.status WHEN 'COMPLETED' THEN t.arrival_at
                          WHEN 'CANCELLED' THEN t.departure_at-interval '2 days'
                          ELSE t.departure_at-interval '50 minutes' END,t.anchor) AS updated_at,
       t.trip_no,t.day_no,t.org_no,t.route_no,t.seat_count,t.allow_pay_later,t.via_stop_id
FROM lifecycle t JOIN demo_route_snapshots r ON r.route_id=t.id JOIN demo_bus_snapshots b ON b.bus_id=t.bus_id;
CREATE UNIQUE INDEX ON demo_trips(id);
ANALYZE demo_trips;

-- Identity and Transport need no per-order fixtures.
\if :with_orders
CREATE TEMP TABLE demo_trip_seats AS
SELECT pg_temp.demo_id('trip-seat',t.trip_no,s.seat_no) AS id,t.id AS trip_id,s.id AS source_seat_id,
       s.seat_no,s.code,s.deck,s.row_no,s.column_no,s.seat_type,t.base_fare AS price,t.updated_at
FROM demo_trips t JOIN demo_bus_seats s ON s.bus_id=t.bus_id WHERE t.status<>'DRAFT';
CREATE INDEX ON demo_trip_seats(trip_id,seat_no);
ANALYZE demo_trip_seats;

CREATE TEMP TABLE demo_selected_seats AS
SELECT s.*, ((s.seat_no-1)/10)*5 + CASE ((s.seat_no-1)%10)
         WHEN 0 THEN 1 WHEN 1 THEN 2 WHEN 2 THEN 2 WHEN 3 THEN 3 WHEN 4 THEN 3
         WHEN 5 THEN 4 WHEN 6 THEN 4 WHEN 7 THEN 4 ELSE 5 END AS party
FROM demo_trips t JOIN demo_trip_seats s ON s.trip_id=t.id
WHERE s.seat_no <= CASE
  WHEN t.status='CANCELLED' THEN t.seat_count * (42+t.trip_no%31) / 100
  WHEN t.day_no<0 THEN t.seat_count * (62+t.trip_no%33) / 100
  ELSE t.seat_count * greatest(12, 77 - 2*t.day_no + t.trip_no%23) / 100 END;
CREATE INDEX ON demo_selected_seats(trip_id,party);
ANALYZE demo_selected_seats;

CREATE TEMP TABLE demo_orders AS
WITH party AS (
  SELECT s.trip_id,s.party,sum(s.price)::bigint AS fare
  FROM demo_selected_seats s GROUP BY s.trip_id,s.party
), profiles AS (
  SELECT p.*,t.organization_id,t.trip_no,t.departure_at,t.arrival_at,t.status AS trip_status,t.org_no,t.route_no,t.day_no,
         (t.trip_no*137+p.party*97)%100 AS pattern,
         CASE WHEN t.allow_pay_later AND (t.trip_no+p.party)%5=0 THEN 'PAY_LATER' ELSE 'PREPAID' END AS channel,
         LEAST(t.departure_at-make_interval(days => (1+(t.trip_no+p.party*3)%24)::int),
               CASE WHEN t.status='CANCELLED' THEN t.departure_at-interval '50 hours' END,
               d.anchor-make_interval(hours => (6+(t.trip_no+p.party)%62)::int)) AS booked_at,
         CASE WHEN t.org_no=1 AND t.route_no=1 AND p.party=1 AND t.day_no IN (-74,-28,-17,-6,2,7,15) THEN 1
              ELSE 1+((t.trip_no*811 + p.party*2957) % CASE WHEN t.trip_no%5=0 THEN 1400 ELSE 12000 END) END AS customer_no
  FROM party p JOIN demo_trips t ON t.id=p.trip_id CROSS JOIN demo_config d
), lifecycle AS (
  SELECT p.*,CASE
    WHEN channel='PREPAID' AND pattern IN (5,6,7,8,9) THEN 'EXPIRED'
    WHEN trip_status='CANCELLED' AND channel='PREPAID' THEN 'REFUNDED'
    WHEN pattern IN (1,2,3,4) AND channel='PREPAID' THEN 'REFUNDED'
    WHEN pattern=0 AND channel='PREPAID' AND day_no>=-3 THEN 'REFUND_PENDING'
    WHEN trip_status='CANCELLED' OR (pattern%23=0 AND channel='PAY_LATER') THEN 'CANCELLED'
    WHEN trip_status='COMPLETED' THEN 'COMPLETED'
    WHEN channel='PAY_LATER' THEN 'CONFIRMED'
    ELSE 'PAID' END AS status
  FROM profiles p
)
SELECT pg_temp.demo_id('booking',p.trip_no,p.party) AS id,pg_temp.demo_id('hold',p.trip_no,p.party) AS hold_id,
       'BKDM' || lpad(p.trip_no::text,7,'0') || lpad(p.party::text,2,'0') AS booking_code,
       p.trip_id,p.organization_id,c.id AS customer_id,c.full_name AS customer_name,c.email AS customer_email,c.phone AS customer_phone,
       p.channel AS payment_channel,p.status,p.fare AS subtotal,p.fare AS total,p.booked_at AS created_at,
       p.booked_at+interval '9 minutes' AS expires_at,
       CASE WHEN p.channel='PREPAID' AND p.status<>'EXPIRED' THEN p.booked_at+interval '3 minutes' END AS paid_at,
       CASE WHEN p.status IN ('CANCELLED','REFUNDED','REFUND_PENDING') THEN
         CASE WHEN p.trip_status='CANCELLED' THEN p.departure_at-interval '2 days' ELSE p.booked_at+interval '3 hours' END END AS cancelled_at,
       CASE WHEN p.status='COMPLETED' THEN p.arrival_at+interval '15 minutes' END AS completed_at,
       CASE WHEN p.status='REFUNDED' THEN
         CASE WHEN p.trip_status='CANCELLED' THEN p.departure_at-interval '1 day' ELSE p.booked_at+interval '5 hours' END END AS refunded_at,
       CASE WHEN p.status IN ('REFUNDED','REFUND_PENDING') AND p.trip_status<>'CANCELLED' THEN p.fare/10 ELSE 0 END AS cancellation_fee,
       CASE WHEN p.status IN ('REFUNDED','REFUND_PENDING')
            THEN p.fare-CASE WHEN p.trip_status<>'CANCELLED' THEN p.fare/10 ELSE 0 END ELSE 0 END AS refund_amount,
       p.party,p.trip_no,p.pattern
FROM lifecycle p JOIN demo_customers c ON c.customer_no=p.customer_no;
CREATE UNIQUE INDEX ON demo_orders(id);
CREATE INDEX ON demo_orders(trip_id,party);
ANALYZE demo_orders;

CREATE TEMP TABLE demo_order_seats AS
WITH details AS (
  SELECT s.*, b.id AS booking_id,b.hold_id,b.trip_no,b.customer_name,b.created_at,b.paid_at,b.cancelled_at,b.refunded_at,
         t.origin_stop_id,t.destination_stop_id,t.via_stop_id,t.driver_user_id,t.departure_at,t.arrival_at,
         CASE
           WHEN b.status='EXPIRED' THEN NULL
           WHEN b.status='REFUNDED' THEN 'REFUNDED'
           WHEN b.status IN ('CANCELLED','REFUND_PENDING') THEN 'CANCELLED'
           WHEN t.status='COMPLETED' AND (t.trip_no+s.seat_no)%37<>0 THEN 'USED'
           WHEN t.status IN ('BOARDING','DEPARTED','IN_TRANSIT','ARRIVED') AND (t.trip_no+s.seat_no)%4<>0 THEN 'CHECKED_IN'
           ELSE 'ISSUED' END AS ticket_status
  FROM demo_selected_seats s JOIN demo_orders b ON b.trip_id=s.trip_id AND b.party=s.party
  JOIN demo_trips t ON t.id=s.trip_id
)
SELECT pg_temp.demo_id('booking-item',trip_no,seat_no) AS id,booking_id,hold_id,id AS trip_seat_id,source_seat_id,code AS seat_code,
       price AS unit_price,pg_temp.demo_id('passenger',trip_no,seat_no) AS passenger_id,
       CASE WHEN seat_no%3=0 THEN customer_name ELSE pg_temp.demo_name(trip_no*53+seat_no*223) END AS passenger_name,
       CASE WHEN seat_no%17=0 THEN via_stop_id ELSE origin_stop_id END AS pickup_stop_id,
       CASE WHEN seat_no%13=0 AND seat_no%17<>0 THEN via_stop_id ELSE destination_stop_id END AS dropoff_stop_id,
       CASE WHEN ticket_status IS NOT NULL THEN pg_temp.demo_id('ticket',trip_no,seat_no) END AS ticket_id,
       CASE WHEN ticket_status IS NOT NULL THEN 'TKDM' || lpad(trip_no::text,7,'0') || lpad(seat_no::text,2,'0') END AS ticket_code,
       ticket_status,CASE WHEN ticket_status IS NOT NULL THEN coalesce(paid_at,created_at)+interval '15 seconds' END AS issued_at,
       CASE WHEN ticket_status IN ('CHECKED_IN','USED') THEN departure_at-interval '40 minutes' END AS checked_in_at,
       CASE WHEN ticket_status IN ('CHECKED_IN','USED') THEN driver_user_id END AS checked_in_by,
       CASE WHEN ticket_status='USED' THEN arrival_at END AS used_at,cancelled_at,refunded_at
FROM details;
CREATE UNIQUE INDEX ON demo_order_seats(id);
CREATE INDEX ON demo_order_seats(booking_id);
ANALYZE demo_order_seats;
\endif
