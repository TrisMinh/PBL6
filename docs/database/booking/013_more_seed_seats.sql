-- Extra inventory for the seed trip. Existing 1A/1B rows are left as-is.
update trip_snapshots
set bus_snapshot = '{"seats":[
  {"id":"01990a00-0000-7000-8000-000000000013","code":"1A","deck":1,"row":1,"column":1,"type":"STANDARD","active":true},
  {"id":"01990a00-0000-7000-8000-000000000014","code":"1B","deck":1,"row":1,"column":2,"type":"STANDARD","active":true},
  {"id":"01990a00-0000-7000-8000-000000000031","code":"1C","deck":1,"row":1,"column":3,"type":"STANDARD","active":true},
  {"id":"01990a00-0000-7000-8000-000000000032","code":"1D","deck":1,"row":1,"column":4,"type":"STANDARD","active":true},
  {"id":"01990a00-0000-7000-8000-000000000033","code":"2A","deck":1,"row":2,"column":1,"type":"STANDARD","active":true},
  {"id":"01990a00-0000-7000-8000-000000000034","code":"2B","deck":1,"row":2,"column":2,"type":"STANDARD","active":true}
]}'::jsonb,
    updated_at = now()
where trip_id = '01990a00-0000-7000-8000-000000000007';

insert into trip_seats (
  id, trip_id, source_seat_id_external, seat_code, seat_type, deck, row_no, column_no,
  price, status, updated_at
) values
  ('01990a00-0000-7000-8000-000000000041', '01990a00-0000-7000-8000-000000000007', '01990a00-0000-7000-8000-000000000031', '1C', 'STANDARD', 1, 1, 3, 150000, 'AVAILABLE', now()),
  ('01990a00-0000-7000-8000-000000000042', '01990a00-0000-7000-8000-000000000007', '01990a00-0000-7000-8000-000000000032', '1D', 'STANDARD', 1, 1, 4, 150000, 'AVAILABLE', now()),
  ('01990a00-0000-7000-8000-000000000043', '01990a00-0000-7000-8000-000000000007', '01990a00-0000-7000-8000-000000000033', '2A', 'STANDARD', 1, 2, 1, 150000, 'AVAILABLE', now()),
  ('01990a00-0000-7000-8000-000000000044', '01990a00-0000-7000-8000-000000000007', '01990a00-0000-7000-8000-000000000034', '2B', 'STANDARD', 1, 2, 2, 150000, 'AVAILABLE', now())
on conflict (trip_id, source_seat_id_external) do nothing;
