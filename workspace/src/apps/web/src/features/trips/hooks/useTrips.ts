import { isMockApi } from "@/shared/api/config";
import { backendTripRepository } from "@/features/trips/repositories/backendTripRepository";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { tripKeys } from "@/features/trips/api/tripQueryKeys";
import { httpTripRepository } from "@/features/trips/repositories/httpTripRepository";
import type { TripRepositoryError } from "@/features/trips/repositories/tripRepositoryError";
import type { Trip, TripSearchInput } from "@/features/trips/types/trip";

export function useTrips(
  input: TripSearchInput,
  enabled = true,
  includeAvailability = true,
): UseQueryResult<readonly Trip[], TripRepositoryError> {
  return useQuery({
    enabled,
    queryKey: includeAvailability
      ? tripKeys.search(input)
      : ([...tripKeys.search(input), "capacity"] as const),
    queryFn: ({ signal, queryKey }) =>
      isMockApi
        ? httpTripRepository.search(queryKey[2], signal)
        : backendTripRepository.search(
            queryKey[2],
            signal,
            includeAvailability,
            { cards: true },
          ),
  });
}
