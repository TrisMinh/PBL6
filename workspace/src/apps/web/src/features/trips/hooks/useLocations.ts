import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { tripKeys } from "@/features/trips/api/tripQueryKeys";
import { httpTripRepository } from "@/features/trips/repositories/httpTripRepository";
import type { TripRepositoryError } from "@/features/trips/repositories/tripRepositoryError";
import type { Location } from "@/features/trips/types/trip";

export function useLocations(): UseQueryResult<
  readonly Location[],
  TripRepositoryError
> {
  return useQuery({
    queryKey: tripKeys.locations(),
    queryFn: ({ signal }) => httpTripRepository.getLocations(signal),
  });
}
