create table trips (
  id uuid primary key,
  booking_id uuid not null references booking.bookings(id)
);
