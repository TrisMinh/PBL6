import {
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useEffect } from "react";

import type { BookingRepositoryError } from "@/features/booking/repositories/bookingRepositoryError";
import { useBookingDraftStore } from "@/features/booking/store/bookingDraftStore";
import { useBookingDraftHydration } from "@/features/booking/hooks/useBookingDraftHydration";
import { bookingKeys } from "@/features/booking/api/bookingQueryKeys";
import type { BookingDraft } from "@/features/booking/types/booking";
import { httpPaymentRepository } from "@/features/payment/repositories/httpPaymentRepository";
import type { PaymentResult } from "@/features/payment/types/payment";

function ownsResult(draft: BookingDraft, result: PaymentResult): boolean {
  return (
    draft.bookingId === result.bookingId &&
    draft.sessionId === result.sessionId &&
    draft.paymentAttempt?.transactionId === result.transactionId &&
    draft.paymentAttempt.resultId === result.resultId
  );
}
function hasExactTickets(draft: BookingDraft, result: PaymentResult): boolean {
  return (
    draft.totalVnd === result.amountVnd &&
    draft.selectedSeatIds.length === result.tickets.length &&
    result.tickets.every(
      (t) =>
        t.tripId === draft.tripId && draft.selectedSeatIds.includes(t.seatId),
    )
  );
}
function usePaymentCompletion(result: PaymentResult | undefined): void {
  const hydrated = useBookingDraftHydration(),
    client = useQueryClient();
  const owner = useBookingDraftStore((s) => s.draft);
  useEffect(() => {
    if (!hydrated || !result) return;
    const draft = useBookingDraftStore.getState().draft;
    if (!draft || !ownsResult(draft, result)) return;
    if (result.status === "success" && hasExactTickets(draft, result)) {
      useBookingDraftStore.getState().clearDraft();
      void client.invalidateQueries({
        queryKey: bookingKeys.seats(draft.tripId),
      });
    } else if (result.status === "failed" || result.status === "cancelled")
      useBookingDraftStore
        .getState()
        .setDraft({ ...draft, paymentAttempt: undefined });
  }, [result, hydrated, client, owner]);
}
export function usePaymentReturn(
  transactionId: string,
  resultId: string,
): UseQueryResult<PaymentResult, BookingRepositoryError> {
  const query = useQuery<PaymentResult, BookingRepositoryError>({
    queryKey: Object.freeze(["payment", "return", transactionId, resultId]),
    queryFn: ({ signal }) =>
      httpPaymentRepository.resolve(transactionId, resultId, signal),
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
  usePaymentCompletion(query.data);
  return query;
}
