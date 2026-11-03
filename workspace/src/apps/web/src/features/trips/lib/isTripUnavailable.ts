import type { Trip } from "../types/trip";

export function isTripUnavailable(
  trip: Pick<Trip, "sellable" | "status">,
): boolean {
  return (
    trip.sellable === false ||
    (trip.status !== undefined &&
      !["SCHEDULED", "BOARDING"].includes(trip.status))
  );
}
