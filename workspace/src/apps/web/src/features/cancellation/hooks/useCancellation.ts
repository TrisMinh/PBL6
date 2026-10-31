import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import type { CancellationAccess } from "@/features/cancellation/repositories/cancellationRepository";
import { httpCancellationRepository } from "@/features/cancellation/repositories/httpCancellationRepository";
import { TICKET_DETAIL_QUERY_KEY } from "@/features/tickets/config/access";
import type { BookingRepositoryError } from "@/features/booking/repositories/bookingRepositoryError";
import type {
  CancellationOptions,
  Refund,
} from "@/features/cancellation/types/cancellation";

export const CANCELLATION_QUERY_KEY = "cancellation-options";

export function useCancellationOptions(
  bookingCode: string,
  access: CancellationAccess,
): UseQueryResult<CancellationOptions, BookingRepositoryError> {
  return useQuery({
    queryKey: [CANCELLATION_QUERY_KEY, bookingCode, access.kind],
    queryFn: ({ signal }) =>
      httpCancellationRepository.getOptions(bookingCode, access, signal),
  });
}

export function useCreateCancellation(
  bookingCode: string,
  access: CancellationAccess,
): UseMutationResult<
  Refund,
  BookingRepositoryError,
  { ticketIds: readonly string[]; key: string }
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { ticketIds: readonly string[]; key: string }) =>
      httpCancellationRepository.cancel(
        bookingCode,
        input.ticketIds,
        input.key,
        access,
      ),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: [TICKET_DETAIL_QUERY_KEY] }),
        client.invalidateQueries({ queryKey: ["account-tickets"] }),
      ]);
    },
  });
}
