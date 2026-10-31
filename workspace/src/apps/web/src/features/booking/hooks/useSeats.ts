import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { bookingKeys } from "@/features/booking/api/bookingQueryKeys";
import type { BookingRepositoryError } from "@/features/booking/repositories/bookingRepositoryError";
import { httpBookingRepository } from "@/features/booking/repositories/httpBookingRepository";
import type { SeatLayout } from "@/features/booking/types/seat";

export function useSeats(
  tripId: string,
): UseQueryResult<SeatLayout, BookingRepositoryError> {
  return useQuery({
    queryKey: bookingKeys.seats(tripId),
    queryFn: ({ queryKey, signal }) =>
      httpBookingRepository.getSeats(queryKey[2], signal),
    enabled: Boolean(tripId),
    staleTime: 0,
    retry: false,
  });
}
