import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { tripKeys } from "@/features/trips/api/tripQueryKeys";
import { httpTripRepository } from "@/features/trips/repositories/httpTripRepository";
import type { TripRepositoryError } from "@/features/trips/repositories/tripRepositoryError";
import type { Trip, TripSearchInput } from "@/features/trips/types/trip";

export function useTrips(
  input: TripSearchInput,
  enabled = true,
): UseQueryResult<readonly Trip[], TripRepositoryError> {
  return useQuery({
    enabled,
    queryKey: tripKeys.search(input),
    queryFn: ({ signal, queryKey }) =>
      httpTripRepository.search(queryKey[2], signal),
  });
}
