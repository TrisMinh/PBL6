import type { Trip } from "@/features/trips/types/trip";
import { trips } from "./trips";
import { getVietnamTodayDate } from "@/shared/lib/getVietnamTodayDate";

// Keep the original 2099 fixtures stable for existing flows and tests.
// Demo service days start tomorrow so all displayed departures can be booked.
export function createDemoTrips(
  today = getVietnamTodayDate(),
): readonly Readonly<Trip>[] {
  const seeds = trips.slice(0, 24);
  return Object.freeze(
    Array.from({ length: 7 }, (_, day) => {
      const date = new Date(`${today}T00:00:00+07:00`);
      date.setTime(date.getTime() + (day + 1) * 86400000);
      const anchor = Date.parse("2099-01-01T00:00:00+07:00");
      const offset = date.getTime() - anchor;
      const serviceDate = new Date(date.getTime() + 7 * 3600000)
        .toISOString()
        .slice(0, 10);
      return seeds.map((seed, index) =>
        Object.freeze({
          ...seed,
          id: `demo-${serviceDate}-${seed.id}`,
          departureTime: new Date(
            Date.parse(seed.departureTime) + offset,
          ).toISOString(),
          arrivalTime: new Date(
            Date.parse(seed.arrivalTime) + offset,
          ).toISOString(),
          ...(index === 3 ? { fareVnd: 300000 } : {}),
        }),
      );
    }).flat(),
  );
}
export const demoTrips = createDemoTrips();
export const discoveryTrips = Object.freeze([...trips, ...demoTrips]);
