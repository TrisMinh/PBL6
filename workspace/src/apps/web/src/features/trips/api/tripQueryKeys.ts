import type { TripSearchInput } from "@/features/trips/types/trip";

export const tripKeys = {
  locations: (): readonly ["trips", "locations"] =>
    Object.freeze(["trips", "locations"] as const),
  search: (
    input: TripSearchInput,
  ): readonly ["trips", "search", Readonly<TripSearchInput>] =>
    Object.freeze([
      "trips",
      "search",
      Object.freeze({
        originId: input.originId,
        destinationId: input.destinationId,
        departureDate: input.departureDate,
        passengerCount: input.passengerCount,
        sort: input.sort,
        ...(input.filters ? { filters: input.filters } : {}),
      }),
    ] as const),
};
