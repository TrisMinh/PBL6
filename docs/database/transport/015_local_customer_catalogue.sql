-- Local Sandbox catalogue. Additive and repeatable; never reset existing bookings/trips.
-- These are demonstration schedules, not advertised services of a real carrier.
BEGIN;
CREATE FUNCTION pg_temp.blue_catalogue_id(value text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT (overlay(overlay(md5(value) placing '5' from 13 for 1) placing '8' from 17 for 1))::uuid;
$$;
CREATE TEMP TABLE blue_cities (slug text, name text, province text) ON COMMIT DROP;
INSERT INTO blue_cities VALUES ('hcm','TP. Hồ Chí Minh','HCM'),('dalat','Đà Lạt','LD'),('danang','Đà Nẵng','DN'),('hanoi','Hà Nội','HN');
INSERT INTO stops(id,organization_id,code,name,address,province_code,status,created_at,updated_at)
SELECT pg_temp.blue_catalogue_id('blue-catalog-v2-stop-'||slug),'01990a00-0000-7000-8000-000000000001',
 'BLUE-CATALOG-V2-'||slug,name,'Điểm đón mẫu tại '||name,province,'ACTIVE',now(),now()
FROM blue_cities ON CONFLICT(id) DO NOTHING;
CREATE TEMP TABLE blue_routes ON COMMIT DROP AS
SELECT a.slug||'-'||b.slug AS slug, a.name||' → '||b.name AS name,
 pg_temp.blue_catalogue_id('blue-catalog-v2-stop-'||a.slug) AS origin_id, pg_temp.blue_catalogue_id('blue-catalog-v2-stop-'||b.slug) AS destination_id,
 CASE WHEN a.slug='hanoi' OR b.slug='hanoi' THEN 1080 WHEN a.slug='danang' OR b.slug='danang' THEN 720 ELSE 360 END AS minutes
FROM blue_cities a CROSS JOIN blue_cities b WHERE a.slug<>b.slug;
INSERT INTO routes(id,organization_id,code,name,origin_stop_id,destination_stop_id,default_duration_minutes,status,created_at,updated_at)
SELECT pg_temp.blue_catalogue_id('blue-catalog-v2-route-'||slug),'01990a00-0000-7000-8000-000000000001',
 'BLUE-CATALOG-V2-'||slug,name,origin_id,destination_id,minutes,'ACTIVE',now(),now()
FROM blue_routes ON CONFLICT(id) DO NOTHING;
INSERT INTO route_stops(id,route_id,stop_id,sequence_no,stop_role,arrival_offset_minutes,departure_offset_minutes,pickup_allowed,dropoff_allowed)
SELECT pg_temp.blue_catalogue_id('blue-catalog-v2-rstop-'||slug||'-'||pos),pg_temp.blue_catalogue_id('blue-catalog-v2-route-'||slug),
 CASE WHEN pos=0 THEN origin_id ELSE destination_id END,pos,CASE WHEN pos=0 THEN 'ORIGIN' ELSE 'DESTINATION' END,
 CASE WHEN pos=0 THEN 0 ELSE minutes END,CASE WHEN pos=0 THEN 0 ELSE minutes END,pos=0,pos=1
FROM blue_routes CROSS JOIN generate_series(0,1) pos ON CONFLICT(id) DO NOTHING;
INSERT INTO buses(id,organization_id,plate_number,normalized_plate_number,display_name,bus_type,amenities,seat_count,status,created_at,updated_at)
SELECT pg_temp.blue_catalogue_id('blue-catalog-v2-bus-'||slug||'-'||slot),'01990a00-0000-7000-8000-000000000001',
 'DM2-'||slug||'-'||slot,upper('DM2-'||slug||'-'||slot),'Xe trải nghiệm BLUE · '||name,
 CASE WHEN slot=0 THEN 'SLEEPER_34' ELSE 'CABIN_22' END,'["WIFI","CHARGING","RESTROOM"]'::jsonb,
 CASE WHEN slot=0 THEN 34 ELSE 22 END,'ACTIVE',now(),now()
FROM blue_routes CROSS JOIN generate_series(0,1) slot ON CONFLICT(id) DO NOTHING;
INSERT INTO seats(id,bus_id,code,deck,row_no,column_no,seat_type,active,created_at,updated_at)
SELECT pg_temp.blue_catalogue_id(b.id::text||'-seat-'||n),b.id,
 CASE WHEN n<=b.seat_count/2 THEN 'A' ELSE 'B' END||lpad((((n-1)%(b.seat_count/2))+1)::text,2,'0'),
 CASE WHEN n<=b.seat_count/2 THEN 1 ELSE 2 END,(((n-1)%(b.seat_count/2))/2)+1,((n-1)%2)+1,'SLEEPER',true,now(),now()
FROM buses b CROSS JOIN LATERAL generate_series(1,b.seat_count) n
WHERE b.plate_number LIKE 'DM2-%' ON CONFLICT(id) DO NOTHING;
INSERT INTO trips(id,organization_id,route_id,bus_id,origin_stop_id,destination_stop_id,departure_at,arrival_at,
 operating_window,base_fare,currency,status,sellable,created_at,updated_at)
SELECT pg_temp.blue_catalogue_id('blue-catalog-v2-trip-'||r.slug||'-'||slot||'-'||day::date),'01990a00-0000-7000-8000-000000000001',
 pg_temp.blue_catalogue_id('blue-catalog-v2-route-'||r.slug),pg_temp.blue_catalogue_id('blue-catalog-v2-bus-'||r.slug||'-'||slot),r.origin_id,r.destination_id,
 dep,dep+make_interval(mins=>r.minutes),tstzrange(dep-interval '30 minutes',dep+make_interval(mins=>r.minutes)+interval '30 minutes','[)'),
 180000+r.minutes*200+slot*45000,'VND','DRAFT',false,now(),now()
FROM blue_routes r CROSS JOIN generate_series(0,1) slot
CROSS JOIN generate_series((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date+1,(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date+7,interval '1 day') day
CROSS JOIN LATERAL (SELECT ((day::date+(CASE WHEN slot=0 THEN time '08:00' ELSE time '21:00' END)) AT TIME ZONE 'Asia/Ho_Chi_Minh') AS dep) d
ON CONFLICT(id) DO NOTHING;
COMMIT;
