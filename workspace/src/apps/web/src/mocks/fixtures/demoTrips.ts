import type { Trip } from "@/features/trips/types/trip";
import { trips } from "./trips";
import { getVietnamTodayDate } from "@/shared/lib/getVietnamTodayDate";
import { locations } from "./locations";

// Keep the original 2099 fixtures stable for existing flows and tests.
// Demo service days start tomorrow so all displayed departures can be booked.
export function createDemoTrips(
  today = getVietnamTodayDate(),
): readonly Readonly<Trip>[] {
  const seeds = trips.slice(0, 24);
  const primary = Array.from({ length: 7 }, (_, day) => {
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
  }).flat();
  const routes = locations.flatMap((origin) =>
    locations
      .filter(
        (destination) =>
          destination.id !== origin.id &&
          !(origin.id === "loc-hcm" && destination.id === "loc-dalat"),
      )
      .map((destination) => ({ origin, destination })),
  );
  const additional = routes.flatMap(({ origin, destination }, routeIndex) =>
    Array.from({ length: 7 }, (_, day) =>
      seeds.slice(0, 6).map((seed, index) => {
        const midnight =
          Date.parse(`${today}T00:00:00+07:00`) + (day + 1) * 86400000;
        const departure = midnight + (6 + index * 3) * 3600000;
        const durationHours =
          origin.id.includes("hanoi") || destination.id.includes("hanoi")
            ? 18
            : origin.id.includes("danang") || destination.id.includes("danang")
              ? 12
              : 6;
        const serviceDate = new Date(midnight + 7 * 3600000)
          .toISOString()
          .slice(0, 10);
        return Object.freeze({
          ...seed,
          id: `demo-${serviceDate}-${origin.id}-${destination.id}-${index}`,
          origin,
          destination,
          originStopName: origin.name,
          destinationStopName: destination.name,
          departureTime: new Date(departure).toISOString(),
          arrivalTime: new Date(
            departure + (durationHours + (index % 2)) * 3600000,
          ).toISOString(),
          fareVnd:
            180000 + durationHours * 12000 + index * 20000 + routeIndex * 5000,
          amenities: Object.freeze(
            index % 2 === 0
              ? (["wifi", "charging", "restroom"] as const)
              : (["wifi", "charging"] as const),
          ),
        });
      }),
    ).flat(),
  );
  return Object.freeze([...primary, ...additional]);
}
export const demoTrips = createDemoTrips();
export const discoveryTrips = Object.freeze([...trips, ...demoTrips]);
