-- Amenities on the seed coach so search filters have something to match.
update buses
set amenities = '["WIFI","AC","WATER"]'::jsonb, updated_at = now()
where id = '01990a00-0000-7000-8000-000000000003';
