-- After cancel, the same trip seat may be sold again. History stays on booking_items.
alter table booking_items drop constraint if exists uq_booking_items_trip_seat;
