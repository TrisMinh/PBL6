CREATE INDEX IF NOT EXISTS ix_trips_public_departure
    ON trips (departure_at, id)
    WHERE sellable AND status IN ('SCHEDULED', 'BOARDING');
CREATE INDEX IF NOT EXISTS ix_trips_public_fare
    ON trips (base_fare, id)
    WHERE sellable AND status IN ('SCHEDULED', 'BOARDING');
