import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { backendTripRepository } from "@/features/trips/repositories/backendTripRepository";
import type { Trip } from "@/features/trips/types/trip";
import type { ProvinceDetail } from "./explore.schema";
import type { Artwork } from "./ExploreImage";

export const catalogueSearch = {
  originId: "",
  destinationId: "",
  departureDate: "",
  passengerCount: 1,
  sort: "departure" as const,
};
export function useLiveCatalogue(
  enabled = true,
): UseQueryResult<readonly Trip[]> {
  return useQuery({
    queryKey: ["live-api", "public-trip-catalogue"],
    queryFn: ({ signal }) =>
      backendTripRepository.search(catalogueSearch, signal),
    enabled,
  });
}
export function provinceSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z]+/g, "-")
    .replace(/^-|-$/g, "");
}

const featuredRouteOrder = [
  "ho-chi-minh:da-lat",
  "ha-noi:da-nang",
  "da-lat:da-nang",
  "ho-chi-minh:ha-noi",
  "da-lat:ho-chi-minh",
  "ha-noi:ho-chi-minh",
];
const featuredArtwork: Artwork[] = [
  ["travel", 0],
  ["travel", 1],
  ["travel", 2],
  ["travel", 3],
  ["extra", 0],
  ["extra", 1],
];

function featuredIndex(origin: string, destination: string): number {
  const city = (name: string): string => provinceSlug(name).replace(/^tp-/, "");
  return featuredRouteOrder.indexOf(`${city(origin)}:${city(destination)}`);
}

export function routeArtwork(origin: string, destination: string): Artwork {
  const featured = featuredArtwork[featuredIndex(origin, destination)];
  if (featured) return featured;
  const target = provinceSlug(destination);
  if (target.includes("da-lat") || target.includes("lam-dong"))
    return ["travel", 0];
  if (target.includes("da-nang"))
    return ["travel", provinceSlug(origin).includes("ha-noi") ? 1 : 2];
  if (target.includes("ha-noi")) return ["travel", 3];
  if (target.includes("ho-chi-minh")) return ["extra", 0];
  return ["extra", 1];
}
type CatalogueRoute = {
  originId: string;
  destinationId: string;
  title: string;
  art: Artwork;
  minFare: number;
  tripCount: number;
  departureDate: string;
};
export function catalogueRoutes(
  trips: readonly Trip[],
  serviceDate?: string,
): CatalogueRoute[] {
  const routes = new Map<string, CatalogueRoute & { priority: number }>();
  const dateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
  for (const trip of trips) {
    const date = dateFormatter.format(new Date(trip.departureTime));
    if (serviceDate && date !== serviceDate) continue;
    const key = JSON.stringify([trip.origin.id, trip.destination.id]);
    const existing = routes.get(key);
    if (existing) {
      existing.minFare = Math.min(existing.minFare, trip.fareVnd);
      existing.tripCount++;
    } else {
      const priority = featuredIndex(trip.origin.name, trip.destination.name);
      routes.set(key, {
        originId: trip.origin.id,
        destinationId: trip.destination.id,
        title: `${trip.origin.displayName} → ${trip.destination.displayName}`,
        art: routeArtwork(trip.origin.name, trip.destination.name),
        minFare: trip.fareVnd,
        tripCount: 1,
        departureDate: date,
        priority: priority >= 0 ? priority : featuredRouteOrder.length,
      });
    }
  }
  return [...routes.values()].sort((a, b) => a.priority - b.priority);
}
export function catalogueProvinces(trips: readonly Trip[]): ProvinceDetail[] {
  const provinces = new Map<string, ProvinceDetail>();
  for (const trip of trips) {
    for (const [location, pickup] of [
      [trip.origin, true],
      [trip.destination, false],
    ] as const) {
      const slug = provinceSlug(location.name);
      let province = provinces.get(slug);
      if (!province) {
        province = {
          slug,
          name: location.displayName,
          region: location.province,
          description: `Điểm đón, trả trên các tuyến xe tại ${location.displayName}.`,
          isMock: false,
          operatorCount: 0,
          pickupCount: 0,
          dropoffCount: 0,
          operators: [],
          points: [],
        };
        provinces.set(slug, province);
      }
      if (!province.operators.some((o) => o.id === trip.operator.id))
        province.operators.push(trip.operator);
      const ordered = [...(trip.stops ?? [])].sort(
        (a, b) => a.sequence - b.sequence,
      );
      // Only the endpoint stop can be assigned to this city without guessing where intermediate stops are located.
      const stop = pickup
        ? ordered.find((s) => s.pickupAllowed)
        : ordered.reverse().find((s) => s.dropoffAllowed);
      if (stop) {
        let point = province.points.find((p) => p.id === stop.id);
        if (!point) {
          point = {
            id: stop.id,
            name: stop.name,
            address: stop.address ?? "",
            services: [],
            operatorIds: [],
            latitude: null,
            longitude: null,
            coordinateSource: null,
          };
          province.points.push(point);
        }
        const service = pickup ? "pickup" : "dropoff";
        if (!point.services.includes(service)) point.services.push(service);
        if (!point.operatorIds.includes(trip.operator.id))
          point.operatorIds.push(trip.operator.id);
      }
    }
  }
  return [...provinces.values()].map((p) => ({
    ...p,
    operatorCount: p.operators.length,
    pickupCount: p.points.filter((s) => s.services.includes("pickup")).length,
    dropoffCount: p.points.filter((s) => s.services.includes("dropoff")).length,
  }));
}
