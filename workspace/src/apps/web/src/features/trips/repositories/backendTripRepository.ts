import { apiJson } from "@/shared/api/client";
import { z } from "zod";
import {
  backendTripSchema,
  pageOf,
  type BackendTrip,
} from "@/shared/api/contracts";
import type { TripRepository } from "./tripRepository";
import type { Trip, Location } from "../types/trip";

export function toTrip(trip: BackendTrip): Trip {
  const location = (name: string): Location => ({
    id: name,
    name,
    displayName: name,
    province: name,
  });
  return {
    id: trip.id,
    sellable: trip.sellable,
    status: trip.status,
    seatCountIsCapacity: true,
    stops: trip.stops,
    policyVersion: trip.policyVersion,
    allowPayLater: trip.allowPayLater,
    origin: location(trip.origin),
    destination: location(trip.destination),
    operator: { id: trip.organizationId, name: trip.operatorName },
    displayOperatorName: trip.operatorName,
    departureTime: trip.departureAt,
    arrivalTime: trip.arrivalAt,
    fareVnd: trip.fare.amount,
    availableSeatCount: trip.availableSeatCount ?? 0,
    vehicleType: /22|cabin/i.test(trip.busType) ? "cabin-22" : "sleeper-34",
    vehicleLabel:
      (
        {
          SLEEPER_34: "Giường nằm 34 chỗ",
          CABIN_22: "Cabin 22 chỗ",
        } as Record<string, string>
      )[trip.busType] ?? trip.busType,
    originStopName:
      trip.stops.find((s) => s.pickupAllowed)?.name ?? trip.origin,
    destinationStopName:
      [...trip.stops].reverse().find((s) => s.dropoffAllowed)?.name ??
      trip.destination,
    amenities: trip.amenities.flatMap((value) => {
      const key = value.toLowerCase();
      return key === "wifi"
        ? ["wifi" as const]
        : key === "charging"
          ? ["charging" as const]
          : key === "restroom"
            ? ["restroom" as const]
            : key === "doorpickup"
              ? ["doorPickup" as const]
              : [];
    }),
  };
}
export function getBackendTrip(
  id: string,
  signal?: AbortSignal,
): Promise<BackendTrip> {
  return apiJson(`/api/v1/trips/${encodeURIComponent(id)}`, backendTripSchema, {
    signal,
    auth: false,
  });
}
export const backendTripRepository: TripRepository = {
  getLocations: async (signal) => {
    const routes = await apiJson(
      "/api/v1/explore/routes",
      z.array(z.object({ origin: z.string(), destination: z.string() })),
      { signal, auth: false },
    );
    const locations = new Map<string, Location>();
    for (const route of routes) {
      for (const name of [route.origin, route.destination]) {
        if (!locations.has(name))
          locations.set(name, {
            id: name,
            name,
            displayName: name,
            province: name,
            destinationIds: [],
          });
      }
      const origin = locations.get(route.origin);
      if (origin && !origin.destinationIds?.includes(route.destination))
        origin.destinationIds = [
          ...(origin.destinationIds ?? []),
          route.destination,
        ];
    }
    return [...locations.values()].sort((a, b) =>
      a.name.localeCompare(b.name, "vi"),
    );
  },
  search: async (input, signal) => {
    const query = new URLSearchParams({
      origin: input.originId,
      destination: input.destinationId,
      departureDate: input.departureDate,
      passengerCount: String(input.passengerCount),
      page: "0",
      size: "100",
    });
    if (input.filters?.minFare !== undefined)
      query.set("minPrice", String(input.filters.minFare));
    if (input.filters?.maxFare !== undefined)
      query.set("maxPrice", String(input.filters.maxFare));
    if (input.filters?.departureHour)
      query.set("departureTimeFrom", input.filters.departureHour);
    for (const key of [
      "organizationId",
      "pickupStopId",
      "dropoffStopId",
    ] as const) {
      const value = input.filters?.[key];
      if (value) query.set(key, value);
    }
    query.set(
      "sort",
      input.sort === "price-asc"
        ? "PRICE_ASC"
        : input.sort === "price-desc"
          ? "PRICE_DESC"
          : input.sort === "duration-asc"
            ? "DURATION_ASC"
            : input.sort === "duration-desc"
              ? "DURATION_DESC"
              : "DEPARTURE_ASC",
    );
    const items: Trip[] = [];
    for (let page = 0; ; page++) {
      query.set("page", String(page));
      const result = await apiJson(
        `/api/v1/trips?${query}`,
        pageOf(backendTripSchema),
        { signal, auth: false },
      );
      items.push(...result.items.map(toTrip));
      if (page + 1 >= result.totalPages) break;
    }
    return items;
  },
};
