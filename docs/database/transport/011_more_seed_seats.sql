-- Extra seed seats so local booking is not stuck after 1A/1B sell out.
update buses
set seat_count = 6, updated_at = now()
where id = '01990a00-0000-7000-8000-000000000003';

insert into seats (
  id, bus_id, code, deck, row_no, column_no, seat_type, active, created_at, updated_at
) values
  ('01990a00-0000-7000-8000-000000000031', '01990a00-0000-7000-8000-000000000003', '1C', 1, 1, 3, 'STANDARD', true, timestamptz '2026-01-01 00:00:00+00', timestamptz '2026-01-01 00:00:00+00'),
  ('01990a00-0000-7000-8000-000000000032', '01990a00-0000-7000-8000-000000000003', '1D', 1, 1, 4, 'STANDARD', true, timestamptz '2026-01-01 00:00:00+00', timestamptz '2026-01-01 00:00:00+00'),
  ('01990a00-0000-7000-8000-000000000033', '01990a00-0000-7000-8000-000000000003', '2A', 1, 2, 1, 'STANDARD', true, timestamptz '2026-01-01 00:00:00+00', timestamptz '2026-01-01 00:00:00+00'),
  ('01990a00-0000-7000-8000-000000000034', '01990a00-0000-7000-8000-000000000003', '2B', 1, 2, 2, 'STANDARD', true, timestamptz '2026-01-01 00:00:00+00', timestamptz '2026-01-01 00:00:00+00')
on conflict (id) do nothing;
