-- Read-only demo: show seat status for the Postman test fixture trip.
select trip_id, seat_code, status
from trip_seats
where trip_id = '01990a00-0000-7000-8000-000000000007'
  and seat_code in ('2A', '2B')
order by seat_code;
