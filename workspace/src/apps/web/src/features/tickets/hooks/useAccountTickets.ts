import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import type { MockSession } from "@/features/auth/types/auth";
import type { BookingRepositoryError } from "@/features/booking/repositories/bookingRepositoryError";
import { httpTicketRepository } from "@/features/tickets/repositories/httpTicketRepository";
import type { TicketDetail } from "@/features/tickets/types/ticketAccess";
import type { TicketHistoryFilter } from "@/features/tickets/repositories/ticketRepository";

export function useAccountTickets(
  session: MockSession,
  status: TicketHistoryFilter,
): UseQueryResult<
  { readonly items: readonly TicketDetail[]; readonly total: number },
  BookingRepositoryError
> {
  return useQuery({
    queryKey: Object.freeze([
      "account-tickets",
      session.userId,
      session.expiresAt,
      status,
    ]),
    queryFn: ({ signal }) =>
      httpTicketRepository.getHistory(session.token ?? "", status, signal),
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
}
export function useAccountTicketDetail(
  code: string,
  session: MockSession,
): UseQueryResult<TicketDetail, BookingRepositoryError> {
  return useQuery({
    queryKey: Object.freeze([
      "account-ticket-detail",
      code,
      session.userId,
      session.expiresAt,
    ]),
    queryFn: ({ signal }) =>
      httpTicketRepository.getAccountDetail(code, session.token ?? "", signal),
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
}
